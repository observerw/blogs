// 简历的排版版本，由 `pnpm build:pdf` 编译成 public/resume.pdf。
// 网页版是 src/content/pages/resume.mdx，两份内容需要手动同步；
// 这里把「基本信息」放进了页眉，其余章节与网页版保持一致。

#set document(title: "王博伟的简历", author: "王博伟")
#set page(paper: "a4", margin: (x: 1.7cm, y: 1.5cm))
// 拉丁文字用 Typst 自带的 Libertinus Serif，中文回退到宋体族：CI 里装的是
// fonts-noto-cjk，本机 macOS 上是 Songti SC，缺字体时 Typst 会给出警告并跳过。
#set text(
  font: (
    "Libertinus Serif",
    "Noto Serif CJK SC",
    "Noto Sans CJK SC",
    "Songti SC",
    "STSong",
  ),
  size: 11pt,
  lang: "zh",
  region: "cn",
)
#set par(justify: true, leading: 0.85em, spacing: 1.2em)
#set list(indent: 1.2em, spacing: 0.35em)
#show link: underline
#show heading.where(level: 1): it => block(
  above: 1.8em,
  below: 0.4em,
  stack(
    spacing: 0.45em,
    text(size: 13pt, weight: "bold", it.body),
    line(length: 100%, stroke: 0.6pt + luma(150)),
  ),
)

// 项目条目：加粗标题占一行，正文另起。
#let entry(title, body) = block(
  above: 1.5em,
  below: 0.2em,
  stack(spacing: 0.4em, [*#title*], body),
)

#align(center)[
  #text(size: 20pt, weight: "bold")[王博伟]
  #v(0.5em)
  #text(size: 9.5pt)[
    #link("mailto:wangbowei@nudt.edu.cn")[wangbowei\@nudt.edu.cn] ·
    #link("https://github.com/observerw")[github.com/observerw] ·
    #link("https://observerw.github.io/blogs/")[observerw.github.io/blogs]
  ]
]

#v(0.6em)

软件工程博士生，研究方向为基于大语言模型的处理器设计自动化，平时关注 EDA
工具链与 Linux 基础设施的工程实践。

= 教育经历

*国防科技大学* · 计算机学院 · 软件工程 · 2023 级直博生（在读）

= 研究方向

- 基于大语言模型的处理器增量设计：RTL 生成与时序优化
- EDA 工具链的容器化与集群调度

= 工程项目

#entry("云原生 Agentic EDA 集群")[
  把课题组 11 台服务器的集群改造成 Kubernetes 平台：EDA 工具链容器化、LVM
  存储分层、Samba 多用户共享，让 Agent 和人一样按需申请算力。
]

#entry("基于 LVM 的 4 盘位多用户 NAS")[
  用 LVM thin pool 把四块 7.3 TB 硬盘划分为重要数据与资源盘，配合 Samba
  权限隔离和脚本化备份，供多人长期共用。
]

#entry("本站")[
  Astro + MDX 的静态博客：Pagefind 全文搜索、BibTeX 引注，简历另有一份由 Typst
  排版的 PDF。
]

= 技术栈

- 系统与云原生：Linux、Kubernetes、Docker、LVM、Samba
- 硬件设计：VCS 等 Synopsys EDA 工具的部署与批处理
- 写作与排版：Markdown、MDX、Typst、Astro
