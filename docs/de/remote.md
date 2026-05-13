<p align="center">
  <a href="../en/remote.md">English</a> | <a href="../ko/remote.md">한국어</a> | <strong>Deutsch</strong> | <a href="../cn/remote.md">简体中文</a> | <a href="../es/remote.md">Español</a> | <a href="../vi/remote.md">Tiếng Việt</a> | <a href="../zh-Hant/remote.md">繁體中文</a>
</p>

# Fernzugriff-Leitfaden

> 🌐 Diese Anleitung wurde maschinell übersetzt. Für die genauesten Informationen siehe die [englische](../en/remote.md) oder [koreanische](../ko/remote.md) Version.

Es gibt zwei Möglichkeiten, von einem anderen Gerät (Smartphone, Tablet, anderer PC) auf PocketRisu zuzugreifen, das auf Ihrem PC läuft.

- [1. Quick Tunnel](#1-quick-tunnel) — In PocketRisu integriert. Keine zusätzliche App erforderlich. URL ändert sich beim Serverneustart.
- [2. Tailscale](#2-tailscale) — Basiert auf privatem Netzwerk (VPN). Persistente URL.


## 1. Quick Tunnel

Eine in PocketRisu integrierte Funktion, die eine temporäre Fernzugriffs-URL ausgibt.

1. Auf Ihrem PC in PocketRisu: Einstellungen > Fernzugriff > "Fernzugriff öffnen"
2. Scannen Sie den angezeigten QR-Code mit Ihrer Smartphone-Kamera oder geben Sie die URL direkt im Browser eines anderen Geräts ein.

> Die URL ändert sich bei jedem Server-Neustart. Für eine persistente URL verwenden Sie [Tailscale](#2-tailscale).


---

## 2. Tailscale

Erstellt ein privates Netzwerk (VPN), das nur von Geräten zugänglich ist, die mit demselben Konto angemeldet sind. Die URL bleibt über Server-Neustarts hinweg erhalten.

### Schritt 1: Tailscale installieren

- PC: [tailscale.com](https://tailscale.com/)
- Smartphone: Suchen Sie nach "Tailscale" im App Store / Google Play
- Anderer PC: Ebenso über [tailscale.com](https://tailscale.com/)

### Schritt 2: Mit demselben Konto anmelden

Melden Sie sich in der Tailscale-App auf dem PC und auf jedem Gerät, von dem Sie zugreifen möchten, mit demselben Konto (Google, Microsoft usw.) an.

### Schritt 3: HTTPS-Sharing auf dem PC aktivieren

Führen Sie im Terminal auf dem PC, auf dem PocketRisu läuft, einmal aus:

```bash
tailscale serve --bg http://localhost:6001
```

### Schritt 4: Von einem anderen Gerät zugreifen

Öffnen Sie in einem Browser mit diesem URL-Format:

```
https://ihr-pc-name.tail-irgendetwas.ts.net
```

Finden Sie die genaue Adresse über den Eintrag Ihres PCs in der Geräteliste der Tailscale-App. Setzen Sie ein Lesezeichen im Browser, sodass Sie ab dann nur den Server auf dem PC starten müssen, um von jedem Gerät aus zuzugreifen.


---

← [Zurück zur README](../../README.de.md)
