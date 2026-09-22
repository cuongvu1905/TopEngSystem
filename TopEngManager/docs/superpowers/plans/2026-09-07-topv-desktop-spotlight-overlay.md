# Kế hoạch Thực hiện: TOPV Desktop Spotlight Guide (AI Hướng Dẫn Tương Tác Windows)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng TOPV Python Desktop Agent và lớp phủ Transparent Spotlight Overlay trên Windows, cho phép AI DeepSeek từ Web tự động chiếu đèn sáng và hiển thị chỉ dẫn từng bước lên đúng các nút bấm của phần mềm Desktop KSystem.

**Architecture:** Web Chat UI (Next.js) -> Plugin `desktopAgentPlugin.js` -> Local HTTP Bridge (`127.0.0.1:20188`) -> Python Agent (`scanner.py` định vị UI element + `overlay.py` chiếu sáng Spotlight bằng PyQt6).

**Tech Stack:** Python 3.12, `PyQt6`, `pywinauto`, `pyautogui`, `FastAPI`, `uvicorn`, Next.js 16, React 19.

**Spec:** `docs/superpowers/specs/2026-09-07-topv-desktop-spotlight-overlay-design.md`

## Global Constraints
- Cửa sổ Overlay phải trong suốt (Transparent), luôn nổi trên cùng (Always-on-Top), không che mất khả năng tương tác của người dùng.
- Hỗ trợ phím tắt `Esc` để tắt nhanh Overlay bất cứ lúc nào.
- Nếu không tìm thấy tọa độ chính xác của nút trên KSystem, tự động fallback hiển thị thẻ chỉ dẫn thông minh ở góc màn hình hoặc vùng ước tính.
- Giao diện Chat Web tự động nhận diện câu trả lời dạng quy trình từng bước và hiển thị nút bấm kích hoạt tiện lợi.

---

### Task 1: Cài đặt Thư viện Python và Khởi tạo Cấu trúc Desktop Agent

**Files:**
- Create: `desktop_agent/requirements.txt`
- Create: `desktop_agent/__init__.py`

- [ ] **Step 1: Viết `desktop_agent/requirements.txt` (`PyQt6`, `pywinauto`, `pyautogui`, `fastapi`, `uvicorn`, `requests`)**
- [ ] **Step 2: Cài đặt các gói qua `pip install -r desktop_agent/requirements.txt`**
- [ ] **Step 3: Kiểm tra import thành công các thư viện cốt lõi**

---

### Task 2: Xây dựng Module Định vị Phần tử Màn hình (`desktop_agent/scanner.py`)

**Files:**
- Create: `desktop_agent/scanner.py`
- Test: `scratch/test_scanner.py`

**Interfaces:**
- Produces: `find_ui_element(keyword, window_title_hint=None)` -> returns `{ found: bool, x: int, y: int, width: int, height: int, title: str }`

- [ ] **Step 1: Viết `desktop_agent/scanner.py` sử dụng Windows UI Automation (`pywinauto`) và `pyautogui` tìm kiếm phần tử theo text**
- [ ] **Step 2: Viết test script `scratch/test_scanner.py` để quét thử màn hình**
- [ ] **Step 3: Chạy test và xác nhận kết quả định vị**

---

### Task 3: Xây dựng Cửa sổ Transparent Spotlight Overlay (`desktop_agent/overlay.py`)

**Files:**
- Create: `desktop_agent/overlay.py`
- Test: `scratch/test_overlay.py`

**Interfaces:**
- Produces: `SpotlightOverlayApp(steps)` -> Hiển thị cửa sổ trong suốt, khoanh vùng sáng và tooltip chỉ dẫn

- [ ] **Step 1: Viết `desktop_agent/overlay.py` với `PyQt6`: nền mờ tối (mask with hole), viền sáng phát sáng quanh phần tử, thẻ Tooltip kèm nút `[Quay lại]`, `[Tiếp theo]`, `[Đóng]`**
- [ ] **Step 2: Viết test script `scratch/test_overlay.py` hiển thị overlay mẫu**
- [ ] **Step 3: Chạy test xác nhận overlay hiển thị đẹp mắt và mượt mà**

---

### Task 4: Xây dựng Local Bridge Server & File Khởi động (`desktop_agent/server.py`)

**Files:**
- Create: `desktop_agent/server.py`
- Create: `run_desktop_agent.bat`
- Test: `scratch/test_agent_api.py`

**Interfaces:**
- Produces: API `GET /api/status`, `POST /api/spotlight/start`, `POST /api/spotlight/stop`

- [ ] **Step 1: Viết FastAPI server trong `desktop_agent/server.py` chạy trên cổng 20188**
- [ ] **Step 2: Viết file `run_desktop_agent.bat` để người dùng khởi chạy 1-click**
- [ ] **Step 3: Viết test script `scratch/test_agent_api.py` kiểm tra gọi API điều khiển Overlay**

---

### Task 5: Xây dựng Plugin Agent Harness & Nút Kích hoạt trên Web Chat UI

**Files:**
- Create: `src/plugins/desktopAgentPlugin.js`
- Modify: `src/plugins/index.js`
- Modify: `src/app/api/ai-chat/route.js`
- Modify: `src/app/chat/page.js`

**Interfaces:**
- Produces: Tools `show_screen_spotlight_guide`, `check_desktop_agent_status`
- Web UI: Hiển thị badge trạng thái kết nối Desktop Agent + Nút `[🚀 Bật Hướng dẫn Chiếu đèn trên KSystem]` dưới câu trả lời có các bước của AI.

- [ ] **Step 1: Viết `src/plugins/desktopAgentPlugin.js` và đăng ký vào `src/plugins/index.js`**
- [ ] **Step 2: Cập nhật `src/app/api/ai-chat/route.js` tích hợp công cụ Desktop Agent**
- [ ] **Step 3: Cập nhật giao diện `src/app/chat/page.js` với badge trạng thái và nút bấm kích hoạt Spotlight**

---

### Task 6: Kiểm thử Toàn diện End-to-End & Tinh chỉnh Hoàn thiện

**Files:**
- Test: `scratch/test_e2e_desktop_spotlight.mjs`

- [ ] **Step 1: Khởi chạy Desktop Agent**
- [ ] **Step 2: Gửi câu hỏi quy trình nhập ERP hàng tháng trên Web Chat -> Bấm nút kích hoạt Spotlight**
- [ ] **Step 3: Xác nhận Spotlight hiển thị chính xác trên màn hình máy tính**
- [ ] **Step 4: Tổng kết và hoàn thành**
