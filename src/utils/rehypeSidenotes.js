/**
 * Rehype plugin: turn GFM footnotes (`[^1]`) into Tufte-style sidenotes.
 *
 * remark-gfm has already parsed the footnotes by the time this runs, so the
 * tree contains:
 *   <sup><a data-footnote-ref href="#user-content-fn-1">1</a></sup>
 * and a `<section data-footnotes>` holding the definitions. We move each
 * definition next to the first reference (so it can be floated into the right
 * margin) and drop the trailing footnotes section.
 *
 * The markup follows the Tufte CSS trick: a hidden checkbox plus a label makes
 * each note toggleable on narrow screens without JavaScript. On wide screens
 * the note is simply always visible in the margin.
 *
 * Reference: https://edwardtufte.github.io/tufte-css/
 */

const isElement = (node, tagName) =>
  node?.type === "element" && node.tagName === tagName;

const hasProperty = (node, name) =>
  Boolean(node?.properties) &&
  Object.prototype.hasOwnProperty.call(node.properties, name);

const hasClass = (node, name) => {
  const value = node?.properties?.className;
  const classes = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\s+/)
      : [];
  return classes.includes(name);
};

const element = (tagName, properties, children = []) => ({
  type: "element",
  tagName,
  properties: properties ?? {},
  children,
});

const text = value => ({ type: "text", value });

const textContent = node => {
  if (node?.type === "text") return node.value;
  if (!node?.children) return "";
  return node.children.map(textContent).join("");
};

const isFootnoteSection = node =>
  isElement(node, "section") && hasProperty(node, "dataFootnotes");

const isFootnoteRef = node =>
  isElement(node, "a") && hasProperty(node, "dataFootnoteRef");

const isBackref = node =>
  isElement(node, "a") && hasProperty(node, "dataFootnoteBackref");

/** Block elements that cannot legally live inside a paragraph. */
const INLINE_REPLACEMENTS = {
  p: "span",
  ul: "span",
  ol: "span",
  li: "span",
  dl: "span",
  dt: "span",
  dd: "span",
};

const BLOCK_CLASSES = {
  p: "sidenote-p",
  ul: "sidenote-list",
  ol: "sidenote-list sidenote-ordered",
  li: "sidenote-li",
  dl: "sidenote-list",
  dt: "sidenote-term",
  dd: "sidenote-definition",
};

const isBlankText = node => node?.type === "text" && node.value.trim() === "";

/**
 * Drop whitespace at the beginning/end of a footnote, but keep whitespace
 * between inline elements (it separates words).
 */
const trimEdges = children => {
  const next = [...children];
  while (next.length > 0 && isBlankText(next[0])) next.shift();
  while (next.length > 0 && isBlankText(next[next.length - 1])) next.pop();

  if (next[0]?.type === "text") {
    next[0] = text(next[0].value.replace(/^\s+/, ""));
  }
  const last = next[next.length - 1];
  if (last?.type === "text") {
    next[next.length - 1] = text(last.value.replace(/\s+$/, ""));
  }
  return next;
};

/** Rewrite block-level note content into inline-safe spans. */
const toInline = node => {
  if (node.type !== "element") return node;
  if (isBackref(node)) return null;

  const tagName = INLINE_REPLACEMENTS[node.tagName];
  const children = trimEdges(
    (node.children ?? []).map(toInline).filter(Boolean)
  );

  if (!tagName) {
    return { ...node, children };
  }

  const className = [
    ...(BLOCK_CLASSES[node.tagName]
      ? BLOCK_CLASSES[node.tagName].split(" ")
      : []),
    ...(node.properties?.className ?? []),
  ];

  return element(tagName, { ...(node.properties ?? {}), className }, children);
};

/**
 * Pull the footnote definitions out of the tree and remove the footnotes
 * section. Returns a Map of element id (e.g. "user-content-fn-1") to the
 * note's inline children.
 */
const collectNotes = tree => {
  const notes = new Map();
  let section = null;
  let sectionParent = null;
  let sectionIndex = -1;

  const visit = node => {
    if (!node?.children || section) return;
    for (let index = 0; index < node.children.length; index++) {
      const child = node.children[index];
      if (isFootnoteSection(child)) {
        section = child;
        sectionParent = node;
        sectionIndex = index;
        return;
      }
      visit(child);
      if (section) return;
    }
  };

  visit(tree);
  if (!section) return notes;

  const list = section.children.find(child => isElement(child, "ol"));
  for (const item of list?.children ?? []) {
    if (!isElement(item, "li")) continue;
    const id = item.properties?.id;
    if (!id) continue;

    let children = trimEdges(
      (item.children ?? []).map(toInline).filter(Boolean)
    );

    // A single-paragraph note reads best as a continuous run of inline
    // content, so the note number can sit on the same line as the text.
    if (
      children.length === 1 &&
      isElement(children[0], "span") &&
      children[0].properties?.className?.includes("sidenote-p")
    ) {
      children = children[0].children;
    }

    notes.set(id, children);
  }

  sectionParent.children.splice(sectionIndex, 1);
  return notes;
};

const slugifyNoteId = id =>
  id
    .replace(/^user-content-/, "")
    .replace(/^fn-/, "")
    .replace(/[^A-Za-z0-9_-]/g, "-") || "note";

/**
 * The note becomes a block on narrow screens when it is expanded. If the
 * reference is followed by sentence punctuation, that punctuation would be
 * pushed onto a line of its own below the note. Pull it inside the group,
 * before the note, so it stays attached to the sentence.
 */
const TRAILING_PUNCTUATION = /^[。，、；：！？,.!?;:)\]）】》」』"'’”]+/;

const takeTrailingPunctuation = (node, index) => {
  const next = node.children[index + 1];
  if (next?.type !== "text") return null;

  const match = next.value.match(TRAILING_PUNCTUATION);
  if (!match) return null;

  next.value = next.value.slice(match[0].length);
  if (next.value === "") node.children.splice(index + 1, 1);
  return text(match[0]);
};

const replaceReferences = (node, notes, emitted) => {
  if (!node?.children) return;

  for (let index = 0; index < node.children.length; index++) {
    const child = node.children[index];

    if (isElement(child, "sup")) {
      const link = child.children.find(isFootnoteRef);
      const href = link?.properties?.href;
      const id =
        typeof href === "string" && href.startsWith("#") ? href.slice(1) : null;

      if (link && id && notes.has(id)) {
        const label = textContent(link).trim() || "1";
        const slug = slugifyNoteId(id);
        const noteId = `fn-${slug}`;
        const refId = `fnref-${slug}`;

        if (!emitted.has(id)) {
          emitted.add(id);

          const punctuation = takeTrailingPunctuation(node, index);
          const number = element(
            "span",
            { className: ["sidenote-number"], ariaHidden: "true" },
            [text(label)]
          );
          const bodyChildren = [...notes.get(id)];

          // In a multi-paragraph note the first block starts on a new line, so
          // the note number has to live inside that block to keep it inline.
          if (bodyChildren[0] && hasClass(bodyChildren[0], "sidenote-p")) {
            bodyChildren[0] = {
              ...bodyChildren[0],
              children: [number, ...bodyChildren[0].children],
            };
          } else {
            bodyChildren.unshift(number);
          }

          node.children[index] = element(
            "span",
            { className: ["sidenote-group"], id: refId },
            [
              element("input", {
                type: "checkbox",
                id: `sidenote-toggle-${slug}`,
                className: ["sidenote-toggle"],
                ariaLabel: `显示脚注 ${label}`,
              }),
              element(
                "label",
                {
                  htmlFor: `sidenote-toggle-${slug}`,
                  className: ["sidenote-ref"],
                  title: `脚注 ${label}`,
                },
                [text(label)]
              ),
              ...(punctuation ? [punctuation] : []),
              element("span", { className: ["sidenote"], id: noteId }, [
                element("span", { className: ["sidenote-body"] }, bodyChildren),
              ]),
            ]
          );
        } else {
          // Later references to the same note link to the rendered sidenote.
          node.children[index] = element(
            "sup",
            { className: ["sidenote-ref-wrap"] },
            [
              element(
                "a",
                { href: `#${noteId}`, className: ["sidenote-ref"] },
                [text(label)]
              ),
            ]
          );
        }
        continue;
      }
    }

    replaceReferences(child, notes, emitted);
  }
};

export const rehypeSidenotes = () => tree => {
  const notes = collectNotes(tree);
  if (notes.size === 0) return;
  replaceReferences(tree, notes, new Set());
};
