# Pomodoro Music

Web Pomodoro giao diện kiểu Spotify, phát nhạc từ link YouTube (video đơn hoặc playlist). React + Vite.

## Chạy

```bash
npm install
npm run dev        # mở http://localhost:5173
```

Build bản production: `npm run build` → thư mục `dist/` (deploy được lên GitHub Pages, Netlify, Vercel…).

## Tính năng

**Dashboard**
- Đồng hồ lớn, 2 chế độ: Tập trung / Nghỉ; chỉnh số phút bằng nút −/+ hoặc gõ tay, preset 25/5 · 50/10 · 90/20
- Dán link YouTube: `watch?v=`, `youtu.be/`, `shorts/`, `playlist?list=`, `music.youtube.com`, link video trong playlist
- Thư viện (sidebar): các link đã dùng, bấm để tải lại
- Thanh "đang phát" ở dưới như Spotify

**Màn phiên** (bấm nút ▶ xanh)
- Đĩa than quay theo nhạc, nhãn đĩa là ảnh bìa; vòng tiến độ Pomodoro bao quanh đĩa
- Danh sách phát có tìm kiếm, bấm để chọn bài; trộn, lặp, tua, âm lượng; phím media
- Hết phiên: chuông báo (tự hạ nhỏ nhạc khi chuông kêu) + popup + thông báo trình duyệt (tuỳ chọn)

**Cài đặt** (⚙️): nhạc theo phiên, tự chuyển phiên, thông báo, âm lượng chuông + nút thử chuông.

Phím tắt: `Space` = bắt đầu / tạm dừng.

## Cấu trúc

```
src/
  App.jsx                 điều phối view, timer ↔ nhạc, chuông, thư viện
  hooks/useTimer.js       logic Pomodoro (focus/break)
  hooks/useMusic.js       nối musicEngine vào React
  lib/musicEngine.js      YouTube player ẩn + hàng đợi bài
  lib/youtube.js          đọc link, oEmbed, nạp IFrame API
  lib/chime.js            chuông báo (Web Audio)
  components/             Dashboard, Session, Player, Common, Icons
legacy/                   bản HTML/JS thuần cũ
```

## Giới hạn

- Video mà chủ kênh tắt chế độ nhúng sẽ không phát được (tự bỏ qua).
- YouTube chỉ trả về tối đa 200 bài đầu của một playlist.
- Playlist "Mix" tự động (`list=RD...`) có thể không ổn định.
