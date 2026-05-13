<p align="center">
  <a href="../en/remote.md">English</a> | <a href="../ko/remote.md">한국어</a> | <a href="../de/remote.md">Deutsch</a> | <a href="../cn/remote.md">简体中文</a> | <a href="../es/remote.md">Español</a> | <a href="../vi/remote.md">Tiếng Việt</a> | <strong>繁體中文</strong>
</p>

# 遠端存取指南

> 🌐 此指南由機器翻譯生成。如需獲取最準確的資訊,請參閱 [English](../en/remote.md) 或 [한국어](../ko/remote.md) 版本。

從其他裝置(智慧型手機、平板、其他 PC)存取執行於 PC 上的 PocketRisu 有兩種方式。

- [1. Quick Tunnel](#1-quick-tunnel) — PocketRisu 內建功能。無需額外應用程式。伺服器重啟時 URL 會變更。
- [2. Tailscale](#2-tailscale) — 基於私人網路(VPN)。URL 固定。


## 1. Quick Tunnel

PocketRisu 內建的臨時遠端存取 URL 發放功能。

1. 在 PC 上 PocketRisu 中:設定 > 遠端存取 > "開啟遠端存取"
2. 用智慧型手機相機掃描顯示的 QR Code,或在其他裝置的瀏覽器中直接輸入 URL。

> 伺服器重啟時 URL 會變更。如需固定 URL,請使用 [Tailscale](#2-tailscale)。


---

## 2. Tailscale

建構僅能從使用同一帳號登入的裝置存取的私人網路(VPN)。即使伺服器重啟,URL 仍保持不變。

### 步驟 1: 安裝 Tailscale

- PC: [tailscale.com](https://tailscale.com/)
- 智慧型手機: App Store / Google Play 中搜尋 "Tailscale"
- 其他 PC: 同樣 [tailscale.com](https://tailscale.com/)

### 步驟 2: 使用同一帳號登入

在 PC 和所有要存取的裝置的 Tailscale 應用程式中使用同一帳號(Google、Microsoft 等)登入。

### 步驟 3: 在 PC 上啟用 HTTPS 共享

在執行 PocketRisu 的 PC 終端機中執行一次:

```bash
tailscale serve --bg http://localhost:6001
```

### 步驟 4: 從其他裝置存取

在瀏覽器中以以下格式的位址存取:

```
https://我的PC名稱.tail某某.ts.net
```

確切位址可在 Tailscale 應用程式的裝置清單中透過 PC 名稱檢視。在瀏覽器中加入書籤,以後只需在 PC 上啟動伺服器即可從任何裝置存取。


---

← [返回 README](../../README.zh-Hant.md)
