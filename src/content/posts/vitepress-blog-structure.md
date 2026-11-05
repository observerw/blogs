---
title: "用 VitePress 搭一个真正的博客"
pubDatetime: 2026-11-04T10:00:00+08:00
description: "VitePress 官方没有博客模板，但它的内容加载 API 足够搭出文章列表、标签页和归档页。"
tags: ["VitePress", "Vue"]
draft: false
featured: false
---

VitePress 官方文档在 [Use Cases](https://vitepress.dev/guide/what-is-vitepress#use-cases) 里写得很直白：

> VitePress ships with a default theme designed for technical documentation. ... Blogs, Portfolios, and Marketing Sites: VitePress supports fully customized themes ... In addition, VitePress provides flexible APIs to load data (local or remote) and dynamically generate routes.

也就是说，博客不是「没提供」，而是**官方希望你用 API 自己拼**。官方 Vue 博客 `blog.vuejs.org` 就是这么做的。

## 目录结构

核心是两个东西：文章目录，和一个内容加载器。

```text
.
├─ posts/                 # 所有文章
│  ├─ index.md            # 文章列表页（本身不是文章）
│  └─ hello-world.md
├─ posts.data.ts          # 内容加载器
├─ tags/
│  ├─ index.md            # 标签总览
│  ├─ [tag].md            # 标签页模板
│  └─ [tag].paths.ts      # 标签页路由生成
├─ archive.md             # 归档
└─ .vitepress/
   ├─ config.mts
   └─ theme/
      ├─ index.ts
      └─ components/PostList.vue
```

## 内容加载器：`createContentLoader`

官方提供的 `createContentLoader` 会扫描 Markdown、读取 frontmatter，并在构建时把结果内联成 JSON：

```ts
// posts.data.ts
import { createContentLoader } from "vitepress";

export interface Post {
  url: string;
  title: string;
  date: string;
  tags: string[];
  description: string;
}

declare const data: Post[];
export { data };

export default createContentLoader("posts/*.md", {
  transform(raw): Post[] {
    return raw
      .filter(({ url }) => url !== "/posts/")
      .map(({ url, frontmatter }) => ({
        url,
        title: frontmatter.title,
        date: String(frontmatter.date).slice(0, 10),
        tags: frontmatter.tags ?? [],
        description: frontmatter.description ?? "",
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
});
```

两个细节值得注意：

- `url` **不包含 `base`**，渲染链接时要用 `withBase()`；
- `transform` 的返回值会被内联进客户端包，所以只挑需要的字段，别把正文 HTML 一起塞进去。

组件里直接当作数据源使用：

```vue
<script setup lang="ts">
import { withBase } from "vitepress";
import { data as posts } from "../../../posts.data";
</script>

<template>
  <a v-for="post in posts" :key="post.url" :href="withBase(post.url)">
    {{ post.title }}
  </a>
</template>
```

首页则是 `layout: home` 加上一段 Markdown，在正文里放列表组件——首页布局会渲染 Markdown 内容，这一点官方模板里没有写明，但 `VPHome` 的实现是支持的。

## 标签页：动态路由

标签数量是随文章变的，不可能手写一堆页面。官方 [Dynamic Routes](https://vitepress.dev/guide/routing#dynamic-routes) 的约定是：`[tag].md` 配一个 `[tag].paths.ts`，后者在构建时返回所有路径参数。

```ts
// tags/[tag].paths.ts
import { createContentLoader } from "vitepress";
import { slugify } from "../.vitepress/slug";

export default {
  watch: ["../posts/*.md"],
  async paths() {
    const posts = await createContentLoader("posts/*.md").load();
    const tags = new Map<string, string>();

    for (const post of posts) {
      for (const tag of post.frontmatter.tags ?? []) {
        tags.set(slugify(tag), tag);
      }
    }

    return [...tags].map(([slug, name]) => ({ params: { tag: slug, name } }));
  },
};
```

模板里通过 `$params` 拿到参数：

```md
# 标签：{{ $params.name }}

<PostList :tag="$params.name" />
```

注意 `paths()` 里复用 `createContentLoader` 的前提是「VitePress 配置已解析」——paths 文件是在 `resolvePages` 阶段被加载的，那时确实已经就绪，所以可以放心用。

## 文章元信息：layout slot

默认主题的 `doc-before` 插槽可以往正文前插入内容，正好用来显示日期和标签：

```ts
// .vitepress/theme/index.ts
import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import DocMeta from "./components/DocMeta.vue";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-before": () => h(DocMeta),
    }),
};
```

组件内部用 `useData()` 判断当前页是否在 `posts/` 下，避免在普通页面上也显示。

## 顺带解决的小事

- **RSS**：没有官方插件，用 `buildEnd` 钩子在构建结束后写一个 `feed.xml` 即可；
- **sitemap**：`sitemap: { hostname }` 一行配置，构建时自动生成；
- **中文界面**：`lang: 'zh-CN'` 加上 `docFooter`、`outline.label`、`lastUpdated.text` 等文案覆盖。

下一篇写部署：GitHub Pages 的子路径 `base`、Actions 工作流，以及几个容易踩的坑。
