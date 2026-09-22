# Kế hoạch Thực hiện: Plugin DeepSeek Local Folder RAG (Harness)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng Plugin Folder RAG tích hợp vào TopEng Agent Harness và DeepSeek (DSH/API), cho phép AI trả lời câu hỏi dựa DUY NHẤT trên các tài liệu trong thư mục chỉ định, chống bịa đặt và trích dẫn nguồn cụ thể.

**Architecture:** Bộ quét & phân tích đa định dạng (PDF, Word docx, Excel xlsx, Text, Code) -> Phân đoạn văn bản (Chunking) & Lập chỉ mục -> Hybrid Retriever (BM25/TF-IDF) -> Strict Prompt Injection cho DeepSeek -> Giao diện Chat Web trực quan trên TopEng Manager.

**Tech Stack:** Next.js (App Router), Node.js, `pdf-parse`, `mammoth`, `xlsx`, React 19, DeepSeek API / Local DSH (OpenAI-compatible).

**Spec:** `docs/superpowers/specs/2026-09-04-deepseek-folder-rag-plugin-design.md`

## Global Constraints
- Chỉ sử dụng thông tin trong thư mục được cung cấp để trả lời câu hỏi.
- Nếu không có thông tin trong tài liệu, AI bắt buộc trả lời: "Không tìm thấy thông tin này trong tài liệu của thư mục đã cung cấp."
- Hỗ trợ đầy đủ các định dạng: `.pdf`, `.docx`, `.xlsx`, `.xls`, `.txt`, `.md`, `.json`, `.csv`, `.js`, `.py`, `.sql`, `.html`, `.css`.
- Trích dẫn rõ nguồn file và số trang / vị trí trong câu trả lời.

---

### Task 1: Cài đặt Thư viện và Xây dựng Bộ Parser Đa Định Dạng (Document Parsers)

**Files:**
- Modify: `package.json`
- Create: `src/utils/documentParsers.js`
- Test: `scratch/test_document_parsers.js`

**Interfaces:**
- Produces: `parseFileContent(filePath, mimeType)` -> returns `{ text: string, metadata: object }`

- [ ] **Step 1: Cài đặt các package cần thiết (`pdf-parse`, `mammoth`, `xlsx`)**
- [ ] **Step 2: Viết `src/utils/documentParsers.js` hỗ trợ parse PDF, Word, Excel, Code và Text**
- [ ] **Step 3: Tạo test script `scratch/test_document_parsers.js` và kiểm tra parse các file mẫu**
- [ ] **Step 4: Chạy test và xác nhận kết quả**

---

### Task 2: Xây dựng Bộ Quét Thư mục & Phân đoạn Ngữ cảnh (Folder Indexer & Chunking)

**Files:**
- Create: `src/utils/folderIndexer.js`
- Test: `scratch/test_folder_indexer.js`

**Interfaces:**
- Consumes: `parseFileContent` từ `src/utils/documentParsers.js`
- Produces: `scanAndIndexFolder(folderPath)` -> returns `{ success: boolean, filesCount: number, chunks: Array<Chunk>, summary: Array<object> }`

- [ ] **Step 1: Viết `src/utils/folderIndexer.js` với cơ chế đệ quy duyệt thư mục, lọc bỏ các folder rác (`.git`, `node_modules`,...) và chunking văn bản có gối đầu (overlap)**
- [ ] **Step 2: Viết test script `scratch/test_folder_indexer.js`**
- [ ] **Step 3: Chạy test và xác nhận bộ indexer hoạt động chính xác**

---

### Task 3: Xây dựng Bộ Tìm kiếm Ngữ cảnh & Strict RAG Prompt Builder

**Files:**
- Create: `src/utils/ragRetriever.js`
- Test: `scratch/test_rag_retriever.js`

**Interfaces:**
- Consumes: `chunks` từ `folderIndexer.js`
- Produces: `retrieveRelevantChunks(query, chunks, topK = 5)` & `buildStrictRAGPrompt(query, relevantChunks, userPrompt)`

- [ ] **Step 1: Viết thuật toán BM25/TF-IDF scoring và Keyword Matching trong `src/utils/ragRetriever.js`**
- [ ] **Step 2: Viết hàm tạo Strict Prompt ép DeepSeek không bịa đặt và trích dẫn file**
- [ ] **Step 3: Viết test script `scratch/test_rag_retriever.js` kiểm tra độ khớp truy vấn**
- [ ] **Step 4: Chạy test xác nhận**

---

### Task 4: Xây dựng Plugin `knowledgeFolderPlugin.js` & Đăng ký vào Agent Harness

**Files:**
- Create: `src/plugins/knowledgeFolderPlugin.js`
- Modify: `src/plugins/index.js`
- Modify: `src/app/api/ai-chat/route.js`
- Create: `src/app/api/ai-chat/folder-indexer/route.js`

**Interfaces:**
- Consumes: `folderIndexer.js`, `ragRetriever.js`
- Produces: Tools `search_folder_knowledge`, `scan_local_folder`, `get_indexed_folder_status` trong `ALL_PLUGINS_SCHEMA`

- [ ] **Step 1: Viết `src/plugins/knowledgeFolderPlugin.js`**
- [ ] **Step 2: Đăng ký plugin vào `src/plugins/index.js`**
- [ ] **Step 3: Tạo route `src/app/api/ai-chat/folder-indexer/route.js` hỗ trợ scan/status từ frontend**
- [ ] **Step 4: Cập nhật `src/app/api/ai-chat/route.js` để hỗ trợ chế độ Strict Folder RAG khi người dùng kích hoạt**

---

### Task 5: Cập nhật Giao diện Chat UI & Modal Cấu hình Thư mục Tri thức

**Files:**
- Modify: `src/app/chat/page.js`

**Interfaces:**
- Cung cấp:
  1. Modal "Quản lý Thư mục Tri thức (Local Knowledge Folder)" (nhập đường dẫn, xem trạng thái quét, danh sách file).
  2. Nút Toggle `[📂 Chế độ Q&A Thư mục]` trên thanh công cụ chat.
  3. Badge hiển thị file trích dẫn nguồn dưới mỗi tin nhắn AI.

- [ ] **Step 1: Thêm State và Component Modal Quản lý Thư mục Tri thức vào `src/app/chat/page.js`**
- [ ] **Step 2: Thêm Toggle bật/tắt chế độ Strict Folder RAG trong giao diện chat**
- [ ] **Step 3: Tinh chỉnh hiển thị trích dẫn nguồn tài liệu trong tin nhắn của DeepSeek**

---

### Task 6: Kiểm thử Toàn diện End-to-End & Tinh chỉnh

**Files:**
- Test: `scratch/e2e_folder_rag_test.js`

- [ ] **Step 1: Tạo thư mục dữ liệu mẫu với các loại tài liệu (PDF, Word, Excel, Code, Markdown)**
- [ ] **Step 2: Chạy kiểm thử hỏi thông tin có trong tài liệu -> AI trả lời chính xác kèm trích dẫn**
- [ ] **Step 3: Chạy kiểm thử hỏi thông tin không có trong tài liệu -> AI từ chối theo đúng chỉ thị nghiêm ngặt**
- [ ] **Step 4: Xác nhận hoàn thành toàn bộ chức năng**
