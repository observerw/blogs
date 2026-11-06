/**
 * Remark plugin: render BibTeX citations as footnotes.
 *
 * Writing `[@citekey]` (or `[@a; @b]`) in a post turns the matching entry of
 * the bibliography into a footnote. The plugin emits ordinary mdast footnote
 * nodes, so nothing downstream changes: footnotes are numbered in reference
 * order, `rehypeSidenotes` floats each note into the right margin, and
 * citations and hand-written `[^notes]` share one sequence.
 *
 * Entries are formatted by the small rule set below instead of citeproc/CSL. A
 * note in the margin only has to identify the source, and a CSL engine plus its
 * style files would be a large dependency for that.
 */
import fs from "node:fs";
import { toJSON } from "bibtex-parse-js";

const MARKER = /\[@([^\]]+)\]/g;

/** Elements whose text must not get footnote markers spliced into them. */
const SKIP = new Set(["link", "linkReference", "image", "imageReference"]);

/**
 * Read the .bib file for every page. It is a few KB, and reading it on demand
 * means edits to it show up without a restart.
 *
 * `bibtex-parse-js` does not know about `%` comments, which BibTeX allows on
 * their own lines, so they are removed before parsing.
 */
const readBibliography = file => {
  const source = fs.readFileSync(file, "utf8").replace(/^\s*%.*$/gm, "");
  const entries = new Map();
  for (const entry of toJSON(source)) {
    entries.set(entry.citationKey, {
      type: String(entry.entryType ?? "").toLowerCase(),
      tags: entry.entryTags ?? {},
    });
  }

  return entries;
};

/** Drop the LaTeX that shows up in real .bib files. */
const clean = value =>
  String(value ?? "")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/\\([A-Za-z]+)/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** "Turing, Alan M." -> "Alan M. Turing"; "King, Jr., Martin" keeps the suffix. */
const name = value => {
  const [last, ...rest] = clean(value).split(",");
  const first = rest.pop()?.trim() ?? "";
  const suffix = rest.pop()?.trim() ?? "";
  return [first, last.trim(), suffix].filter(Boolean).join(" ");
};

const authors = value =>
  clean(value)
    .split(/\s+and\s+/i)
    .map(name)
    .join("、");

const ordinal = value => {
  const number = Number.parseInt(clean(value), 10);
  if (!Number.isFinite(number)) return "";
  const mod100 = number % 100;
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th";
  return `${number}${suffix} ed`;
};

const pages = value => clean(value).replace(/-+/g, "–");

const volumeIssue = tags => {
  const volume = clean(tags.volume);
  const issue = clean(tags.number || tags.issue);
  if (volume && issue) return `${volume}(${issue})`;
  return volume || issue;
};

/**
 * One line identifying the source, without the trailing period or the link.
 * Order follows the usual reading order: who, what, where, when.
 */
const describe = ({ type, tags }) => {
  const year = clean(tags.year || tags.date).slice(0, 4);
  const segments = [];

  if (tags.author) segments.push(authors(tags.author));
  if (tags.title) segments.push(clean(tags.title));

  const edition = ordinal(tags.edition);
  if (edition && (type === "book" || type === "inbook")) segments.push(edition);

  const venue = clean(tags.journal || tags.journaltitle || tags.booktitle);
  const volume = volumeIssue(tags);
  const pageRange = pages(tags.pages);
  const publisher = [
    clean(tags.address || tags.location),
    clean(tags.publisher),
  ]
    .filter(Boolean)
    .join(": ");
  const school = clean(tags.school || tags.institution);

  let source = "";
  if (type === "article") {
    source = [
      [venue, [volume, pageRange].filter(Boolean).join(": ")]
        .filter(Boolean)
        .join(", "),
      year,
    ];
  } else if (type === "inproceedings" || type === "incollection") {
    source = [
      [venue && `In ${venue}`, pageRange].filter(Boolean).join(", "),
      year,
    ];
  } else if (type === "book" || type === "inbook") {
    source = [publisher, year];
  } else if (
    type === "phdthesis" ||
    type === "mastersthesis" ||
    type === "thesis"
  ) {
    source = [school, year];
  } else {
    source = [year];
  }

  const where = source.filter(Boolean).join(", ");
  if (where) segments.push(where);

  // Segments already ending in a period ("Jr.") would otherwise produce "..".
  return segments
    .filter(Boolean)
    .map(segment => segment.replace(/\.$/, ""))
    .join(". ");
};

/** DOI wins over URL: it is the stable identifier readers can resolve. */
const target = ({ tags }) => {
  const doi = clean(tags.doi);
  if (doi) return `https://doi.org/${doi}`;
  const url = clean(tags.url || tags.howpublished);
  return /^https?:\/\//.test(url) ? url : "";
};

/** The note body: the formatted entry, then a link when the entry has one. */
const noteChildren = entry => {
  const children = [{ type: "text", value: `${describe(entry)}.` }];
  const url = target(entry);
  if (url) {
    children.push(
      { type: "text", value: " " },
      { type: "link", url, children: [{ type: "text", value: url }] }
    );
  }
  return children;
};

/** `[@a; @b]` -> one footnote reference per key. */
const citekeys = value =>
  value
    .split(";")
    .map(key => key.trim().replace(/^@/, ""))
    .filter(Boolean);

export const remarkCitations = options => {
  const file = options?.bibliography;
  if (!file) {
    throw new Error("remarkCitations: the `bibliography` option is required");
  }

  return (tree, vfile) => {
    const entries = readBibliography(file);

    /** Footnote definitions in first-citation order. */
    const definitions = new Map();

    const definition = key => {
      if (definitions.has(key)) return;

      const entry = entries.get(key);
      if (!entry) {
        throw new Error(
          `Unknown citation \`${key}\`${vfile?.path ? ` in ${vfile.path}` : ""}. ` +
            `Add the entry to ${file}.`
        );
      }

      definitions.set(key, {
        type: "footnoteDefinition",
        identifier: `cite-${key}`,
        label: key,
        children: [{ type: "paragraph", children: noteChildren(entry) }],
      });
    };

    const markerChildren = value => {
      const children = [];
      citekeys(value).forEach(key => {
        definition(key);
        children.push({
          type: "footnoteReference",
          identifier: `cite-${key}`,
          label: key,
        });
      });
      return children;
    };

    const visit = node => {
      if (!node?.children) return;

      for (let index = 0; index < node.children.length; index++) {
        const child = node.children[index];
        if (SKIP.has(child.type)) continue;

        if (child.type !== "text" || !child.value.includes("[@")) {
          visit(child);
          continue;
        }

        const value = child.value;
        const replacement = [];
        let last = 0;
        let match;
        MARKER.lastIndex = 0;

        while ((match = MARKER.exec(value))) {
          if (match.index > last) {
            replacement.push({
              type: "text",
              value: value.slice(last, match.index),
            });
          }
          replacement.push(...markerChildren(match[1]));
          last = match.index + match[0].length;
        }

        if (last === 0) continue;
        if (last < value.length) {
          replacement.push({ type: "text", value: value.slice(last) });
        }

        node.children.splice(index, 1, ...replacement);
        index += replacement.length - 1;
      }
    };

    visit(tree);
    if (definitions.size > 0) tree.children.push(...definitions.values());
  };
};
