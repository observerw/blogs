---
name: merge
description: >-
  Merges a requested change into the main branch of the observerw/blogs Astro site end to end:
  commits the current work on its own branch, opens a pull request, waits for the CI workflow
  to pass, squash-merges it, and verifies the GitHub Pages deploy. Invoke only when the user
  has explicitly requested merging, landing, or shipping a change (for example by choosing
  Merge Change or running /merge). Do not invoke it for reviewing, preparing, checking, or
  setting up skills.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Merge a change into `main`

Carry out the merge request that triggered this skill. Do not ask again whether to merge, and
do not stop to request permission the request already gave. Stop only for the blockers listed
under **Stopping**.

Preparing commits, pushing a branch, or starting checks is not completion. The change is merged
only when it is on `origin/main` and the Pages deploy for it succeeded.

## Facts verified against this repository

- `main` is unprotected and has no required reviews; history is linear, direct-to-`main`
  pushes, one conventional-commit subject per change (`feat:`, `fix:`, `content:`).
- CI job `Code standards & build` runs on `pull_request` only (`lint`, `format:check`,
  `build`) — `.github/workflows/ci.yml`.
- `Deploy to GitHub Pages` runs on every push to `main` — `.github/workflows/deploy.yml`.
- Runtime: Node `>=22.23.4`, pnpm `12.4.1` (`package.json` `engines`, `packageManager`).
- Scripts used below are defined in `package.json`.

## 1. Preflight

```sh
git rev-parse --show-toplevel
git status --short
gh auth status
gh repo view observerw/blogs --json name,defaultBranchRef,squashMergeAllowed,viewerPermission
node -v && pnpm -v
```

- Run everything from the repository root (the checkout containing `package.json` for `blog`).
- `squashMergeAllowed` must be `true`; `defaultBranchRef.name` must be `main`.
- `node -v` must satisfy `>=22.23.4`; `pnpm -v` should be `12.4.1`. If either is wrong, stop and
  report instead of substituting another package manager.
- If `gh auth status` is not logged in, stop and ask the user to authenticate.
- Note uncommitted files. Files unrelated to the requested change must stay out of the commit;
  if the change cannot be separated from unrelated edits, stop and ask which files belong to it.

## 2. Put the change on a branch

```sh
git fetch origin
git switch -c merge/<short-slug>    # only when HEAD is main
```

- If HEAD is already a feature branch for this change, keep using it.
- If local `main` is behind `origin/main`, branch from `origin/main` and reapply/cherry-pick the
  change (`git switch -c merge/<slug> origin/main`), handling routine overlaps automatically.
- Stage only the files that belong to the change (`git add <paths>`), never a blind `git add -A`.
- Commit with a conventional-commit subject in the repository's existing style, in the language
  of the surrounding history (`feat: …`, `fix: …`, `content: …`). No signing, no trailers.
- If the change is already committed on a branch, skip to step 3.

## 3. Local verification (mirrors CI)

```sh
pnpm install --frozen-lockfile   # only when node_modules is absent or the lockfile changed
pnpm lint                        # .github/workflows/ci.yml step "🔎 Lint code"
pnpm format:check                # .github/workflows/ci.yml step "📝 Checking code format"
pnpm build                       # .github/workflows/ci.yml step "🚀 Build the project"
```

- If `format:check` fails only on formatting, run `pnpm format`, re-run `pnpm format:check`, and
  amend the formatting into the change commit (`git commit --amend --no-edit`).
- Any remaining failure (`lint`, type check, content schema, build) is a blocker: fix it only if
  the fix is clearly part of the requested change; otherwise stop and report the failure.

## 4. Publish and open the pull request

```sh
git push -u origin merge/<short-slug>
gh pr create --base main --head merge/<short-slug> \
  --title "<conventional subject>" --body "<what changed and why>"
```

- Reuse an existing open PR for the same branch instead of opening a second one.
- Do not push to `main` directly, even though it is unprotected: CI does not run on direct pushes,
  so a direct push would skip verification.

## 5. Require the CI check to pass on the pushed commit

```sh
gh pr view <number> --json headRefOid,mergeable,mergeStateStatus
gh pr checks <number> --json name,state,bucket
```

- `gh pr checks` must report the `Code standards & build` check as completed with a successful
  conclusion, for the head commit currently pushed (`git rev-parse HEAD` must equal `headRefOid`).
- Pending, failing, missing, or absent checks are not success. Wait for a running check with
  `gh pr checks <number> --watch`; if it fails, stop and report.
- There are no branch protections, so nothing is enforced server-side: these checks are the
  verification, and they must be green before merging.

## 6. Merge

```sh
gh pr merge <number> --squash --delete-branch
git switch main && git pull --ff-only origin main
```

- Squash-merge keeps `main` linear with one commit per change, matching existing history.
- Never merge while checks are pending or failing, never bypass with admin privileges, never
  force-push `main`.

## 7. Verify the result

```sh
gh pr view <number> --json state,mergeCommit
gh run list --workflow=deploy.yml --branch main --limit 1 \
  --json databaseId,headSha,status,conclusion
```

- The PR must be `MERGED`, and the reported `headSha` of the newest `Deploy to GitHub Pages` run
  must equal the merge commit (`mergeCommit.oid`).
- If that deploy run is still in progress, watch it (`gh run watch <databaseId> --exit-status`).
  A failed deploy means the change is merged but not published — report both facts plainly.
- Confirm the squash commit is present in `git log --oneline -3` after pulling `main`.

## Conflicts

- Routine mechanics — rebasing onto a moved `origin/main`, fast-forwarding, non-overlapping edits —
  are handled automatically without asking.
- A genuine conflict (overlapping edits whose intended result is not obvious) is a blocker: notify
  the user with the conflicting files and the competing changes, and leave the branch untouched.
  Do not guess a resolution for content the user authored.

## Stopping

Stop and report that **the change has not been merged**, with the specific blocker, when:

- a required check is failing, pending past a reasonable wait, missing, or unverifiable;
- `gh`/`pnpm`/`node` are missing, unauthenticated, or the wrong version;
- a genuine conflict appears, or the intended resolution is ambiguous;
- unrelated uncommitted work would have to be included to proceed;
- the requested change cannot be identified from the request and the working tree.

## Report

On success, report: branch, PR number and URL, squash merge commit, and that the Pages deploy for
that commit succeeded. On a blocker, say explicitly what did not merge and why.
