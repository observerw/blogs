---
title: "用 GitHub Actions 把 VitePress 部署到 GitHub Pages"
pubDatetime: 2026-11-05T10:00:00+08:00
description: "从 base 路径到 Actions 工作流，记录把 VitePress 站点发布到 GitHub Pages 的全过程和几个坑。"
tags: ["VitePress", "GitHub Pages", "CI"]
draft: false
featured: false
---

站点跑起来了，接下来是发布。GitHub Pages 免费、自带 HTTPS、和仓库天然集成，对个人博客来说几乎是最省心的选择。

官方文档 [Deploy → GitHub Pages](https://vitepress.dev/guide/deploy#github-pages) 给了完整的 `deploy.yml`，直接抄基本能跑。这篇记录我实际做的改动，以及为什么改。

## 第一步：设置 `base`

这是最容易忘、也最容易出错的一步。

仓库叫 `blogs`，站点地址是 `https://<user>.github.io/blogs/`，**不是**根路径。所以配置里必须写：

```ts
export default defineConfig({
  base: "/blogs/",
});
```

不设置会怎样？构建出来的 HTML 里资源路径是 `/assets/app.xxx.js`，浏览器去 `https://<user>.github.io/assets/...` 找文件，全站白屏、样式丢失。

验证方法很简单，构建后看产物里的路径：

```sh
pnpm run docs:build
grep -o 'src="[^"]*"' .vitepress/dist/index.html
```

看到 `/blogs/assets/...` 就对了。

> 如果以后绑定了自定义域名，或者仓库改名为 `<user>.github.io`，记得把 `base` 去掉。

## 第二步：工作流

官方模板的结构是：一个 `build` job 产出静态文件并上传，一个 `deploy` job 把 artifact 发布到 Pages。权限和并发控制是关键部分：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false
```

`concurrency` 里 `cancel-in-progress: false` 是刻意的——部署跑到一半被新提交取消，容易出现站点处于半更新状态。

我这份工作流相对官方示例改了三处：

**1. 路径去掉了 `docs/` 前缀**

本项目把内容放在仓库根目录，所以产物是 `.vitepress/dist`，缓存目录是 `.vitepress/cache`。如果哪天把文档挪进 `docs/`，这两处和 `docs:build` 脚本都要一起改。

**2. 用 pnpm 安装**

项目用 pnpm 管理依赖，CI 里也要一致，否则 lockfile 不同、依赖版本会漂移：

```yaml
- name: Setup pnpm
  uses: pnpm/action-setup@v6
  with:
    version: 12
- name: Setup Node
  uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: pnpm
- run: pnpm install --frozen-lockfile
```

`--frozen-lockfile` 很重要：lockfile 和 `package.json` 不一致时直接失败，而不是悄悄装出一个不同的依赖树。

**3. 升级 action 版本**

按官方模板跑第一次，日志里全是这样的警告：

```text
Node.js 20 is deprecated. The following actions target Node.js 20 but are being
forced to run on Node.js 24: actions/cache@v4, actions/configure-pages@v4,
actions/upload-pages-artifact@v3, pnpm/action-setup@v4
```

这些 action 的旧主版本声明了 Node 20 运行时。虽然目前只是被强制提升到 Node 24 继续跑，但迟早会失效。查一遍各自仓库的最新 release 后升到 `cache@v6`、`configure-pages@v6`、`upload-pages-artifact@v5`、`deploy-pages@v5`，警告消失，构建照常通过。

升级 action 主版本时要顺手看一眼 changelog 里有没有输入参数改名，这里是兼容的。

## 第三步：打开 Pages

仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。

注意这里不要选「Deploy from a branch」：那是旧的 Jekyll 式发布，和 Actions 上传 artifact 的方式冲突。用命令行也可以：

```sh
gh api --method POST repos/<user>/<repo>/pages -f build_type=workflow
```

## 验证

部署完成后，Actions 的 `deploy` job 会打印 `page_url`。也可以直接戳几个地址：

| 路径                            | 期望                |
| ------------------------------- | ------------------- |
| `/blogs/`                       | 200                 |
| `/blogs/posts/hello-world.html` | 200                 |
| `/blogs/sitemap.xml`            | 200                 |
| `/blogs/feed.xml`               | 200                 |
| `/blogs/does-not-exist`         | 404 + 自定义 404 页 |

一个细节：默认情况下 VitePress 生成的是 `xxx.html` 而不是 `xxx/`，GitHub Pages 不做 URL 重写，所以**不要**打开 `cleanUrls`，否则站内链接会 404。

## 小结

整套流程其实只有三件事：`base` 写对、workflow 权限写对、Pages 源选对。剩下的坑都在细节里——缓存目录、锁文件、action 版本、cleanUrls。踩过一遍之后，推送即发布，剩下的时间可以专心写内容了。
