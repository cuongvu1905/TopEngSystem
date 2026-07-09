# Hướng dẫn Phân quyền Hệ thống (TopEng Manager)

Tài liệu này chi tiết hóa ma trận phân quyền người dùng (Role-Based Access Control - RBAC) đối với **5 vai trò chính** trong doanh nghiệp được yêu cầu:
1. **Quản trị viên (Admin)**
2. **Ban điều hành (BOD - Cấp cao nhất)**
3. **Leader / Part Leader**
4. **Nhân viên (Staff)**
5. **Nhân sự (HR)**

---

## 1. Ma trận Phân quyền Tổng quan (Permissions Matrix)

Dưới đây là bảng tổng hợp quyền hạn truy cập của các vai trò đối với từng phân hệ chức năng:

| Phân hệ chức năng | Quản trị viên (Admin) | Ban điều hành (BOD) | Leader / Part Leader | Nhân viên (Staff) | Nhân sự (HR) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Bảng điều khiển (Dashboard)** | Xem toàn bộ | Xem toàn bộ | Xem toàn bộ | Chỉ xem dự án tham gia | ❌ Bị chặn |
| **Danh sách Dự án** | Xem toàn bộ | Xem toàn bộ | Xem toàn bộ | Chỉ xem dự án tham gia | ❌ Bị chặn |
| **Chi tiết Dự án** | Truy cập toàn bộ | Truy cập toàn bộ | Truy cập toàn bộ | Chỉ dự án tham gia | ❌ Bị chặn |
| **Thao tác Dự án (CRUD)** | Toàn quyền | Toàn quyền | ❌ Không | ❌ Không | ❌ Không |
| **Giao việc & Quản lý Task** | Toàn quyền | Chỉ Sửa / Xóa | Toàn quyền | ❌ Không | ❌ Không |
| **Cập nhật trạng thái Task** | Có | ❌ Bị cấm | Có | Có (Chỉ task được giao) | ❌ Không |
| **Đăng Issue (Jira-style)** | Có | ❌ Không | Có | Có (Chỉ dự án tham gia) | ❌ Không |
| **Cập nhật trạng thái Issue** | Chỉ khi là reporter/được tag | ❌ Không | Chỉ khi là reporter/được tag | Chỉ khi là reporter/được tag | ❌ Không |
| **Xem Tài liệu chung** | Có | Có | Có | Có | Có |
| **Xem Tài liệu dự án** | Có | Có | Có | Chỉ dự án tham gia | ❌ Không |
| **Trò chuyện (Chat)** | Toàn quyền | Toàn quyền | Toàn quyền | Chat (Không tag @all global) | Chat (Không tag @all) |
| **Quản lý Nhân sự (HR)** | Toàn quyền | ❌ Bị chặn | ❌ Bị chặn | ❌ Bị chặn | Toàn quyền |
| **Nhật ký hệ thống (Logs)** | Xem toàn bộ | ❌ Bị chặn | ❌ Bị chặn | ❌ Bị chặn | ❌ Bị chặn |
| **Dự án công khai (Public)** | Có | Có | Có | Có | Có |

*Chú thích:*
- **Toàn quyền:** Có quyền Tạo, Đọc, Cập nhật và Xóa (CRUD).
- **❌ Bị chặn / Bị cấm:** Giao diện bị khóa hoặc nút chức năng bị vô hiệu hóa, cố tình truy cập sẽ hiển thị màn hình báo lỗi hoặc thông báo từ chối.

---

## 2. Chi tiết Quyền hạn theo từng Vai trò

### 2.1. Quản trị viên (Admin)
Là người quản trị hệ thống có quyền hạn cao nhất đối với toàn bộ tài nguyên.
- **Hệ thống & Cấu hình:** Xem toàn bộ Nhật ký hoạt động (Audit Logs), thực hiện bảo mật.
- **Nhân sự:** Truy cập phân hệ `/hr` để cấp tài khoản mới, phân vai trò hệ thống, gán phòng ban cho tất cả nhân viên.
- **Dự án:** Tạo mới, chỉnh sửa kế hoạch, gán thành viên và xóa dự án.
- **Công việc:** Tạo công việc, phân công người thực hiện, cập nhật trạng thái qua Kanban, quản lý subtask.
- **Issue:** Tạo issue mới. Cập nhật trạng thái của Issue do mình tạo hoặc được tag tên.
- **Trò chuyện:** Chat trong mọi phòng ban, sử dụng tag `@all` ở cả kênh chung công ty và kênh dự án. Có popup xác nhận trước khi gửi tin nhắn.

### 2.2. Ban điều hành (BOD - Cấp cao nhất)
Là cấp giám sát và định hướng dự án, tập trung vào lập kế hoạch và theo dõi tiến độ tổng quan.
- **Dự án:** Tạo mới dự án, chỉnh sửa kế hoạch (ngày bắt đầu/kết thúc, yêu cầu khách hàng) hoặc xóa dự án.
- **Công việc:** Sửa/Xóa nội dung công việc. **Cấm cập nhật trạng thái công việc (Task status update)** nhằm giữ tính trung thực của báo cáo từ cấp dưới.
- **Trò chuyện:** Tham gia trao đổi, tag `@all` trên kênh chung toàn công ty để thông báo các chính sách vĩ mô. Gửi tin nhắn có cảnh báo xác nhận trước khi phát đi.
- **Bị chặn:** Không có quyền truy cập trang Quản lý Nhân sự (`/hr`) và Nhật ký hệ thống (`/activity-logs`).

### 2.3. Leader / Part Leader
Là người trực tiếp điều phối, quản lý kỹ thuật và phân chia công việc trong đội ngũ.
- **Dự án:** Xem toàn bộ danh sách và chi tiết các dự án trong doanh nghiệp để học hỏi hoặc phối hợp.
- **Công việc:** Tạo công việc mới, giao việc cho các thành viên dự án, cập nhật trạng thái công việc, sửa/xóa công việc của dự án.
- **Issue:** Đăng issue mới báo cáo khó khăn. Được cập nhật trạng thái/đóng các issue do mình tạo hoặc được tag tên.
- **Trò chuyện:** Gửi tin nhắn trực tiếp không cần xác nhận. Tag `@all` trong phạm vi kênh chat dự án để triệu tập đội ngũ.
- **Bị chặn:** Không có quyền tạo/xóa dự án, không được truy cập trang Quản lý Nhân sự (`/hr`) và Nhật ký hệ thống (`/activity-logs`).

### 2.4. Nhân viên (Staff)
Là lực lượng trực tiếp thực thi các công việc chuyên môn.
- **Dự án:** Chỉ xem và truy cập các dự án mà mình được gán là thành viên (Project Member). Các dự án khác sẽ bị chặn và cảnh báo: *"Bạn không có quyền truy cập vì không thuộc dự án này"*.
- **Công việc:** Xem công việc được phân công, tự cập nhật tiến độ công việc của mình (kéo thả trạng thái Todo -> In Progress -> Review -> Done), check/uncheck các subtask nhỏ để báo cáo tiến độ.
- **Issue (Jira-style):** Đăng issue kỹ thuật hoặc bug của dự án mình tham gia. Chỉ người đăng hoặc người được nhắc tên (`@mentions`) mới có quyền sửa đổi thông tin hoặc đổi trạng thái/đóng Issue.
- **Trò chuyện:** Chat trong kênh chung (chỉ đọc hoặc chat thường tùy cấu hình) và kênh dự án tham gia. Không được dùng tag `@all`.
- **Tài liệu:** Đọc tài liệu chung, tài liệu đào tạo và tài liệu của dự án tham gia. Tải lên tài liệu mới vào các dự án mình tham gia.
- **Bị chặn:** Chặn hoàn toàn khỏi phân hệ `/hr` và `/activity-logs`.

### 2.5. Nhân sự (HR)
Tập trung vào quản lý nhân sự và các tài liệu chung, quy định nội bộ của công ty.
- **Quản lý Nhân sự:** Truy cập toàn quyền phân hệ `/hr` để xem thông tin nhân sự, tạo tài khoản mới cho nhân viên mới và cấu hình vai trò.
- **Báo cáo ngày:** Xem báo cáo ngày của tất cả nhân sự trong công ty để phục vụ đánh giá chuyên cần và kỷ luật.
- **Tài liệu:** Quản lý và tải lên Tài liệu chung, Tài liệu đào tạo (quy trình onboarding, tuyển dụng).
- **Trò chuyện:** Nhắn tin trong kênh chung công ty (có cảnh báo xác nhận trước khi gửi). Không được dùng tag `@all` kênh chung.
- **Bị chặn dự án:** **Bị chặn hoàn toàn khỏi phân hệ Dự án**. Không được xem danh sách dự án, không được vào chi tiết dự án (truy cập bằng URL sẽ hiển thị màn hình khóa quyền: *"Nhân sự (HR) không được phép truy cập chi tiết dự án"*).

---

## 3. Các Quy tắc Phân quyền Đặc biệt trong Code

### 3.1. Xác nhận trước khi gửi tin nhắn (Ask before send)
Đối với các vai trò quản lý hoặc có tầm ảnh hưởng lớn: **Admin, HR, Kinh doanh (Sales), BOD**.
- Khi nhấn gửi tin nhắn trên kênh trò chuyện, trình duyệt sẽ hiển thị hộp thoại xác nhận: `"Bạn có chắc chắn muốn gửi tin nhắn này?"`.
- Mục đích: Tránh việc gửi nhầm thông tin chưa kiểm chứng hoặc thông tin sai lệch lên các kênh truyền thông nội bộ.

### 3.2. Quyền sử dụng thẻ tag `@all`
- **Kênh chung doanh nghiệp (Global Room):** Chỉ **Admin, Kinh doanh (Sales), BOD** được phép dùng tag `@all`. Các vai trò khác sử dụng sẽ bị chặn và báo lỗi.
- **Kênh dự án (Project Room):** Chỉ **Admin, Leader, Kinh doanh (Sales)** được phép dùng tag `@all` để triệu tập thành viên dự án.

### 3.3. Cơ chế cập nhật trạng thái Issue (Jira-style)
Để tránh việc các thành viên không liên quan tự ý đóng hoặc sửa lỗi của nhau:
- Quyền sửa thông tin hoặc chuyển trạng thái Issue chỉ dành cho **Người đăng (Reporter)** hoặc **Thành viên được tag tên chịu trách nhiệm**.
- Ngoại lệ: Nếu Issue được tag lựa chọn `"Cả nhóm dự án"`, mọi thành viên thuộc dự án đó đều có quyền thao tác cập nhật trạng thái.

### 3.4. Vô hiệu hóa cập nhật trạng thái công việc với BOD (Restricted BOD)
- Ban điều hành (BOD) có quyền tạo, sửa nội dung hoặc xóa công việc nhưng **không được phép cập nhật trạng thái (Status)** của công việc trên bảng Kanban hoặc Modal chi tiết (ô chọn trạng thái bị vô hiệu hóa - `disabled`).
- Điều này đảm bảo tiến độ công việc chỉ được xác nhận khách quan bởi người thực hiện trực tiếp (Nhân viên) hoặc người quản lý trực tiếp (Leader/Admin).

### 3.5. Chặn phân quyền Dự án đối với Nhân sự (HR Restricted)
- Nhân sự (HR) hoàn toàn không tham gia vào các hoạt động sản xuất, kỹ thuật hoặc quản lý dự án. Do đó, toàn bộ menu Dự án trên thanh bên (Sidebar) và các trang chi tiết dự án (`/projects`, `/projects/[id]`) đều bị chặn và trả về màn hình Access Denied đối với vai trò HR.
