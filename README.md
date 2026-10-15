# Bookmate - Web Reader Đọc Sách Điện Tử HD

Ứng dụng web đọc sách điện tử chất lượng cao, giao diện tối ưu trải nghiệm người dùng với typography tinh tế, hỗ trợ mục lục trực quan, tìm kiếm nhanh và đọc giọng nói (TTS).

![Bookmate Banner](https://img.shields.io/badge/Status-Active-brightgreen)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)

---

## 📚 Tủ Sách Hiện Tại
1. **Kinh Tế Học Cơ Bản - Sách Vỡ Lòng Về Kinh Tế** (*Thomas Sowell*) - 784 trang
2. **Sapiens: Lược Sử Về Loài Người** (*Yuval Noah Harari*) - 481 trang

---

## ✨ Tính Năng Nổi Bật
- **Mục lục phân cấp (TOC)**: Dễ dàng điều hướng giữa các phần, chương và mục chi tiết.
- **2 Chế độ đọc linh hoạt**:
  - *Cuộn đọc liên tục*: Đọc mượt mà không bị ngắt quãng.
  - *Đọc theo từng trang*: Trải nghiệm lật trang sách truyền thống.
- **Tìm kiếm thông minh (Key: `S`)**: Tìm kiếm từ khóa và định vị trực tiếp đến trang tương ứng.
- **Đọc bài viết bằng giọng nói (TTS)**: Tích hợp công nghệ Text-to-Speech tự nhiên.
- **Đánh dấu trang (Key: `B`) & Lịch sử đọc**: Tự động lưu tiến độ đọc vào LocalStorage.
- **Tùy chỉnh giao diện**: Hỗ trợ nhiều bộ font (Lora, Merriweather, Roboto Mono,...), kích thước chữ, giãn dòng và theme màu (Sáng, Beige, Tối).
- **Phím tắt tiện dụng**:
  - `T`: Bật/tắt thanh mục lục
  - `L`: Mở thư viện tủ sách
  - `S`: Mở tìm kiếm
  - `B`: Đánh dấu trang hiện tại
  - `F`: Chế độ đọc toàn màn hình
  - `←` / `→`: Chuyển trang trước / sau

---

## 🚀 Khởi Chạy Ứng Dụng

Ứng dụng sử dụng JavaScript thuần tải dữ liệu JSON, cần chạy trên một HTTP server cục bộ:

### Sử dụng Python:
```bash
python -m http.server 8000
```
Truy cập: [http://localhost:8000](http://localhost:8000)

### Hoặc sử dụng Node.js:
```bash
npx serve .
```

---

## 📂 Cấu Trúc Dự Án
```text
bookmate/
├── index.html                           # Giao diện chính ứng dụng
├── styles.css                           # Toàn bộ stylesheet và themes
├── app.js                              # Logic ứng dụng, navigation, TTS, search
├── kinh_te_hoc_co_ban_data.json         # Dữ liệu nội dung Kinh Tế Học Cơ Bản
├── sapiens_data.json                    # Dữ liệu nội dung Sapiens
├── Kinh Tế Học Cơ Bản...pdf             # File PDF tham chiếu
├── sapiens-luoc-su-ve-loai-nguoi.pdf    # File PDF tham chiếu
└── README.md                            # Hướng dẫn sử dụng
```
