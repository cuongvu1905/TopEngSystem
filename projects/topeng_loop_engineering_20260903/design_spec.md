<!-- ppt-master-schema: design-spec/v1 -->
# TOPVSystem Loop Engineering & AI Agent - Design Spec (35 Slides)

## I. Project Information

| Item | Value |
| --- | --- |
| Project Name | topeng_loop_engineering_20260903 |
| Canvas Format | PPT 16:9 (1280×720) |
| Page Count | 35 |
| Primary Language | vi-VN |
| Target Audience | Ban Giám đốc, Trưởng bộ phận, Kỹ sư phần mềm và Toàn thể nhân sự TOPVSystem |
| Communication Intent | Trình bày toàn diện chuyên đề công nghệ: Lịch sử tiến hóa và bản chất Loop Engineering; Phân tích so sánh các mô hình AI Agent hàng đầu (Codex, Claude, Antigravity); Thực trạng và Lộ trình nâng cấp AI Chat trong TOPVSystem. |
| Desired Audience Outcome | Nắm bắt sâu sắc triết lý vòng lặp khép kín, phân biệt năng lực các Agent, hiểu rõ giá trị thực thi của AI Chat nội bộ và đồng lòng triển khai lộ trình 2026 - 2027. |
| Core Message / Ask / Action | Từ Prompting thụ động sang Loop Engineering tự chủ khép kín: TOPVSystem tiên phong ứng dụng AI Agent vào quản trị doanh nghiệp và kỹ thuật thực chiến. |
| Delivery Context | Hội thảo chuyên đề công nghệ chuyên sâu (60–90 phút) có demo thực chiến và thảo luận chiến lược. |
| Artifact Afterlife | Tài liệu chuẩn hóa kiến thức đào tạo nội bộ, kim chỉ nam R&D tính năng AI cho toàn hệ thống TOPVSystem. |
| Reading Mode | balanced |
| Content Strategy | Bố cục 35 trang chặt chẽ, luận điểm sâu sắc, số liệu thực tế, sơ đồ kiến trúc khép kín và liên hệ trực tiếp với codebase TopEngManager. |
| Design Style | Kỹ thuật Công nghệ Hiện đại (Dark Tech & Cyber Blue) |
| AI Image Acquisition Path | auto |
| Generation Mode | continuous |
| Spec Refinement | disabled |
| Speaker Notes | enabled — final Stage-2 proactive policy |
| Custom Animations | disabled — final Stage-2 proactive policy |
| Narration Audio | disabled — final Stage-2 proactive policy |
| Created Date | 2026-09-03 |

## II. Canvas Specification

| Property | Value |
| --- | --- |
| Format | ppt169 |
| Dimensions | 1280 × 720 |
| viewBox | 0 0 1280 720 |
| Margins | top: 48px, right: 56px, bottom: 48px, left: 56px |
| Content Area | 1168 × 624 |

## III. Visual Theme

### Theme Style
- **Mode**: custom
- **Visual style**: custom
- **Theme**: Cyber Engineering & Agentic Autonomy
- **Tone**: Tiên phong, chính xác, sâu sắc về kỹ thuật và truyền cảm hứng hành động.

### Color Scheme

| Role | HEX | Purpose |
| --- | --- | --- |
| Background | #0B1120 | Nền tối chủ đạo hiện đại, tạo chiều sâu công nghệ |
| Secondary background | #1E293B | Khối thẻ card chứa nội dung, module phân tách thông tin |
| Primary | #38BDF8 | Tiêu đề slide, đường nét biểu đồ trọng tâm, điểm nhấn Cyan |
| Accent | #6366F1 | Nút nhấn nổi bật, mũi tên vòng lặp, huy hiệu phân loại Indigo |
| Secondary accent | #10B981 | Trạng thái thành công, nhãn hoàn tất, kiểm thử đạt chuẩn Emerald |
| Body text | #F1F5F9 | Văn bản nội dung chính, độ tương phản cao, dễ đọc |

## IV. Typography System

### Font Plan
- **Title stack**: "Segoe UI", Arial, sans-serif
- **Body stack**: "Segoe UI", Arial, sans-serif

### Font Size Hierarchy

| Purpose | Anchor Size (px) |
| --- | ---: |
| Title | 42 |
| Subtitle | 32 |
| Body | 24 |
| Annotation | 18 |
| Caption | 14 |

## V. Layout Principles
- **Hierarchy direction**: Tiêu đề nổi bật góc trên bên trái -> Tag phần tương ứng -> Thẻ nội dung trọng tâm phân tầng từ trái sang phải -> Footer điều hướng cố định góc dưới.
- **Composition tendency**: Sử dụng lưới 2 đến 3 cột đối xứng, khối hình hộp card bo góc nhẹ viền mảnh, làm nổi bật sơ đồ vòng lặp OODA khép kín.
- **Spacing posture**: Padding trong card từ 20px-28px, khoảng cách giữa các card 20px-24px, phân dòng thoáng mắt.

## VI. Icon Usage Specification
- **Primary bundled library**: tabler-outline
- **Stroke Width**: 2

| Icon Path | Suitable Scenarios |
| --- | --- |
| icons/tabler-outline/cpu.svg | Đại diện cho mô hình AI, bộ xử lý Agent, năng lực tính toán |
| icons/tabler-outline/refresh.svg | Đại diện cho vòng lặp Loop Engineering, chu trình lặp phản hồi |
| icons/tabler-outline/check.svg | Trạng thái xác minh, test pass, verification-first |
| icons/tabler-outline/message-chatbot.svg | Đại diện cho AI Chat, trợ lý hội thoại doanh nghiệp |
| icons/tabler-outline/git-branch.svg | Lịch sử phân nhánh công nghệ, quy trình phát triển phần mềm |
| icons/tabler-outline/rocket.svg | Lộ trình tương lai, mục tiêu tăng tốc phát triển |

## VIII. Image Resource List

| Filename | Dimensions | Ratio | Purpose | Type | Layout pattern | Crop Policy | Acquire Via | Status | Reference | text_policy | page_role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## IX. Content Outline

### Slide 01 - Trang Bìa
- **Audience move**: Người nghe chuẩn bị tâm thế tiếp cận một chủ đề công nghệ tiên phong, hiện đại và mang tính chiến lược cao.
- **Title**: LOOP ENGINEERING & AI AGENT TRONG KỶ NGUYÊN TỰ CHỦ
- **Core message**: Khám phá bước nhảy vọt từ Prompting sang Vòng lặp Khép kín & Chiến lược Thực thi AI Chat tại TOPVSystem.

### Slide 02 - Tóm Tắt Điều Hành
- **Audience move**: Nắm bắt nhanh 3 thông điệp chiến lược chính trước khi đi sâu vào chi tiết.
- **Title**: TÓM TẮT ĐIỀU HÀNH (EXECUTIVE SUMMARY)
- **Core message**: Ba phát hiện và định hướng then chốt cho toàn bộ tổ chức kỹ thuật TOPVSystem.

### Slide 03 - Mục Lục Toàn Cảnh
- **Audience move**: Thấy được bức tranh tổng thể cấu trúc 35 trang và lộ trình chi tiết.
- **Title**: MỤC LỤC & LỘ TRÌNH CHUYÊN ĐỀ
- **Core message**: Khung cấu trúc 3 phần xuyên suốt từ lý luận, đối sánh công nghệ đến ứng dụng thực tiễn.

### Slide 04 - Phân Đoạn 1
- **Audience move**: Chuyển sự chú ý sang Phần I: Lịch sử tiến hóa và bản chất kỹ nghệ vòng lặp.
- **Title**: PHẦN I: LỊCH SỬ TIẾN HÓA & BẢN CHẤT LOOP ENGINEERING
- **Core message**: Khởi nguyên của phương pháp luận kỹ thuật phần mềm tự chủ.

### Slide 05 - Lịch Sử SDLC 1970 - 2000
- **Audience move**: Hiểu về mô hình Waterfall và cuộc khủng hoảng phần mềm ban đầu.
- **Title**: GIAI ĐOẠN 1970 - 2000: WATERFALL & KHỦNG HOẢNG PHẦN MỀM
- **Core message**: Tuyến tính, cứng nhắc, chu kỳ chậm và bài học đắt giá về rủi ro bàn giao muộn.

### Slide 06 - Bước Chuyển Agile & Scrum
- **Audience move**: Nhận diện bước chuyển sang các vòng lặp ngắn thích ứng linh hoạt.
- **Title**: GIAI ĐOẠN 2001 - 2014: AGILE & SCRUM — THÍCH ỨNG LINH HOẠT
- **Core message**: Chia nhỏ chu kỳ bàn giao (Sprints), lấy con người và phản hồi làm trọng tâm.

### Slide 07 - Kỷ Nguyên DevOps & CI/CD
- **Audience move**: Thấy được làn sóng tự động hóa khâu kiểm thử và triển khai hạ tầng.
- **Title**: GIAI ĐOẠN 2015 - 2020: DEVOPS & CI/CD — TỰ ĐỘNG HÓA TÍCH HỢP
- **Core message**: Tự động hóa build, test và release liên tục, nhưng lập trình viên vẫn phải gõ code tay.

### Slide 08 - Làn Sóng AI Copilot
- **Audience move**: Nhìn nhận sự xuất hiện của AI hỗ trợ sinh code và gợi ý autocomplete.
- **Title**: GIAI ĐOẠN 2021 - 2023: AI COPILOT — TRỢ LÝ SINH MÃ TỰ ĐỘNG
- **Core message**: Đột phá ở gợi ý code ngữ cảnh, nhưng chỉ là mô hình tương tác một lần (One-shot).

### Slide 09 - Giới Hạn Của Prompting
- **Audience move**: Thấu hiểu vì sao cách làm "Prompt & Hope" không đủ cho kỹ nghệ phần mềm chuyên nghiệp.
- **Title**: GIỚI HẠN CỦA PROMPTING: VÌ SAO CẦN VÒNG LẶP TỰ CHỦ?
- **Core message**: AI sinh code không kiểm tra lỗi, con người vẫn phải gánh chịu 100% việc debug thủ công.

### Slide 10 - Loop Engineering Là Gì?
- **Audience move**: Tiếp nhận định nghĩa chính xác và các tiêu chuẩn kỹ thuật của Loop Engineering.
- **Title**: LOOP ENGINEERING LÀ GÌ? ĐỊNH NGHĨA KỸ NGHỆ THỰC TIỄN
- **Core message**: Hệ phương pháp luận đưa AI Agent vào chu trình lặp phản hồi khép kín tương tác trực tiếp môi trường.

### Slide 11 - Chu Trình OODA & Ralph Loop
- **Audience move**: Tiếp thu nền tảng lý thuyết OODA và Ralph Loop trong điều khiển học tự chủ.
- **Title**: CƠ SỞ KHOA HỌC: CHU TRÌNH OODA & RALPH CLOSED LOOP
- **Core message**: Observe &rarr; Orient &rarr; Decide &rarr; Act ứng dụng vào kỹ nghệ phần mềm AI.

### Slide 12 - Loop Engineering Làm Gì?
- **Audience move**: Theo dõi trực quan sơ đồ 6 bước vận hành khép kín của Agent.
- **Title**: LOOP ENGINEERING LÀM GÌ? QUY TRÌNH 6 BƯỚC KHÉP KÍN
- **Core message**: Phân tích &rarr; Kế hoạch &rarr; Thực thi &rarr; Kiểm chứng &rarr; Quan sát &rarr; Tự sửa lỗi tuần hoàn.

### Slide 13 - 4 Nguyên Lý Kỹ Thuật Cốt Lõi
- **Audience move**: Nắm vững 4 trụ cột kỹ thuật bất biến của hệ thống kỹ nghệ vòng lặp.
- **Title**: 4 NGUYÊN LÝ KỸ THUẬT CỐT LÕI CỦA LOOP ENGINEERING
- **Core message**: Goal-Driven, Verification-First, Self-Healing, Persistent Artifacts.

### Slide 14 - So Sánh Chiều Sâu
- **Audience move**: Phân biệt rạch ròi giữa cách làm thủ công cũ và cách làm tự chủ mới.
- **Title**: SO SÁNH: HUMAN-IN-THE-LOOP VS AI AUTONOMOUS CLOSED-LOOP
- **Core message**: Loại bỏ các điểm nghẽn gián đoạn của con người ở các khâu kiểm thử vi mô.

### Slide 15 - Phân Đoạn 2
- **Audience move**: Chuyển sang Phần II: Tìm hiểu các mô hình AI Agent tiêu biểu toàn cầu.
- **Title**: PHẦN II: CÁC MÔ HÌNH AI AGENT (CODEX, CLAUDE, ANTIGRAVITY)
- **Core message**: Bức tranh so sánh các hệ sinh thái AI Agent định hình ngành công nghệ.

### Slide 16 - Phân Loại Kiến Trúc Agent
- **Audience move**: Phân loại các kiến trúc agent từ đơn tác tử tới bầy đàn đa tác tử.
- **Title**: PHÂN LOẠI KIẾN TRÚC AGENT: SINGLE-AGENT VS MULTI-AGENT SWARM
- **Core message**: Đánh đổi giữa tính đơn giản và khả năng phân rã bài toán lớn song song.

### Slide 17 - OpenAI Codex & Assistants
- **Audience move**: Hiểu về nguồn gốc Codex, chuẩn Function Calling và hệ sinh thái Assistants API.
- **Title**: OPENAI CODEX & ASSISTANTS API: TIÊN PHONG FUNCTION CALLING
- **Core message**: Chuẩn hóa giao thức giao tiếp công cụ JSON Schema toàn cầu.

### Slide 18 - OpenAI Operator
- **Audience move**: Khám phá công nghệ tự động hóa thao tác trình duyệt web thông qua thị giác máy tính.
- **Title**: OPENAI OPERATOR: ĐỘT PHÁ TỰ ĐỘNG HÓA TRÌNH DUYỆT QUA VISUAL GUI
- **Core message**: Biến AI thành người dùng thực thụ thao tác trên giao diện web phức tạp.

### Slide 19 - Anthropic Claude 3.5 & 3.7
- **Audience move**: Tiếp cận triết lý tư duy chuỗi ý nghĩ sâu sắc của Claude 3.7 Sonnet.
- **Title**: ANTHROPIC CLAUDE 3.7: TRIẾT LÝ EXTENDED THINKING
- **Core message**: Tự suy luận và phản biện trước khi viết code, giải quyết bài toán hóc búa.

### Slide 20 - Claude Computer Use API
- **Audience move**: Tìm hiểu cơ chế AI điều khiển máy tính trực tiếp qua chuột và phím.
- **Title**: ANTHROPIC COMPUTER USE API: ĐIỀU KHIỂN HỆ ĐIỀU HÀNH NATIVE
- **Core message**: Tương tác trực tiếp với màn hình desktop như kỹ sư máy tính.

### Slide 21 - Claude Code CLI
- **Audience move**: Xem xét công cụ dòng lệnh của Anthropic hỗ trợ lập trình trực tiếp trên kho mã nguồn.
- **Title**: CLAUDE CODE CLI: TRỢ LÝ DÒNG LỆNH TRỰC TIẾP TRÊN REPOSITORY
- **Core message**: Đọc toàn bộ codebase, tự tạo git branch, chạy test và tạo commit chuẩn xác.

### Slide 22 - Google DeepMind Antigravity
- **Audience move**: Nắm bắt kiến trúc đa tác tử và cơ chế kiểm duyệt của Antigravity.
- **Title**: GOOGLE DEEPMIND ANTIGRAVITY: MULTI-AGENT SWARM & GOVERNANCE
- **Core message**: Phân định rạch ròi giữa Planning an toàn và Execution tự chủ, phối hợp song song.

### Slide 23 - Khung Superpowers & MCP
- **Audience move**: Hiểu về bộ kỹ năng chuẩn hóa Superpowers và giao thức Model Context Protocol.
- **Title**: KHUNG SUPERPOWERS & MODEL CONTEXT PROTOCOL (MCP)
- **Core message**: Giao thức kết nối công cụ mở rộng và quy chuẩn kỹ năng nghiêm ngặt.

### Slide 24 - So Sánh Tư Duy Logic
- **Audience move**: Đánh giá chi tiết năng lực suy luận giữa 3 hệ sinh thái.
- **Title**: SO SÁNH CHUYÊN SÂU: NĂNG LỰC TƯ DUY LOGIC & PHÂN RÃ BÀI TOÁN
- **Core message**: Claude dẫn đầu về Extended Thinking, Antigravity dẫn đầu về Planning Mode.

### Slide 25 - So Sánh Tương Tác OS & Sửa Lỗi
- **Audience move**: Đánh giá khả năng tương tác môi trường terminal và tự phục hồi mã lỗi.
- **Title**: SO SÁNH CHUYÊN SÂU: TƯƠNG TÁC MÔI TRƯỜNG & TỰ SỬA LỖI (SELF-REPAIR)
- **Core message**: Antigravity và Claude tối ưu cho Terminal/Codebase; Codex tối ưu cho Web/API.

### Slide 26 - Ma Trận Đối Sánh Toàn Diện
- **Audience move**: Tổng hợp bảng ma trận kỹ thuật 6 tiêu chí định hướng lựa chọn kiến trúc.
- **Title**: MA TRẬN ĐỐI SÁNH KỸ THUẬT 6 CHIỀU & CHIẾN LƯỢC ĐA MÔ HÌNH
- **Core message**: Kiến trúc Multi-Brain mở kết hợp điểm mạnh của cả ba nền tảng.

### Slide 27 - Phân Đoạn 3
- **Audience move**: Chuyển sang Phần III: AI Chat trong TOPVSystem hiện tại và tương lai.
- **Title**: PHẦN III: AI CHAT TRONG TOPVSYSTEM (HIỆN TRẠNG & TƯƠNG LAI)
- **Core message**: Ứng dụng thực chiến tại TOPVSystem từ mã nguồn TopEngManager đến định hướng 2027.

### Slide 28 - Bối Cảnh & Bài Toán Doanh Nghiệp
- **Audience move**: Thấu hiểu thách thức nghiệp vụ tại TOPVSystem thúc đẩy nhu cầu AI.
- **Title**: BỐI CẢNH DOANH NGHIỆP & BÀI TOÁN THỰC TẾ TẠI TOPVSYSTEM
- **Core message**: Quản lý đa dự án cơ điện, phối hợp liên phòng ban và nhu cầu giảm tải thao tác thủ công.

### Slide 29 - Kiến Trúc Hiện Tại (As-Is)
- **Audience move**: Xem xét kiến trúc 3 tầng đang vận hành của TopEngManager Chat.
- **Title**: KIẾN TRÚC AS-IS: MÔ HÌNH 3 TẦNG TRONG TOPENGMANAGER
- **Core message**: UI Context Provider &rarr; Dynamic Multi-Brain Gateway &rarr; Tool Plugins + n8n.

### Slide 30 - Cơ Chế Dynamic Multi-Brain
- **Audience move**: Tìm hiểu cách hệ thống luân chuyển linh hoạt giữa các bộ não AI.
- **Title**: CƠ CHẾ DYNAMIC MULTI-BRAIN: KHÔNG PHỤ THUỘC ĐƠN MÔ HÌNH
- **Core message**: Tích hợp DeepSeek, 9Router, Google Gemini 3.7, Claude và OpenAI tối ưu chi phí và tốc độ.

### Slide 31 - Enterprise Tool Plugins
- **Audience move**: Xem chi tiết hoạt động của các plugin đặt phòng và điều phối công việc.
- **Title**: ENTERPRISE TOOL PLUGINS: ROOM BOOKING & TASK MANAGEMENT
- **Core message**: Trực tiếp truy vấn và ghi nhận dữ liệu vào MySQL Database một cách an toàn.

### Slide 32 - Báo Cáo & Tự Động Hóa n8n
- **Audience move**: Nắm bắt cơ chế tự động xuất báo cáo ngày và kích hoạt workflow ngoài qua n8n.
- **Title**: TỰ ĐỘNG HÓA BÁO CÁO NGÀY & WORKFLOW ENGINE QUA N8N
- **Core message**: dailyReportPlugin kết hợp n8n Webhook bắn thông báo tức thời đa kênh.

### Slide 33 - Đánh Giá Năng Suất Thực Chiến
- **Audience move**: Nhìn nhận những con số đo lường hiệu quả cụ thể sau khi đưa AI Chat vào vận hành.
- **Title**: ĐÁNH GIÁ NĂNG SUẤT THỰC CHIẾN: CON SỐ VÀ HIỆU QUẢ VẬN HÀNH
- **Core message**: Tiết kiệm 45 phút/ngày cho mỗi kỹ sư, giảm 90% lỗi xung đột phòng họp.

### Slide 34 - Lộ Trình 4 Trụ Cột Tương Lai
- **Audience move**: Khám phá chiến lược công nghệ 4 trụ cột giai đoạn 2026 - 2027.
- **Title**: LỘ TRÌNH NÂNG CẤP 4 TRỤ CỘT TƯƠNG LAI (2026 - 2027)
- **Core message**: Enterprise RAG (Q4/26) &rarr; Multi-Agent (Q1/27) &rarr; Voice/Vision (Q2/27) &rarr; ERP/MES (Q3/27).

### Slide 35 - Tổng Kết & Phiên Thảo Luận
- **Audience move**: Lắng nghe thông điệp hành động kết thúc và sẵn sàng đặt câu hỏi thảo luận.
- **Title**: TỔNG KẾT TẦM NHÌN CHIẾN LƯỢC & PHIÊN THẢO LUẬN (Q&A)
- **Core message**: TOPVSystem tiên phong làm chủ AI Agent; mời Ban Lãnh đạo và Kỹ sư thảo luận.

## X. Speaker Notes Strategy

- Toàn bộ 35 slide đều có kịch bản thuyết minh chi tiết bằng Tiếng Việt (chứa trong `notes/total.md` và tách ra `notes/P01.md` đến `notes/P35.md`).
- Phong cách thuyết minh tự nhiên, diễn giải mạch lạc từ nguyên lý khoa học đến thực tiễn vận hành doanh nghiệp.
- Nhấn mạnh số liệu, liên kết chặt chẽ với giải pháp công nghệ tại TOPVSystem.
