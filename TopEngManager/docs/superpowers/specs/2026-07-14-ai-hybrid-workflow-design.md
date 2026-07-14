# Thiết kế Hệ thống Hỗ trợ AI (AI-Assisted Hybrid Workflow Design)

Tài liệu này mô tả thiết kế chi tiết cho việc cài đặt thêm các công cụ hỗ trợ AI (CLI query script, Github Actions CI, và tài liệu ERD dùng Mermaid) trong dự án **TopEng Manager**.

---

## 1. Công cụ truy vấn Database qua Command Line (`backend/scripts/db-query.js`)

### Mục tiêu
Cho phép AI thực hiện trực tiếp các câu lệnh truy vấn SQL (chủ yếu là `SELECT`, `DESCRIBE` hoặc kiểm tra dữ liệu) thông qua Terminal, giúp xác thực logic nghiệp vụ và dữ liệu thực tế mà không cần làm phiền người dùng chạy hộ câu lệnh.

### Thiết kế kỹ thuật
- **Đường dẫn file:** `backend/scripts/db-query.js`
- **Thư viện sử dụng:**
  - `dotenv`: Để đọc cấu hình database từ file `backend/.env`.
  - `mysql2/promise`: Để mở kết nối Pool và chạy câu lệnh bất đồng bộ.
- **Cách thức hoạt động:**
  - AI chạy lệnh: `node backend/scripts/db-query.js "<CÂU_LỆNH_SQL>"`
  - Script sẽ đọc tham số từ dòng lệnh, kết nối cơ sở dữ liệu MySQL, thực thi câu lệnh và trả về kết quả dưới dạng JSON đẹp (pretty-printed JSON) hiển thị trên console.
  - Tự động ngắt kết nối khi kết thúc.

### Mã nguồn tham khảo (Draft)
```javascript
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function main() {
  const query = process.argv[2];
  if (!query) {
    console.error(JSON.stringify({ error: "Missing SQL query argument" }));
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'topsystemdb',
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
    });

    const [rows] = await connection.query(query);
    console.log(JSON.stringify({ success: true, results: rows }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ success: false, error: error.message, stack: error.stack }, null, 2));
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
```

---

## 2. Github CI/CD Workflows (`.github/workflows/ci.yml`)

### Mục tiêu
Tự động hóa quá trình kiểm tra lỗi cú pháp (Lint) và thử nghiệm build thành phẩm khi có thay đổi code đẩy lên Github.

### Thiết kế kỹ thuật
- **Đường dẫn file:** `.github/workflows/ci.yml`
- **Các bước thực thi (Jobs):**
  - **Lint & Build Frontend (Next.js):** Chạy `npm install`, `npm run lint` và `npm run build`.
  - **Lint & Test Backend (Node.js/Express.js):** Chạy `cd backend && npm install`, và kiểm tra cú pháp code.
  - **Database Import Check:**
    - Khởi tạo service container `mysql:8.0` trong môi trường ảo của Github Actions.
    - Cấp quyền truy cập và import file `schema.sql` (hoặc `Top_Sys.sql`) để đảm bảo các câu lệnh SQL khởi tạo không bị lỗi cú pháp hay xung đột khóa ngoại.

---

## 3. Tài liệu hóa ERD bằng Mermaid.js (`docs/database/ERD.md`)

### Mục tiêu
Cung cấp sơ đồ quan hệ thực thể (Entity Relationship Diagram - ERD) chuẩn của 18 bảng hiện tại dưới dạng text-based diagram (Mermaid) để AI có thể đọc trực tiếp từ repository, từ đó hiểu cấu trúc liên kết khóa ngoại trước khi đưa ra truy vấn.

### Sơ đồ dự kiến
Sử dụng cú pháp Mermaid ERD để biểu diễn:
- `User` thuộc `Department` và giữ `Position`.
- `Project` liên kết nhiều-nhiều với `User` qua `ProjectMember`.
- `Issue` thuộc `Project`, có `reporter` và `assignee` thuộc bảng `User`.
- `Task` thuộc `Project` và có `assignee`.
- `DailyReport` thuộc về `User` và liên kết với `Project`.
- `ChatRooms` chứa `ChatRoomMember` và các `Messages`.

---

## Kế hoạch triển khai (Verification Plan)
1. **Bước 1:** Tạo file script `backend/scripts/db-query.js`.
2. **Bước 2:** Chạy kiểm thử thủ công lệnh `node backend/scripts/db-query.js "SELECT 1 + 1 AS test"` để đảm bảo kết nối CSDL và hiển thị định dạng JSON hoạt động đúng.
3. **Bước 3:** Tạo thư mục `.github/workflows` và lưu file `ci.yml`.
4. **Bước 4:** Tạo thư mục `docs/database` và lưu file `ERD.md`.
