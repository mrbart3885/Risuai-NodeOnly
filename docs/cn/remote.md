<p align="center">
  <a href="../en/remote.md">English</a> | <a href="../ko/remote.md">한국어</a> | <a href="../de/remote.md">Deutsch</a> | <strong>简体中文</strong> | <a href="../es/remote.md">Español</a> | <a href="../vi/remote.md">Tiếng Việt</a> | <a href="../zh-Hant/remote.md">繁體中文</a>
</p>

# 远程访问指南

> 🌐 此指南由机器翻译生成。如需获取最准确的信息,请参阅 [English](../en/remote.md) 或 [한국어](../ko/remote.md) 版本。

从其他设备(智能手机、平板、其他 PC)访问运行在 PC 上的 PocketRisu 有两种方式。

- [1. Quick Tunnel](#1-quick-tunnel) — PocketRisu 内置功能。无需额外应用。服务器重启时 URL 变更。
- [2. Tailscale](#2-tailscale) — 基于私有网络(VPN)。URL 固定。


## 1. Quick Tunnel

PocketRisu 内置的临时远程访问 URL 发放功能。

1. 在 PC 上 PocketRisu 中:设置 > 远程访问 > "打开远程访问"
2. 用智能手机相机扫描显示的二维码,或在其他设备的浏览器中直接输入 URL。

> 服务器重启时 URL 会变更。如需固定 URL,请使用 [Tailscale](#2-tailscale)。


---

## 2. Tailscale

构建只能从使用同一账号登录的设备访问的私有网络(VPN)。即使服务器重启,URL 也保持不变。

### 步骤 1: 安装 Tailscale

- PC: [tailscale.com](https://tailscale.com/)
- 智能手机: App Store / Google Play 中搜索 "Tailscale"
- 其他 PC: 同样 [tailscale.com](https://tailscale.com/)

### 步骤 2: 使用同一账号登录

在 PC 和所有要访问的设备的 Tailscale 应用中使用同一账号(Google、Microsoft 等)登录。

### 步骤 3: 在 PC 上启用 HTTPS 共享

在运行 PocketRisu 的 PC 终端中执行一次:

```bash
tailscale serve --bg http://localhost:6001
```

### 步骤 4: 从其他设备访问

在浏览器中以以下格式的地址访问:

```
https://我的PC名.tail某某.ts.net
```

确切地址可在 Tailscale 应用的设备列表中通过 PC 名称查看。在浏览器中加入书签,以后只需在 PC 上启动服务器即可从任何设备访问。


---

← [返回 README](../../README.cn.md)
