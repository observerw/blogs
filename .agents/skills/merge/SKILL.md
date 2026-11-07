---
name: merge
description: >-
  Merges a requested change into the main branch of the observerw/blogs Astro site end to end:
  commits the change on main with one conventional-commit subject, runs the CI checks locally,
  pushes directly to main, and verifies the GitHub Pages deploy. Invoke only when the user has
  explicitly requested merging, landing, or shipping a change (for example by choosing Merge
  Change or running /merge). Do not invoke it for reviewing, preparing, checking, or setting up
  skills.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Merge a change into `main`

Carry out the merge request that triggered this skill. Do not ask again whether to merge, and
do not stop to request permission the request already gave. Stop only for the blockers listed
under **Stopping**.

Making the local commit, or pushing it, is not completion. The change is merged only when it is
on `origin/main` and the Pages deploy for it succeeded.

## Facts verified against this repository

- `main` is unprotected and has no required reviews; history is linear, direct-to-`main`
  pushes, one conventional-commit subject per change (`feat:`, `fix:`, `content:`).
- Merging means pushing to `main` directly. No branch, pull request, or review step exists.
- CI job `Code standards & build` runs on `pull_request` only (`lint`, `format:check`,
  `build`) — `.github/workflows/ci.yml`. A direct push to `main` therefore gets no server-side
  verification: the local checks in step 3 are the verification and must pass before pushing.
- `Deploy to GitHub Pages` runs on every push to `main` and rebuilds there —
  `.github/workflows/deploy.yml`. It reports a broken build as a failed deploy, after the push.
- `.agents/prepare` runs `pnpm install` when Delta creates a checkout; an adopted or reused
  checkout may still have no `node_modules`.
- Runtime: Node `>=22.23.4`, pnpm `12.4.1` (`package.json` `engines`, `packageManager`).
- Scripts used below are defined in `package.json`.

## 1. Preflight

```sh
git rev-parse --show-toplevel
git status --short
gh auth status
gh repo view observerw/blogs --json name,defaultBranchRef,viewerPermission
node -v && pnpm -v
```

- Run everything from the repository root (the checkout containing `package.json` for `blog`).
- `defaultBranchRef.name` must be `main`; `viewerPermission` must allow pushing to it
  (`WRITE`, `MAINTAIN`, or `ADMIN`).
- `node -v` must satisfy `>=22.23.4`; `pnpm -v` should be `12.4.1`. If either is wrong, stop and
  report instead of substituting another package manager.
- If `gh auth status` is not logged in, stop and ask the user to authenticate.
- Note uncommitted files. Files unrelated to the requested change must stay out of the commit;
  if the change cannot be separated from unrelated edits, stop and ask which files belong to it.

## 2. Commit the change on `main`

```sh
git fetch origin
git switch main && git pull --ff-only origin main   # only when HEAD is not main
```

- The change lands as a commit on `main`, so bring the work onto `main` before committing: when
  HEAD was a feature branch, cherry-pick its commits onto the updated `main`
  (`git cherry-pick <sha>…`), handling routine overlaps automatically.
- Stage only the files that belong to the change (`git add <paths>`), never a blind `git add -A`.
- Commit with a conventional-commit subject in the repository's existing style, in the language
  of the surrounding history (`feat: …`, `fix: …`, `content: …`). No signing, no trailers.
- One commit per change: keep it a single commit, amending later fixes into it rather than
  stacking follow-ups.
- If the change is already committed on `main`, skip to step 3.

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

## 4. Push to `main`

```sh
git push origin main
```

- Nothing checks the push server-side, so do not push before step 3 passed on this exact commit.
- Never force-push `main`. If the push is rejected because `origin/main` moved, run
  `git pull --rebase origin main`, re-run the checks in step 3 that the rebase could affect, and
  push again.

## 5. Verify the result

```sh
git rev-parse HEAD
git log --oneline -3
gh run list --workflow=deploy.yml --branch main --limit 1 \
  --json databaseId,headSha,status,conclusion
```

- The newest `Deploy to GitHub Pages` run must be for the commit just pushed (`headSha` equals
  `git rev-parse HEAD`). If the push was a fast-forward, `origin/main` and local `main` match.
- If that deploy run is still in progress, watch it (`gh run watch <databaseId> --exit-status`).
  A failed deploy means the change is on `main` but not published — report both facts plainly,
  then fix the cause with another commit.

## Conflicts

- Routine mechanics — rebasing the change onto a moved `origin/main`, fast-forwarding,
  non-overlapping edits — are handled automatically without asking.
- A genuine conflict (overlapping edits whose intended result is not obvious) is a blocker: notify
  the user with the conflicting files and the competing changes, and leave the working tree
  untouched. Do not guess a resolution for content the user authored.

## Stopping

Stop and report that **the change has not been merged**, with the specific blocker, when:

- a local check from step 3 is failing or cannot be run;
- `gh`/`pnpm`/`node` are missing, unauthenticated, or the wrong version;
- a genuine conflict appears, or the intended resolution is ambiguous;
- unrelated uncommitted work would have to be included to proceed;
- the requested change cannot be identified from the request and the working tree.

## Report

On success, report: the commit on `main` (subject and SHA), that it was pushed to `origin/main`,
and that the Pages deploy for that commit succeeded. On a blocker, say explicitly what did not
merge and why.
