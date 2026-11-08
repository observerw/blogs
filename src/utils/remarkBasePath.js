/**
 * Remark plugin: prefix root-relative links with the site base.
 *
 * The site is served from `/blogs` on GitHub Pages but from `/` on the dev
 * server, while a link written in Markdown is just `/posts/foo`. Prefixing here
 * lets posts link to each other with plain Markdown links.
 */
export const remarkBasePath =
  ({ base = "/" } = {}) =>
  tree => {
    const prefix = base.replace(/\/$/, "");
    if (!prefix) return;

    const walk = node => {
      // `//host` is protocol-relative, not a site-local path.
      if (
        node.type === "link" &&
        node.url.startsWith("/") &&
        !node.url.startsWith("//")
      ) {
        node.url = prefix + node.url;
      }
      node.children?.forEach(walk);
    };

    walk(tree);
  };
