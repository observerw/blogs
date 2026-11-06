# observerw 的博客

基于 [AstroPaper](https://github.com/satnaing/astro-paper)（Astro + Tailwind CSS）的个人博客，部署在 GitHub Pages。

站点地址：<https://observerw.github.io/blogs/>

## 本地开发

需要 Node.js >= 22.23.4 和 pnpm。

```sh
pnpm install
pnpm dev
```

开发服务器从根路径启动，地址是 <http://localhost:4321/>；生产构建仍会带上 GitHub Pages 的 `/blogs/` 前缀。

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
    │   ├── references.bib  # 参考文献库，文章里用 [@citekey] 引用
    │   └── pages/about.mdx # 关于页
    ├── i18n/lang/          # 界面文案（zh-CN）
    ├── pages/              # 路由：首页、文章、标签、归档、搜索
    └── styles/             # 主题与排版样式
```

## AI 与 Markdown

站点使用 [`astro-llms-md`](https://github.com/tfmurad/astro-llms-md) 在构建时生成 AI 友好的内容：

- `/llms.txt`：全站文章索引，遵循 [llms.txt 规范](https://llmstxt.org/)
- `/llms-full.txt`：所有页面正文合并成一个大文件
- `/posts/<slug>.md`：每篇文章对应的纯 Markdown 版本

文章底部的「复制 Markdown」按钮会直接取对应的 `.md` 文件写入剪贴板。页面的 `<head>` 里也有 `rel="alternate" type="text/markdown"` 和 `rel="describedby"` 链接，方便人和 Agent 发现这些文件。`robots.txt` 同样指向 `llms.txt`。

`llms.txt`、`llms-full.txt` 和构建产物里的 `.md` 都在 `astro build` 之后生成。开发模式下 `src/middleware.ts` 会按需渲染文章，并复用 `astro-llms-md` 自带的 HTML→Markdown 转换器，所以 `/posts/<slug>.md` 和「复制 Markdown」按钮在 `pnpm dev` 下也能直接使用；`llms.txt` / `llms-full.txt` 仍以构建产物为准。生成选项（站点名、简介、选择器、排除页面）在 `astro.config.ts` 的 `llms()` 调用里，开发中间件复用同一组选择器。

## 写文章

在 `src/content/posts/` 下新建 `.mdx` 文件，文件名为 URL slug：

```mdx
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

### 附件

图片和文本附件放在 `src/assets/attachments/<文章 slug>/`，在文章里 import。不要放进 `public/`，也不要放进 `src/content/posts/`（那里的 `.md` 会被当成文章，构建直接失败）。

```mdx
import { Image } from "astro:assets";
import shot from "@attach/my-post/screenshot.png";
import output from "@attach/my-post/output.log?url&no-inline";

<Image src={shot} alt="截图" width={800} />

<a href={output} download="output.log">
  下载完整日志
</a>
```

`@attach/*` 指向 `src/assets/attachments/`，见 `tsconfig.json`。图片会自动转 webp，文件名带内容 hash，并自动加上 `/blogs` 前缀。文本附件要用 `?url&no-inline` 才会生成真实 URL，否则小于 4 KB 的文件会被内联成 base64；`.md`、`.log` 这类扩展名必须带 `?url`，否则会被当成 JS 解析而导致构建失败。

### 脚注与侧注

用标准 GFM 脚注语法写注释即可：

```md
LoRA 只训练一个低秩适配器，原始权重保持不变[^1]。

[^1]: 这是脚注内容，也可以放 [链接](https://example.com) 和 `行内代码`。
```

阅读页会把脚注渲染成 Tufte 风格的**侧注**：宽屏（≥ 1280px）下注释浮动在正文右侧的页边，与引用处在同一水平线上；窄屏下注释收进正文，点击引用编号展开。实现见 `src/utils/rehypeSidenotes.js`，版式见 `src/styles/post.css`。

### 引用文献

参考文献统一放在 `src/content/references.bib`，正文里用 `[@citekey]` 引用，一个标记里可以并列多个键：

```md
Tufte 把页边注释当成版面的一部分[@tufte1990]。
字形和页边可以分开讨论[@bringhurst2004; @knuth1984]。
```

引用渲染成脚注，和手写的 `[^1]` 共用同一套编号，宽屏下也同样浮动在右侧页边。条目按「作者. 标题. 出处, 年份」的固定顺序拼出来，有 `doi` 或 `url` 字段时附在末尾作为链接；键名写错会在构建时直接报错。实现见 `src/utils/remarkCitations.js`，文献库路径是 `astro.config.ts` 里 `remarkCitations` 的 `bibliography` 选项。

## 部署

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会自动构建并发布到 GitHub Pages。首次使用时需要在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

仓库作为项目站点部署在 `/blogs/` 子路径下，因此 `astro.config.ts` 中设置了 `base: "/blogs"`。如果以后绑定自定义域名或改名为 `<user>.github.io`，记得同步修改 `site`、`base` 和 `astro-paper.config.ts` 中的 `site.url`。

## 致谢

主题来自 [satnaing/astro-paper](https://github.com/satnaing/astro-paper)，遵循 MIT License。
