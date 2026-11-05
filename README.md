# observerw 的博客

基于 [AstroPaper](https://github.com/satnaing/astro-paper)（Astro + Tailwind CSS）的个人博客，部署在 GitHub Pages。

站点地址：<https://observerw.github.io/blogs/>

## 本地开发

需要 Node.js >= 22.23.4 和 pnpm。

```sh
pnpm install
pnpm dev
```

由于配置了 GitHub Pages 的子路径，开发服务器地址是 <http://localhost:4321/blogs/>。

常用命令：

| 命令           | 说明                                   |
| -------------- | -------------------------------------- |
| `pnpm dev`     | 启动开发服务器                         |
| `pnpm build`   | 类型检查、构建并生成 Pagefind 搜索索引 |
| `pnpm preview` | 预览构建产物                           |
| `pnpm format`  | 用 Prettier 格式化                     |
| `pnpm lint`    | 运行 ESLint                            |

## 目录结构

```text
.
├── astro-paper.config.ts   # 站点信息、社交链接、功能开关
├── astro.config.ts         # Astro 配置（base、i18n、Markdown）
├── public/                 # favicon、默认 OG 图等静态资源
└── src/
    ├── content/
    │   ├── posts/          # 文章
    │   └── pages/about.md  # 关于页
    ├── i18n/lang/          # 界面文案（zh-CN）
    ├── pages/              # 路由：首页、文章、标签、归档、搜索
    └── styles/             # 主题与排版样式
```

## 写文章

在 `src/content/posts/` 下新建 Markdown 文件，文件名为 URL slug：

```md
---
title: "文章标题"
pubDatetime: 2026-11-05T18:00:00+08:00
description: "文章摘要，用于列表和 SEO。"
tags: ["标签一", "标签二"]
draft: false
featured: false
---

正文从二级标题开始，页面会自动渲染一级标题。
```

正文支持 Markdown、MDX、GFM 表格、提示块（`> [!NOTE]`）和代码高亮。

## 部署

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages。首次使用时需要在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

仓库作为项目站点部署在 `/blogs/` 子路径下，因此 `astro.config.ts` 中设置了 `base: "/blogs"`。如果以后绑定自定义域名或改名为 `<user>.github.io`，记得同步修改 `site`、`base` 和 `astro-paper.config.ts` 中的 `site.url`。

## 致谢

主题来自 [satnaing/astro-paper](https://github.com/satnaing/astro-paper)，遵循 MIT License。
