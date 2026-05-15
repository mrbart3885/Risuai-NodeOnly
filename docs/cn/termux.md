<p align="center">
  <a href="../en/termux.md">English</a> | <a href="../ko/termux.md">한국어</a> | <a href="../de/termux.md">Deutsch</a> | <strong>简体中文</strong> | <a href="../es/termux.md">Español</a> | <a href="../vi/termux.md">Tiếng Việt</a> | <a href="../zh-Hant/termux.md">繁體中文</a>
</p>

# Termux 安装指南

> 🌐 此指南由机器翻译生成。如需获取最准确的信息,请参阅 [English](../en/termux.md) 或 [한국어](../ko/termux.md) 版本。

本指南介绍如何通过 Termux 在 Android 手机上直接构建并运行 PocketRisu。预期使用方式是在同一台手机的浏览器中打开 `http://localhost:6001`。

- [1. 准备工作](#1-准备工作) — F-Droid Termux 与系统要求
- [2. 安装与构建](#2-安装与构建) — 单条命令完成
- [3. 运行与连接](#3-运行与连接) — 从手机浏览器打开
- [4. 保持运行](#4-保持运行) — 屏幕关闭时也保持运行
- [5. 更新](#5-更新) — 获取最新版本
- [6. 限制](#6-限制) — 在 Termux 上无法使用的功能


## 系统要求

| 项目         | 最低         | 推荐                    |
| ------------ | ------------ | ----------------------- |
| **Android**  | 7.0 (API 24) | 10 或更新版本           |
| **CPU**      | ARM64        | ARM64                   |
| **内存**     | 2 GB         | 4 GB 或以上             |
| **可用存储** | 2 GB         | 4 GB 或以上(含构建产物) |

PocketRisu 不为 Termux 提供预编译的二进制文件,因此由手机自行构建。包括 `better-sqlite3` 等原生模块在内,构建大约需要 **10 至 40 分钟**,具体取决于手机性能。


---

## 1. 准备工作

### 使用 F-Droid 或 GitHub Releases 版本的 Termux

> ⚠️ **Play Store 版本的 Termux 无法使用。**
> Termux 维护者已于 2020 年停止更新 Play Store 版本,无法再安装 PocketRisu 所需的最新软件包(Node.js 22+)。

请从以下任一来源安装 Termux:

- **F-Droid(推荐)**: https://f-droid.org/packages/com.termux/
- **GitHub Releases**: https://github.com/termux/termux-app/releases

如果已经安装了 Play Store 版本,请先卸载,然后从上述任一来源重新安装。


---

## 2. 安装与构建

打开 Termux 并执行以下单条命令:

```bash
pkg install -y git && \
  git clone https://github.com/PocketRisu/PocketRisu.git && \
  cd PocketRisu && \
  bash scripts/termux/build.sh
```

该命令将自动完成:

1. 安装 `git`
2. 克隆 PocketRisu 仓库
3. 安装构建依赖(`nodejs-lts`、`python`、`make`、`clang`、`pnpm` 等)
4. `pnpm install` — JavaScript 依赖及原生模块编译
5. `pnpm build` — 前端打包

构建完成后会显示:

```
Build OK. Start the server with:
  node server/node/server.cjs

Then open this address in the phone's own browser:
  http://localhost:6001
```


---

## 3. 运行与连接

从同一目录启动服务器:

```bash
node server/node/server.cjs
```

服务器启动日志出现后,在手机浏览器(Chrome、Firefox 等)中访问:

```
http://localhost:6001
```

PocketRisu UI 应当正常加载。浏览器自动将 `localhost` 视为安全上下文(secure context),因此剪贴板、`crypto.subtle` 等需要安全上下文的 API 均可正常工作。

使用 `Ctrl + C` 停止服务器。


---

## 4. 保持运行

为了在屏幕关闭或切换到其他应用时保持服务器运行,请启用 Termux 的唤醒锁:

```bash
termux-wake-lock
```

Termux 通知栏会显示唤醒锁指示,即使屏幕关闭服务器也会继续运行。

释放命令: `termux-wake-unlock`

> 内存压力下 Android 仍可能终止 Termux。为了长时间运行,请在手机的电池优化设置中将 Termux 排除在外。


---

## 5. 更新

在 PocketRisu 目录下执行:

```bash
cd ~/PocketRisu
git pull
NODE_OPTIONS="--max-old-space-size=2048" pnpm build
```

如果依赖发生变更,`pnpm install` 会作为构建的一部分自动执行。构建完成后请重启服务器。


---

## 6. 限制

**Quick Tunnel(Cloudflare 自动隧道)在 Termux 上无法使用。** `cloudflared` 二进制文件与 Termux 的 DNS 和 TLS 环境不兼容。

PocketRisu 会自动检测 Termux 环境,在远程访问菜单中显示警告并隐藏启动按钮。


---

← [返回 README](../../i18n/README.cn.md)
