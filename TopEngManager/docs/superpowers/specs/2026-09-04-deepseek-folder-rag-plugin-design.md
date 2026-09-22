# Đặc tả Thiết kế: Plugin DeepSeek Local Folder RAG (Q&A từ Thư mục Cục bộ)

## 1. Tổng quan (Overview)
Plugin này mở rộng khả năng cho **TopEng Agent Harness** kết hợp cùng mô hình **DeepSeek** (chạy cục bộ qua DSH/Ollama/LM Studio hoặc DeepSeek API), cho phép người dùng chỉ định một thư mục trên máy tính/hệ thống và AI sẽ trả lời các câu hỏi dựa **DUY NHẤT** trên dữ liệu trong thư mục đó. Hệ thống áp dụng chính sách Strict Zero-Hallucination, chống bịa đặt và luôn trích dẫn nguồn tài liệu cụ thể.

## 2. Yêu cầu Chức năng (Functional Requirements)
1. **Quét & Nạp Đa Định Dạng (Multi-Format Document Ingestion)**:
   - Hỗ trợ toàn diện các định dạng:
     - Văn bản & Code: `.txt`, `.md`, `.json`, `.csv`, `.js`, `.py`, `.sql`, `.html`, `.css`, `.xml`, `.log`, `.env.example`,...
     - PDF: `.pdf` (trích xuất nội dung văn bản từng trang qua `pdf-parse`).
     - Word: `.docx` (trích xuất qua `mammoth`).
     - Excel / Bảng tính: `.xlsx`, `.xls` (chuyển đổi sheet thành định dạng bảng dữ liệu có cấu trúc qua `xlsx`).
   - Tự động bỏ qua các thư mục nhị phân/hệ thống không cần thiết (như `.git`, `node_modules`, `.next`, `dist`, `build`, file nhị phân exe/dll/zip...).
2. **Cơ chế Phân đoạn & Lập chỉ mục Ngữ cảnh (Chunking & Indexing Engine)**:
   - Chia nhỏ văn bản thành các chunks có kích thước tiêu chuẩn (~600 từ) kèm khoảng gối đầu (~100 từ) để duy trì tính liền mạch của ngữ cảnh.
   - Gắn nhãn metadata chi tiết cho từng chunk: `filePath`, `fileName`, `fileType`, `page`/`sheet`, `chunkIndex`.
   - Lưu trữ in-memory cache hoặc index file nhẹ để truy vấn nhanh mà không cần quét lại từ đầu nếu thư mục không đổi.
3. **Cơ chế Tìm kiếm Ngữ cảnh Thông minh (Context Retrieval)**:
   - Thuật toán tìm kiếm kết hợp (BM25 / TF-IDF + Keyword Matching có trọng số).
   - Trích xuất top K (ví dụ top 3-5) đoạn ngữ cảnh có độ liên quan cao nhất đối với câu hỏi của người dùng.
4. **Quy tắc Kiểm soát Chống Bịa đặt Tuyệt đối (Strict Zero-Hallucination Directive)**:
   - Hệ thống inject chỉ thị nghiêm ngặt vào System Prompt của DeepSeek.
   - Nếu tài liệu không có thông tin, AI buộc phải trả lời: *"Không tìm thấy thông tin này trong tài liệu của thư mục đã cung cấp."*
   - Câu trả lời luôn kèm phần **"Trích dẫn nguồn tài liệu"** liệt kê tên file, vị trí/trang.
5. **Đăng ký Plugin vào TopEng Agent Harness**:
   - Khai báo Schema và Handler trong `src/plugins/knowledgeFolderPlugin.js`.
   - Kết nối vào `src/plugins/index.js` và API Route `src/app/api/ai-chat/route.js`.
6. **Cấu hình & Giao diện Người dùng (UI/UX)**:
   - Modal/Panel quản lý thư mục tri thức trong giao diện AI Chat: Nhập đường dẫn thư mục, nút "Quét & Lập chỉ mục", hiển thị danh sách file & số lượng chunks.
   - Nút bật/tắt (Toggle) chế độ: `Chỉ hỏi từ Thư mục Tri thức (Folder RAG Mode)`.
   - Form cấu hình DeepSeek / DSH endpoint (Base URL, Model Name, API Key).

## 3. Kiến trúc Kỹ thuật (Technical Architecture)

```
[Web Chat UI (Next.js)]
   │
   ├──> 1. Gửi cấu hình Thư mục & Câu hỏi
   │
[API Route / Backend Service]
   │
   ├──> 2. FolderScanner & Parser (pdf-parse, mammoth, xlsx, text)
   │       └──> Tạo Document Chunks với Metadata
   │
   ├──> 3. Hybrid Retriever
   │       └──> Chọn lọc Top K Chunks phù hợp nhất
   │
   ├──> 4. Prompt Builder (System Prompt + Strict Rule + Retrieved Chunks + User Question)
   │
[DeepSeek Model (DSH Local / Custom API)]
   │
   └──> 5. Trả lời chính xác + Trích dẫn nguồn
```

## 4. Kế hoạch Tích hợp & Kiểm thử (Integration & Verification)
1. **Kiểm thử đọc file**: Kiểm tra việc phân tích nội dung trên các file mẫu (PDF, Word docx, Excel xlsx, Text txt/md, Code js/json).
2. **Kiểm thử tìm kiếm**: Đặt câu hỏi có nội dung chính xác trong tài liệu, kiểm tra AI trả lời đúng và trích dẫn file.
3. **Kiểm thử chống bịa đặt**: Đặt câu hỏi về nội dung hoàn toàn không có trong thư mục, kiểm tra AI từ chối trả lời ngoài tài liệu theo đúng chỉ thị.
4. **Kiểm thử chuyển đổi chế độ**: Bật/tắt chế độ Folder RAG trên giao diện UI để đảm bảo hoạt động trơn tru.
