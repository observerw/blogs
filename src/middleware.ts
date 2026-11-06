import { defineMiddleware } from "astro:middleware";
import { generateMarkdownFile, processHtml } from "astro-llms-md";
import config from "@/config";

// Match the options passed to `llms()` in astro.config.ts so the dev response
// is identical to the .md file emitted at build time.
const LLMS_OPTIONS = {
  title_selector: "h1",
  content_selector: "#article",
  exclude_selectors: [".katex-html", ".katex-mathml mrow"],
};

/**
 * astro-llms-md only writes its .md files in `astro:build:done`, so the URLs
 * 404 while running `astro dev`. Render the page on demand and reuse the
 * package's own HTML -> Markdown converter to bridge that gap. Production is
 * untouched: the static build still serves the generated files.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  if (!import.meta.env.DEV) return next();

  const { pathname } = context.url;
  if (!pathname.endsWith(".md")) return next();

  const pageURL = new URL(`${pathname.slice(0, -".md".length)}/`, context.url);
  const response = await fetch(pageURL);
  if (!response.ok) return next();

  const { title, description, content } = await processHtml(
    await response.text(),
    LLMS_OPTIONS
  );
  if (!title) return next();

  const markdown = generateMarkdownFile(
    {
      urlPath: pageURL.pathname.replace(/\/$/, ""),
      filePath: null,
      source: "ssr",
      title,
      description,
      content,
    },
    config.site.url.replace(/\/$/, "")
  );

  return new Response(markdown, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
});
