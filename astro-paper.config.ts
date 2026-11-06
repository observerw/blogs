import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    // GitHub Pages 项目站点地址（仓库名 blogs），同时也是 RSS / sitemap 的绝对 URL 前缀
    url: "https://observerw.github.io/blogs/",
    title: "",
    description: "",
    author: "observerw",
    profile: "https://github.com/observerw",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 6,
    perIndex: 5,
  },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/observerw/blogs/edit/main/",
    },
    search: "pagefind",
  },
  socials: [
    {
      name: "github",
      url: "https://github.com/observerw",
      linkTitle: "observerw 的 GitHub",
    },
  ],
  shareLinks: [
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
