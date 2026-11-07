import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import llms from "astro-llms-md";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkMath from "remark-math";
import rehypeCallouts from "rehype-callouts";
import rehypeKatex from "rehype-katex";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { rehypeTableWrapper } from "./src/utils/rehypeTableWrapper";
import { rehypeSidenotes } from "./src/utils/rehypeSidenotes";
import { remarkCitations } from "./src/utils/remarkCitations";
import config from "./astro-paper.config";

// GitHub Pages serves this project site under /blogs/. Local dev starts at the
// root instead, so pages are reachable as /posts/... without the prefix.
const isDev = process.env.NODE_ENV === "development";

export default defineConfig({
  site: config.site.url,
  base: isDev ? "/" : "/blogs",
  integrations: [
    mdx(),
    sitemap({
      // `search` and `font-preview` are tool pages (both noindex), so they stay
      // reachable but have no business in a content sitemap.
      filter: page =>
        !/\/(search|font-preview)\/?$/.test(page) &&
        (config.features?.showArchives !== false ||
          !/\/archives\/?$/.test(page)),
    }),
    // Generate /llms.txt, /llms-full.txt and one .md file per page after build,
    // so readers and AI agents can consume the posts as plain Markdown.
    llms({
      siteUrl: config.site.url,
      name: config.site.title,
      description: config.site.description,
      titleSelector: "h1",
      contentSelector: "#article",
      // KaTeX renders each formula twice (visual HTML + MathML with the TeX
      // source). Keeping only the MathML lets the export retain the formula.
      excludeSelectors: [".katex-html", ".katex-mathml mrow"],
      exclude: ["404", "search", "font-preview", "tags", "posts/[0-9]*/**"],
    }),
  ],
  i18n: {
    locales: ["zh-CN"],
    defaultLocale: "zh-CN",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
        remarkMath,
        // `[@citekey]` becomes a footnote, which rehypeSidenotes floats into
        // the margin on wide screens.
        [remarkCitations, { bibliography: "src/content/references.bib" }],
      ],
      rehypePlugins: [
        rehypeCallouts,
        rehypeTableWrapper,
        rehypeSidenotes,
        rehypeKatex,
      ],
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      // 中文：思源宋体的 Google 版本 Noto Serif SC
      name: "Noto Serif SC",
      cssVariable: "--font-noto-serif-sc",
      provider: fontProviders.fontsource(),
      weights: [400, 600, 700],
      styles: ["normal"],
      subsets: ["chinese-simplified", "latin"],
      formats: ["woff2"],
      fallbacks: [],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
