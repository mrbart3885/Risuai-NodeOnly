<p align="center">
  <a href="../en/remote.md">English</a> | <a href="../ko/remote.md">한국어</a> | <a href="../de/remote.md">Deutsch</a> | <a href="../cn/remote.md">简体中文</a> | <a href="../es/remote.md">Español</a> | <strong>Tiếng Việt</strong> | <a href="../zh-Hant/remote.md">繁體中文</a>
</p>

# Hướng dẫn truy cập từ xa

> 🌐 Hướng dẫn này được dịch bằng máy. Để có thông tin chính xác nhất, vui lòng tham khảo phiên bản [tiếng Anh](../en/remote.md) hoặc [tiếng Hàn](../ko/remote.md).

Có hai cách để truy cập PocketRisu đang chạy trên PC của bạn từ thiết bị khác (điện thoại thông minh, máy tính bảng, PC khác).

- [1. Quick Tunnel](#1-quick-tunnel) — Tính năng tích hợp trong PocketRisu. Không cần ứng dụng bổ sung. URL thay đổi khi khởi động lại máy chủ.
- [2. Tailscale](#2-tailscale) — Dựa trên mạng riêng (VPN). URL cố định.


## 1. Quick Tunnel

Tính năng tích hợp của PocketRisu để cấp URL truy cập từ xa tạm thời.

1. Trên PC, trong PocketRisu: Cài đặt > Truy cập từ xa > "Mở truy cập từ xa"
2. Quét mã QR hiển thị bằng camera điện thoại thông minh hoặc nhập URL trực tiếp vào trình duyệt của thiết bị khác.

> URL thay đổi mỗi khi máy chủ khởi động lại. Để có URL cố định, hãy sử dụng [Tailscale](#2-tailscale).


---

## 2. Tailscale

Xây dựng một mạng riêng (VPN) chỉ có thể truy cập từ các thiết bị đăng nhập cùng tài khoản. URL được duy trì sau khi máy chủ khởi động lại.

### Bước 1: Cài đặt Tailscale

- PC: [tailscale.com](https://tailscale.com/)
- Điện thoại thông minh: Tìm "Tailscale" trong App Store / Google Play
- PC khác: Tương tự [tailscale.com](https://tailscale.com/)

### Bước 2: Đăng nhập bằng cùng tài khoản

Đăng nhập vào ứng dụng Tailscale trên PC và trên mọi thiết bị bạn muốn truy cập, sử dụng cùng tài khoản (Google, Microsoft, v.v.).

### Bước 3: Bật chia sẻ HTTPS trên PC

Trong terminal trên PC đang chạy PocketRisu, chạy một lần:

```bash
tailscale serve --bg http://localhost:6001
```

### Bước 4: Truy cập từ thiết bị khác

Mở trong trình duyệt với định dạng URL:

```
https://tên-pc-của-tôi.tail-gì-đó.ts.net
```

Tìm địa chỉ chính xác qua mục PC của bạn trong danh sách thiết bị của ứng dụng Tailscale. Đánh dấu trong trình duyệt, và từ đó chỉ cần khởi động máy chủ trên PC là có thể truy cập từ bất kỳ thiết bị nào.


---

← [Quay lại README](../../README.vi.md)
