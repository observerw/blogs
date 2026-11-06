import type { APIRoute } from "astro";

const getRobotsTxt = (sitemapURL: URL, llmsURL: URL) => `
# Machine-readable index for LLM/agent tools: ${llmsURL.href}
# AI crawlers are welcome to read the site.

User-agent: *
Allow: /

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  const llmsURL = new URL("llms.txt", site);
  return new Response(getRobotsTxt(sitemapURL, llmsURL), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
