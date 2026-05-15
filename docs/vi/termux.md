<p align="center">
  <a href="../en/termux.md">English</a> | <a href="../ko/termux.md">한국어</a> | <a href="../de/termux.md">Deutsch</a> | <a href="../cn/termux.md">简体中文</a> | <a href="../es/termux.md">Español</a> | <strong>Tiếng Việt</strong> | <a href="../zh-Hant/termux.md">繁體中文</a>
</p>

# Hướng dẫn cài đặt Termux

> 🌐 Hướng dẫn này được dịch bằng máy. Để có thông tin chính xác nhất, vui lòng tham khảo phiên bản [tiếng Anh](../en/termux.md) hoặc [tiếng Hàn](../ko/termux.md).

Hướng dẫn này giải thích cách xây dựng và chạy PocketRisu trực tiếp trên điện thoại Android sử dụng Termux. Mẫu sử dụng dự kiến là mở `http://localhost:6001` trong trình duyệt của chính điện thoại.

- [1. Điều kiện tiên quyết](#1-điều-kiện-tiên-quyết) — Termux từ F-Droid và yêu cầu hệ thống
- [2. Cài đặt và xây dựng](#2-cài-đặt-và-xây-dựng) — thiết lập bằng một lệnh duy nhất
- [3. Chạy và kết nối](#3-chạy-và-kết-nối) — mở từ trình duyệt điện thoại
- [4. Duy trì hoạt động](#4-duy-trì-hoạt-động) — tiếp tục chạy khi tắt màn hình
- [5. Cập nhật](#5-cập-nhật) — lấy phiên bản mới nhất
- [6. Hạn chế](#6-hạn-chế) — tính năng không hoạt động trên Termux


## Yêu cầu hệ thống

| Hạng mục            | Tối thiểu       | Đề xuất                                |
| ------------------- | --------------- | -------------------------------------- |
| **Android**         | 7.0 (API 24)    | 10 trở lên                             |
| **CPU**             | ARM64           | ARM64                                  |
| **RAM**             | 2 GB            | 4 GB trở lên                           |
| **Dung lượng trống** | 2 GB            | 4 GB trở lên (bao gồm bản build)       |

PocketRisu không cung cấp tệp nhị phân biên dịch sẵn cho Termux, vì vậy điện thoại tự xây dựng mọi thứ. Bao gồm các module gốc như `better-sqlite3`, quá trình xây dựng mất khoảng **10 đến 40 phút**, tùy theo hiệu năng điện thoại.


---

## 1. Điều kiện tiên quyết

### Sử dụng phiên bản Termux từ F-Droid hoặc GitHub Releases

> ⚠️ **Không thể sử dụng phiên bản Termux trên Play Store.**
> Các bảo trì viên Termux đã ngừng cập nhật bản Play Store vào năm 2020, và bản này không còn cài đặt được các gói mới mà PocketRisu cần (Node.js 22+).

Cài đặt Termux từ một trong các nguồn sau:

- **F-Droid (khuyến nghị)**: https://f-droid.org/packages/com.termux/
- **GitHub Releases**: https://github.com/termux/termux-app/releases

Nếu bạn đã cài bản từ Play Store, hãy gỡ cài đặt trước rồi cài lại từ một trong các nguồn trên.


---

## 2. Cài đặt và xây dựng

Mở Termux và chạy lệnh duy nhất này:

```bash
pkg install -y git && \
  git clone https://github.com/PocketRisu/PocketRisu.git && \
  cd PocketRisu && \
  bash scripts/termux/build.sh
```

Lệnh này tự động xử lý:

1. Cài đặt `git`
2. Sao chép kho lưu trữ PocketRisu
3. Cài đặt các phụ thuộc xây dựng (`nodejs-lts`, `python`, `make`, `clang`, `pnpm`, v.v.)
4. `pnpm install` — phụ thuộc JavaScript và biên dịch module gốc
5. `pnpm build` — đóng gói giao diện người dùng

Khi quá trình xây dựng hoàn tất, bạn sẽ thấy:

```
Build OK. Start the server with:
  node server/node/server.cjs

Then open this address in the phone's own browser:
  http://localhost:6001
```


---

## 3. Chạy và kết nối

Từ cùng thư mục, khởi động máy chủ:

```bash
node server/node/server.cjs
```

Sau khi nhật ký khởi động máy chủ xuất hiện, mở trình duyệt điện thoại (Chrome, Firefox, v.v.) và truy cập:

```
http://localhost:6001
```

Giao diện PocketRisu sẽ tải lên. `localhost` được trình duyệt tự động xem là ngữ cảnh bảo mật (secure context), vì vậy clipboard, `crypto.subtle` và các API yêu cầu ngữ cảnh bảo mật khác đều hoạt động bình thường.

Dừng máy chủ bằng `Ctrl + C`.


---

## 4. Duy trì hoạt động

Để máy chủ tiếp tục chạy khi màn hình tắt hoặc bạn chuyển sang ứng dụng khác, hãy bật wake lock của Termux:

```bash
termux-wake-lock
```

Thông báo Termux sẽ hiển thị chỉ báo wake lock, và máy chủ tiếp tục chạy ngay cả khi màn hình tắt.

Giải phóng bằng: `termux-wake-unlock`

> Android vẫn có thể đóng Termux khi thiếu bộ nhớ. Để chạy lâu dài, hãy loại trừ Termux khỏi cài đặt tối ưu hóa pin của điện thoại.


---

## 5. Cập nhật

Từ thư mục PocketRisu:

```bash
cd ~/PocketRisu
git pull
NODE_OPTIONS="--max-old-space-size=2048" pnpm build
```

Nếu các phụ thuộc thay đổi, `pnpm install` sẽ tự động chạy như một phần của quá trình xây dựng. Khởi động lại máy chủ khi quá trình xây dựng hoàn tất.


---

## 6. Hạn chế

**Quick Tunnel (đường hầm tự động của Cloudflare) không hoạt động trên Termux.** Tệp nhị phân `cloudflared` không tương thích với môi trường DNS và TLS của Termux.

PocketRisu tự động phát hiện môi trường Termux và hiển thị cảnh báo trong menu Truy cập từ xa, ẩn nút khởi động.


---

← [Quay lại README](../../i18n/README.vi.md)
