# Top System - Enterprise Management System (TopEng Manager)

Hệ thống quản lý nguồn lực doanh nghiệp tích hợp quản lý dự án, công việc, tài liệu và kênh chat realtime.

---

## 🚀 Tài khoản đăng nhập thử nghiệm (Demo Accounts)

Tất cả các tài khoản dưới đây đều sử dụng mật khẩu mặc định: **`123456`**

| Vai trò | Email đăng nhập | Chức vụ & Phòng ban | Quyền hệ thống |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@company.com` | Giám đốc Hành chính Nhân sự (`pos-director` - `dept-hr`) | Toàn quyền (Admin) |
| **Quản lý Nhân sự (HR Manager)** | `david.miller@company.com` | Trưởng phòng Nhân sự (`pos-manager` - `dept-hr`) | Quản trị viên (Admin) |
| **Trưởng nhóm kinh doanh (Sales Lead)** | `sarah.smith@company.com` | Trưởng nhóm Kinh doanh (`pos-lead` - `dept-sales`) | Leader/Part Leader |
| **Nhân viên lập trình (Developer)** | `john.doe@company.com` | Nhân viên Kỹ thuật (`pos-staff` - `dept-dev`) | Nhân viên (Staff) |

---

## 🛠️ Hướng dẫn cài đặt & Cấu hình Cơ sở dữ liệu

### 1. Cài đặt các gói phụ thuộc (Dependencies)
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### 2. Thiết lập Cơ sở dữ liệu MySQL
1. Khởi động MySQL Server trên máy tính cục bộ của bạn (cổng mặc định `3306`).
2. Tạo cơ sở dữ liệu và các bảng bằng cách chạy file script:
   ```bash
   Top_Sys.sql
   ```
3. Chèn dữ liệu mẫu (bao gồm các tài khoản demo phía trên) bằng cách chạy file script:
   ```bash
   insertdemodata.sql
   ```

### 3. Cấu hình Biến môi trường
Kiểm tra hoặc cập nhật các biến môi trường kết nối database trong file `.env.local` ở thư mục gốc dự án:
```env
MYSQL_HOST="localhost"
MYSQL_PORT="3306"
MYSQL_USER="root"
MYSQL_PASSWORD="your_mysql_password_here"
MYSQL_DATABASE="topsystemdb"
```

### 4. Khởi chạy Ứng dụng
Khởi động máy chủ Next.js ở môi trường phát triển:
```bash
npm run dev
```
Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000)

---

## 📂 Cấu trúc dự án chính

* `Top_Sys.sql`: File script khởi tạo database 15 bảng theo sơ đồ UML.
* `insertdemodata.sql`: File script chèn dữ liệu mẫu (các phòng ban, vị trí và 4 tài khoản thử nghiệm).
* `src/components/AppLayout.js`: Wrapper kiểm soát trạng thái render và tự động đẩy người dùng chưa đăng nhập về trang chủ.
* `src/context/AppContext.js`: Context quản lý trạng thái đăng nhập, người dùng hiện tại và đồng bộ hóa các bảng dữ liệu.
* `src/utils/db.js`: Bộ điều phối Database Adapter (MySQL Backend API vs MockDB Local).
