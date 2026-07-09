# Tóm tắt Hệ thống Quản lý Doanh nghiệp (TopEng Manager)

Tài liệu này tóm tắt toàn bộ cấu trúc và các chức năng đã triển khai của dự án **TopEng Manager**, được chia thành 3 phần chính: **Cơ sở dữ liệu (Database)**, **Dịch vụ máy chủ (Backend)**, và **Giao diện người dùng (Frontend)**.

---

## 1. Cơ sở dữ liệu (Database)

Hệ thống sử dụng cơ sở dữ liệu quan hệ **MySQL** (cấu hình trong `Top_Sys.sql`). Lược đồ cơ sở dữ liệu bao gồm **15 bảng** được thiết kế để chuẩn hóa dữ liệu và ràng buộc toàn vẹn khóa ngoại chặt chẽ:

1. **`Department`**: Quản lý thông tin phòng ban (Phát triển phần mềm, Nhân sự, Kinh doanh, Marketing, Kế toán).
2. **`Position`**: Quản lý chức vụ nhân viên (Thực tập sinh, Nhân viên, Trưởng nhóm, Trưởng phòng, Giám đốc).
3. **`Customer`**: Lưu trữ danh sách khách hàng/đối tác doanh nghiệp.
4. **`User`**: Lưu thông tin tài khoản người dùng, liên kết phòng ban, chức vụ, mật khẩu băm (MD5), và vai trò phân quyền hệ thống (`Quản trị viên (Admin)`, `Nhân sự (HR)`, `Nhân viên (Staff)`, `Leader/Part Leader`, `Kinh doanh (Sales)`, `Ban điều hành (BOD)`).
5. **`Project`**: Lưu thông tin dự án, khóa dự án (`project_key`) dùng để tạo mã lỗi Jira, người tạo, và khách hàng liên quan.
6. **`ProjectMember`**: Bảng trung gian thể hiện mối quan hệ nhiều-nhiều giữa thành viên và dự án kèm vai trò dự án (`PM`, `Member`).
7. **`Issue`**: Quản lý lỗi và vướng mắc kỹ thuật kiểu Jira. Bao gồm các thuộc tính: `issue_key` (tự động tăng, ví dụ: `CRM-101`), `type` (STORY, TASK, BUG, EPIC), `status` (BACKLOG, TO_DO, IN_PROGRESS, DONE), `priority` (LOW, MEDIUM, HIGH, CRITICAL), người báo cáo (`reporter_id`), và người xử lý (`assignee_id`).
8. **`IssueComments`**: Lưu bình luận trao đổi bên dưới từng Issue.
9. **`IssueHistory`**: Nhật ký ghi nhận lịch sử thay đổi thuộc tính của Issue (thay đổi trạng thái, độ ưu tiên, người xử lý...).
10. **`Task`**: Danh sách công việc thông thường thuộc dự án, phân công người nhận (`assignee_id`), độ ưu tiên, và hạn chót (`due_date`).
11. **`Subtask`**: Các đầu việc nhỏ (checklist) phụ thuộc vào một Task cha.
12. **`Notificyations`**: Lưu trữ các thông báo hệ thống được gửi đến người dùng cụ thể.
13. **`ActivityLogs`**: Lưu nhật ký hoạt động hệ thống (Audit Logs) để theo dõi các hành động tạo/sửa/xóa của người dùng.
14. **`DailyReport`**: Lưu trữ báo cáo hàng ngày của nhân viên.
15. **`ChatRooms`**: Danh sách các phòng trò chuyện (phòng chung toàn công ty, phòng thảo luận riêng theo từng dự án, và các phòng chat trực tiếp 1-1).
16. **`ChatRoomMember`**: Danh sách thành viên tham gia từng phòng trò chuyện.
17. **`Messages`**: Nội dung tin nhắn gửi trong phòng chat.
18. **`MessagesAttachment`**: File đính kèm đi cùng tin nhắn trong chat.

*Dữ liệu mẫu khởi tạo ban đầu được lưu trữ trong file [insertdemodata.sql](file:///d:/AntigravityFix/TopEngManager/insertdemodata.sql) chứa sẵn các tài khoản thử nghiệm tương ứng với các vai trò nhân sự khác nhau.*

---

## 2. Dịch vụ Máy chủ (Backend)

Dịch vụ Backend được phát triển bằng **Node.js** và **Express.js** đặt trong thư mục `/backend`.

### Kiến trúc kỹ thuật:
- **Cổng chạy**: Mặc định chạy ở cổng `5000` (`http://localhost:5000`).
- **Kết nối Database**: Sử dụng Connection Pool từ thư viện `mysql2/promise` để tối ưu hóa truy vấn đồng thời và tái sử dụng kết nối.
- **Xác thực**: Sử dụng cơ chế so khớp mật khẩu MD5 ở API `/api/login` và quản lý phiên đăng nhập qua dữ liệu phiên gửi về client.

### Các API chính (Controllers & Routes):
- **`authController`**:
  - Đăng nhập (`/api/login`), đăng ký (`/api/signup`), kiểm tra kết nối database (`/api/testConnection`).
  - Quản lý danh sách người dùng (`/api/getUsers`) và các vai trò hệ thống (`/api/getRoles`, `/api/createUser`).
- **`projectController`**:
  - Lấy danh sách dự án (`/api/getProjects`), danh sách thành viên dự án (`/api/getProjectMembers`).
  - Thêm mới/cập nhật dự án (`/api/saveProject`), đồng bộ thành viên dự án (`/api/addProjectMember`, `/api/removeProjectMember`).
  - Lấy thông tin khách hàng (`/api/getCustomers`) và phòng ban (`/api/getDepartments`).
- **`taskController`**:
  - Truy vấn danh sách công việc (`/api/getTasks`) và danh sách subtask (`/api/getSubtasks`).
  - Lưu công việc (`/api/saveTask`), cập nhật trạng thái công việc (`/api/updateTaskStatus`).
  - Quản lý checklist phụ (`/api/saveSubtask`, `/api/deleteSubtask`).
- **`issueController`**:
  - Quản lý vòng đời Issue kiểu Jira: Lấy danh sách lọc theo từ khóa, người gán, độ ưu tiên, phân loại (`/api/getIssues`).
  - Xem chi tiết Issue bao gồm bình luận và lịch sử thay đổi (`/api/getIssueDetail`).
  - Tạo mới Issue (`/api/createIssue`) tự động tạo mã `issue_key` theo định dạng `[Key_Dự_Án]-[Số_Tăng_Dần]` (bắt đầu từ `101`).
  - Cập nhật thông tin (`/api/updateIssue`), đổi trạng thái (`/api/updateIssueStatus`), bình luận (`/api/addComment`), xóa bình luận (`/api/deleteComment`), và xóa Issue.
- **`chatController`**:
  - Quản lý phòng chat (`/api/getChatRooms`), thành viên phòng chat (`/api/getChatRoomMembers`).
  - Tải tin nhắn cũ (`/api/getMessages`), gửi tin nhắn mới (`/api/sendMessage`).
  - Tạo phòng chat trực tiếp 1-1 (`/api/createDirectChat`).
- **`notificationController`**:
  - Xem danh sách thông báo cá nhân (`/api/getNotifications`), tạo thông báo mới (`/api/createNotification`), đánh dấu đã đọc (`/api/markNotificationRead`, `/api/markAllNotificationsRead`).
  - Xem nhật ký hệ thống (`/api/getActivityLogs`), ghi nhật ký mới (`/api/logActivity`).
- **`documentController`**:
  - Cung cấp các fallback API cho tài liệu giúp frontend hoạt động ổn định.

---

## 3. Giao diện Người dùng (Frontend)

Ứng dụng Frontend được xây dựng bằng **Next.js (v16.2)** và **React 19**, mang phong cách thiết kế hiện đại, responsive tốt và hỗ trợ chuyển đổi linh hoạt.

### Các thành phần & Logic lõi:
- **BFF (Backend-For-Frontend) Proxy (`/api/db`)**: Route trung gian trong Next.js tự động chuyển tiếp tất cả các yêu cầu gọi database từ trình duyệt client đến Server Express.js Backend ở cổng 5000, giúp tránh lỗi CORS và bảo mật đường truyền.
- **Database Adapter (`src/utils/db.js`)**: Cho phép hệ thống chuyển đổi linh hoạt giữa hai chế độ:
  - **MySQL Backend Mode** (`MySQLAdapter`): Đọc và ghi dữ liệu trực tiếp lên MySQL thông qua BFF.
  - **MockDB Local Mode** (`MockDB`): Lưu trữ dữ liệu giả lập trong bộ nhớ trình duyệt (localStorage), thuận tiện cho việc demo nhanh mà không cần cài đặt MySQL.
- **AppContext (`src/context/AppContext.js`)**: Quản lý phiên đăng nhập hiện tại, đồng bộ hóa trạng thái toàn ứng dụng (nạp lại thông tin dự án, công việc, thông báo khi có thay đổi).

### Các Module & Giao diện chức năng:
1. **Trang Chủ điều hướng (`src/app/page.js`)**: Tự động chuyển hướng người dùng chưa đăng nhập hoặc đã đăng nhập về trang Dashboard chính.
2. **Dashboard (`/dashboard`)**:
   - Hiển thị thống kê tổng quan (Dự án đang chạy, Công việc chưa xong, Thông báo chưa đọc, Tài liệu lưu trữ).
   - Biểu đồ tiến độ dự án cá nhân theo phần trăm công việc hoàn thành.
   - Danh sách thời hạn công việc sắp tới (đánh dấu đỏ các công việc quá hạn).
3. **Quản lý Dự án (`/projects` & `/projects/[id]`)**:
   - Hỗ trợ thêm/sửa thông tin dự án và gán thành viên (quyền điều khiển dành cho Admin, Sales, BOD).
   - Trang chi tiết dự án hỗ trợ các tab con:
     - **Bảng Kanban**: Kéo thả công việc linh hoạt giữa các trạng thái (Todo, InProgress, Review, Done).
     - **Quản lý Issue (Jira-style Board)**: Giao diện lọc nâng cao, tạo issue, chỉ định độ ưu tiên, cập nhật trạng thái kèm ghi lại lịch sử thay đổi hoạt động chi tiết của lỗi và bình luận.
     - **Nhóm trò chuyện dự án**: Hộp thoại thảo luận tích hợp, hỗ trợ tag tên thành viên dự án và công cụ tìm kiếm tin nhắn.
     - **Tài liệu**: Quản lý tài liệu phát sinh trong dự án.
4. **Quản lý Công việc (`/tasks`)**:
   - Bộ lọc và phân loại công việc được phân công cho người dùng hiện tại.
   - Xem chi tiết công việc, quản lý danh sách checklist phụ (subtasks).
5. **Trò chuyện trực tuyến (`/chat`)**:
   - Giao diện chat chia cột chuyên nghiệp: Danh sách phòng trò chuyện (Kênh chung toàn công ty, Kênh dự án, Kênh chat 1-1 trực tiếp).
   - Hỗ trợ gửi tin nhắn xác nhận trước khi phát đi cho các vai trò quản lý (Admin, HR, Sales, BOD) để tránh gửi tin nhắn lỗi.
   - Tích hợp GetStream Adapter (`StreamChatAdapter`) sẵn sàng chạy realtime qua dịch vụ đám mây nếu có API Key.
6. **Quản lý Nhân sự (`/hr`)**:
   - Dành riêng cho Quản trị viên (Admin) và Nhân sự (HR).
   - Thêm tài khoản mới, gán chức danh, phòng ban và phân quyền hệ thống.
7. **Lịch sử hoạt động (`/activity-logs`)**:
   - Giao diện bảng xem toàn bộ hành động người dùng, hỗ trợ lọc theo dự án, thành viên thực hiện hoặc hành động nghiệp vụ cụ thể. Chỉ dành cho Admin tra cứu sâu.
