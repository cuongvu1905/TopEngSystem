# Danh sách tài khoản kiểm thử hệ thống (TopEng Manager)

Tài liệu này chứa thông tin các tài khoản thử nghiệm tương ứng với từng vai trò/vị trí trong hệ thống sau khi đã làm sạch cơ sở dữ liệu.

## Thông tin đăng nhập chung
- **Mật khẩu mặc định**: `123456`
- **Đường dẫn ứng dụng**: `http://localhost:3000`

## Danh sách tài khoản

| Họ và tên | Email | Vai trò hệ thống | Phòng ban | Chức vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Nguyễn Admin** | `admin@test.com` | `Quản trị viên (Admin)` | Phòng Hành chính Nhân sự (HR) | Giám đốc bộ phận (Director) |
| **Trần Nhân Sự** | `hr@test.com` | `Nhân sự (HR)` | Phòng Hành chính Nhân sự (HR) | Trưởng phòng (Manager) |
| **Lê Nhân Viên** | `staff@test.com` | `Nhân viên (Staff)` | Phòng Phát triển Phần mềm (R&D) | Nhân viên chính thức (Staff) |
| **Phạm Trưởng Nhóm** | `leader@test.com` | `Leader/Part Leader` | Phòng Phát triển Phần mềm (R&D) | Trưởng nhóm kỹ thuật (Technical Lead) |
| **Vũ Kinh Doanh** | `sales@test.com` | `Kinh doanh (Sales)` | Phòng Kinh doanh (Sales) | Trưởng phòng (Manager) |
| **Nguyễn Điều Hành** | `bod@test.com` | `Ban điều hành (BOD)` | Phòng Kế toán Tài chính | Giám đốc bộ phận (Director) |

---

## Hướng dẫn kiểm thử nhanh
1. Truy cập vào ứng dụng tại [http://localhost:3000](http://localhost:3000)
2. Sử dụng email của tài khoản muốn kiểm thử kèm mật khẩu `123456` để đăng nhập.
3. Kiểm tra các chức năng và quyền truy cập đặc thù của vai trò đó (Tham khảo phân quyền trong `PHAN_QUYEN.md`).
4. Sử dụng nút đăng xuất nhanh ở góc trên bên phải để chuyển đổi giữa các tài khoản tiện lợi hơn.
