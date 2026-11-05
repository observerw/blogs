---
title: "使用 k8s 部署云原生 EDA 集群"
pubDatetime: 2026-11-05T18:00:00+08:00
description: "在课题组 H200 服务器集群上用 Kubernetes 部署云原生 EDA 工具链的记录。"
tags: ["EDA", "Kubernetes", "Cloud Native"]
draft: false
featured: false
---

# 背景

课题组提供了一个服务器集群，包含 11 台服务器。虽然主要是用来做 GPU 相关工作的，但服务器上的其他硬件资源其实也非常充足：

- CPU：2 x Intel Xeon Platinum 8558P，共计 96 核心 192 线程，主频 2.70 GHz
- 内存：32 × 64 GB DDR5，共计 2 TB
- 存储：4 × 7 TB NVMe Memblaze P6531DT
- 共享存储：101 TB GPFS 挂载
- 操作系统：Ubuntu 22.04.5 LTS

虽然 CPU 单核性能不算顶尖，但胜在数量众多，而且内存和存储等资源也非常够用；因此非常适合用来大规模并行跑中小型 RTL 设计的 EDA 综合仿真等流程。

虽然对传统芯片设计工作流程来说这种特性基本上没什么用（没有团队会同时开发几万款芯片且需要一起跑仿真），但对于 Agentic EDA 来说是完美适配的：想要通过 Agentic RL 训练专用于芯片设计的 Agent，那么环境的 scale up 就是不可绕过的需求。

为此，把 EDA 工具链部署到 Kubernetes 上来构建 Cloud Native EDA 集群是非常有必要的。

# EDA 工具的镜像构建

所有的 EDA 工具容器基本上都要一些基础的运行环境：

```dockerfile file=Dockerfile.runtime
ARG ALMA=almalinux:8.10
FROM ${ALMA}

RUN sed -i -e 's|^mirrorlist=|#mirrorlist=|' \
           -e 's|^# baseurl=https://repo.almalinux.org|baseurl=https://mirrors.cloud.tencent.com|' \
           /etc/yum.repos.d/almalinux.repo

RUN dnf -y --disablerepo='*' --enablerepo=baseos,appstream \
        --setopt=install_weak_deps=False install \
        glibc glibc-langpack-en libgcc libstdc++ libgomp \
        zlib ncurses ncurses-libs readline \
        nss nspr nss-util krb5-libs openssl-libs \
        libX11 libXext libXft libXrender libXi libXtst libXrandr \
        libXau libXdmcp libXcomposite libXdamage libXcursor libXfixes \
        libXt libXmu libXpm libXScrnSaver \
        libSM libICE \
        mesa-libGL libglvnd-glx libglvnd-egl libdrm \
        fontconfig freetype graphite2 \
        alsa-lib pciutils-libs libaio libnsl numactl-libs \
        tcsh ksh bash which findutils procps-ng util-linux \
        iproute hostname tzdata ca-certificates \
 && dnf clean all

RUN mkdir -p /opt/synopsys /work

ENV LANG=en_US.UTF-8 \
    SNPSLMD_LICENSE_FILE=2700@lic1 \
    LM_LICENSE_FILE=2700@lic1

WORKDIR /work
```
