# Báo Cáo Nghiên Cứu: Lịch Sử Loop Engineering, Các Mô Hình AI Agent và AI Chat trong TOPVSystem

## Research Brief
- **Chủ đề**: Lịch sử phát triển Loop Engineering, Giải thích khái niệm & bản chất Loop Engineering; Tổng quan so sánh các mô hình AI Agent (Codex, Claude, Antigravity); Hệ thống AI Chat trong TOPVSystem (Tính năng hiện tại & Lộ trình phát triển tương lai).
- **Phạm vi & Kết quả mong đợi**: Cung cấp cơ sở lý luận công nghệ vững chắc, so sánh trực quan và bức tranh kiến trúc hệ thống rõ nét để cấu trúc bài trình chiếu PPTX 16:9 chuyên nghiệp, mạch lạc, giàu tính trực quan.
- **Nguồn dữ liệu**: Dữ liệu công nghệ kỹ nghệ phần mềm hiện đại, kiến trúc các LLM/Agent tiên tiến và phân tích trực tiếp từ codebase của TOPVSystem (`TopEngManager/src/app/api/ai-chat/route.js`, `plugins/`).

---

### Khoảng trống 1: Lịch sử phát triển và Khái niệm Loop Engineering
- **Lịch sử tiến hóa**: Kỹ nghệ phần mềm đã chuyển dịch qua các làn sóng lớn: từ mô hình Thác nước (Waterfall) tuần tự, đến Agile/Scrum lặp ngắn, DevOps/CI-CD tự động hóa hạ tầng, trợ lý AI Copilot (2021–2023) hỗ trợ autocomplete dòng lệnh, và đỉnh cao là Loop Engineering (2024–2026) nơi AI Agent tự chủ thực thi các vòng lặp khép kín [F001].
- **Loop Engineering là gì**: Là phương pháp luận kỹ thuật phần mềm lấy các vòng lặp phản hồi khép kín (closed-loop execution) làm hạt nhân: Observe (Quan sát) -> Orient (Định hướng) -> Decide (Quyết định) -> Act (Thực thi) -> Verify (Kiểm chứng) -> Refine (Tự sửa chữa) [F002].
- **Loop Engineering làm gì**:
  + Thay thế mô hình "Prompt & Hope" (ra lệnh và cầu may) bằng quy trình tự vận hành có kiểm chứng.
  + Tự động chạy lệnh biên dịch, unit test, linter, phân tích lỗi và lặp lại việc sửa code mà không làm phiền kỹ sư.
  + Đảm bảo nguyên lý "Evidence Before Assertions" - mọi tính năng hay bản sửa lỗi chỉ được công nhận hoàn tất khi có log kiểm thử thực tế đạt yêu cầu [F003].

### Khoảng trống 2: Các mô hình AI Agent tiêu biểu (Codex, Claude, Antigravity)
- **OpenAI Codex & Operator**:
  + Tiên phong trong việc huấn luyện LLM chuyên sâu về code và chuẩn hóa giao thức Function Calling / Tool Calling.
  + Nâng tầm với hệ thống Operator có khả năng tự động thao tác GUI trình duyệt, xử lý tác vụ phức tạp đa bước trên web và tích hợp linh hoạt qua OpenAI Assistants API [F004].
- **Anthropic Claude (Claude 3.5 & 3.7 Sonnet)**:
  + Dẫn đầu về năng lực tư duy logic chuyên sâu với cơ chế Extended Thinking (suy luận kết hợp hybrid).
  + Khả năng tương tác môi trường thông qua Computer Use API (kiểm soát chuột, bàn phím trên desktop OS) và công cụ dòng lệnh chuyên dụng Claude Code CLI giúp agent trực tiếp đọc hiểu và refactor toàn bộ repository [F005].
- **Google DeepMind Antigravity**:
  + Nền tảng Advanced Agentic Coding thế hệ mới, sở hữu kiến trúc phân tầng đa sub-agent (self agent, research worker, specialized agents).
  + Tích hợp sẵn cơ chế Planning Mode (nghiên cứu -> lập kế hoạch -> phê duyệt -> thực thi -> kiểm chứng), giao thức MCP (Model Context Protocol), hệ thống lưu trữ trạng thái Persistent Artifacts và bộ công cụ kỹ năng Superpowers [F006].
- **So sánh then chốt**: Codex mạnh về tool API & browser control; Claude vượt trội về Extended Thinking & Computer Use; Antigravity chuyên sâu về multi-agent orchestration, planning governance và kiểm soát an toàn vòng lặp kỹ thuật.

### Khoảng trống 3: AI Chat trong TOPVSystem (Hiện tại & Tương lai)
- **Kiến trúc & Tính năng hiện hữu (As-Is)**:
  + Tích hợp trung tâm trong hệ thống TopEng Enterprise Management (`TopEngManager`).
  + Kiến trúc Dynamic Multi-Brain: Hỗ trợ linh hoạt DeepSeek Harness, local AI Gateway 9Router, Google Gemini 3.7 Flash, Anthropic Claude và OpenAI.
  + Enterprise Tool Calling Plugins: Thực hiện tác vụ nghiệp vụ thật qua function calling gồm Đặt phòng họp (`roomBookingPlugin`), Quản lý công việc (`taskPlugin`), Soạn báo cáo ngày (`dailyReportPlugin`).
  + Tích hợp Webhook tự động hóa với n8n, hỗ trợ đa ngôn ngữ (Tiếng Việt, Tiếng Anh, Hàn, Trung, Nhật) và nhận biết ngữ cảnh thời gian thực (User role, Department, Calendar) [F007].
- **Lộ trình phát triển tương lai (To-Be Roadmap)**:
  + Trụ cột 1: Enterprise Knowledge RAG - Tra cứu tức thời quy chuẩn kỹ thuật, tiêu chuẩn ISO, hồ sơ dự án và bản vẽ kỹ thuật cơ điện/xây dựng.
  + Trụ cột 2: Autonomous Multi-Agent Engineering - Hệ thống agent giám sát tiến độ thi công, tự động phát hiện chậm trễ và cảnh báo rủi ro dự án.
  + Trụ cột 3: Multimodal & Voice AI tại công trường - Hỗ trợ kỹ sư hiện trường kiểm tra lỗi kết cấu qua hình ảnh/camera và điều khiển tác vụ bằng giọng nói.
  + Trụ cột 4: ERP/MES Intelligence - Tự động hóa phân tích dữ liệu cung ứng vật tư, dự báo chi phí và sinh báo cáo tài chính dự án tự động [F008].
