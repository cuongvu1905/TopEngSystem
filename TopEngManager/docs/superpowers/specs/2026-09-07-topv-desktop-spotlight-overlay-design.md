# Đặc tả Thiết kế: TOPV Desktop Spotlight Guide (AI Hướng Dẫn Tương Tác Trên Ứng Dụng Windows)

## 1. Tổng quan (Overview)
Tính năng **TOPV Desktop Spotlight Guide** cung cấp một trợ lý trực quan trên máy tính Windows. Khi người dùng hỏi AI các câu hỏi về quy trình thao tác trên các phần mềm Desktop (như KSystem, ERP, phần mềm nội bộ...), AI không chỉ trả lời bằng văn bản mà còn có thể **kích hoạt lớp phủ trong suốt (Spotlight Overlay)** đè lên màn hình máy tính, tự động tìm và chiếu đèn sáng vào đúng nút bấm/ô nhập liệu cần thao tác theo từng bước.

## 2. Phạm vi & Yêu cầu Chức năng (Scope & Requirements)
1. **TOPV Python Desktop Agent (Local Service)**:
   - Chạy nền dưới dạng dịch vụ cục bộ trên máy tính (`http://127.0.0.1:20188`).
   - Cung cấp API nhận danh sách các bước hướng dẫn từ Web TOPVSystem.
   - Quản lý vòng đời cửa sổ Overlay (Mở, Chuyển bước, Đóng).
2. **Bộ quét màn hình & Định vị phần tử (Screen Scanner & Element Locator)**:
   - Quét cửa sổ ứng dụng đang mở (như KSystem, ERP).
   - Sử dụng Windows UI Automation (`pywinauto`) kết hợp tìm kiếm văn bản và tọa độ màn hình (`pyautogui`) để xác định chính xác vị trí $(X, Y, \text{Width}, \text{Height})$ của nút bấm, menu hoặc ô nhập liệu mục tiêu.
   - Tự động fallback sang tọa độ trung tâm hoặc chế độ hướng dẫn linh hoạt nếu phần tử bị che khuất.
3. **Lớp phủ Spotlight trong suốt (Transparent Spotlight Overlay Window)**:
   - Cửa sổ toàn màn hình trong suốt (`PyQt6` / `PySide6`), chế độ `Always-on-Top` và `Frameless`.
   - **Hiệu ứng Spotlight**: Làm mờ tối nhẹ các vùng xung quanh, khoanh vùng viền sáng (glowing border) rực rỡ quanh nút/ô cần bấm.
   - **Thẻ Tooltip hướng dẫn (Guide Card)**:
     - Hiển thị số bước (Ví dụ: `Bước 1/6`), tiêu đề và mô tả chi tiết.
     - Mũi tên động chỉ trực tiếp vào nút bấm.
     - Các nút điều hướng: `[◀ Quay lại]`, `[Tiếp theo ▶]`, `[✖ Đóng hướng dẫn]`.
     - Phím tắt nhanh: `Esc` để đóng, `Phím mũi tên / Enter` để chuyển bước.
4. **Tích hợp TopEng Agent Harness & Web Chat UI**:
   - Khai báo schema và handler cho công cụ `show_screen_spotlight_guide` và `check_desktop_agent_status` trong `src/plugins/desktopAgentPlugin.js`.
   - Giao diện Chat Web tự động hiển thị nút **`[🚀 Bật Hướng dẫn Chiếu đèn trên KSystem]`** dưới các câu trả lời dạng quy trình từng bước.
   - Hiển thị trạng thái kết nối Desktop Agent (`🟢 Đang kết nối` / `⚪ Chưa chạy`).

## 3. Kiến trúc Kỹ thuật (Technical Architecture)

```
[Web Chat UI (TopEng Next.js)]
       │
       ├── 1. Gửi danh sách các bước (Action Steps)
       ▼
[Local HTTP Bridge (POST http://127.0.0.1:20188/api/spotlight)]
       │
       ▼
[Python Desktop Agent Server (FastAPI / aiohttp)]
       │
       ├── 2. Scanner định vị tọa độ nút bấm (pywinauto / UI Automation)
       │
       ▼
[PyQt6 / PySide6 Transparent Overlay Window]
       │
       └── 3. Chiếu Spotlight lên đúng nút bấm trên cửa sổ KSystem Desktop!
```

## 4. Kế hoạch Kiểm thử & Xác nhận (Verification Plan)
1. **Kiểm thử kết nối API**: Kiểm tra kết nối giữa Web TopEng và Python Desktop Agent qua `GET /api/status`.
2. **Kiểm thử Overlay Spotlight**: Gửi lệnh mẫu có các bước hướng dẫn, xác nhận cửa sổ trong suốt hiện đúng vị trí và điều hướng bước mượt mà.
3. **Kiểm thử tích hợp End-to-End**: Hỏi câu hỏi quy trình trong Chat Web -> Nhấn nút `[🚀 Bật Hướng dẫn Chiếu đèn]` -> Spotlight tự động bật lên trên màn hình máy tính.
