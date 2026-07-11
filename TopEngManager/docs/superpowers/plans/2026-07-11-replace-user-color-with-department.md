# Thay Đổi Cột Màu Nhận Diện Sang Phòng Ban Trong Quản Lý Nhân Sự Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế cột hiển thị màu nhận diện (Identification Color) của nhân viên bằng cột phòng ban trực thuộc (Department) trong bảng danh sách nhân sự.

**Architecture:** Cập nhật hàm `getUsers` trong API Controller của Backend để truy vấn kèm thông tin từ quan hệ `department` qua Prisma và trả về `department_name`. Ở Frontend, cập nhật cột bảng danh sách để đổi từ tiêu đề "Màu nhận diện" và giá trị mã màu sang hiển thị tên phòng ban.

**Tech Stack:** Node.js, Express, Next.js, Prisma ORM, MySQL

## Global Constraints
- Không làm gián đoạn các tính năng khác sử dụng thuộc tính `color` trên đối tượng người dùng (ví dụ: hình nền đại diện/avatar).
- Đảm bảo xử lý trường hợp giá trị phòng ban là null (hiển thị "Chưa phân phòng").

---

### Task 1: Cập nhật API Backend `getUsers`

**Files:**
- Modify: `backend/controllers/authController.js:109-124`

**Interfaces:**
- Consumes: Prisma Client và cơ sở dữ liệu MySQL hiện tại
- Produces: API `/api/getUsers` trả về danh sách nhân viên có thuộc tính `department_name`

- [ ] **Step 1: Thay đổi code `getUsers` trong controller**
  Cập nhật hàm `getUsers` trong [authController.js](file:///c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/backend/controllers/authController.js) để sử dụng `include: { department: true }` và ánh xạ tên phòng ban vào kết quả trả về.

  Code cần thay thế:
  ```javascript
  exports.getUsers = async (req, res, next) => {
    try {
      const dbUsers = await prisma.user.findMany({
        include: {
          department: true
        }
      });
      const users = dbUsers.map(u => ({
        id: u.user_id,
        name: u.full_name,
        email: u.email,
        system_role: u.role,
        department_id: u.department_id,
        department_name: u.department ? u.department.name : 'Chưa phân phòng',
        color: '#1E40AF'
      }));
      res.json(users);
    } catch (err) {
      next(err);
    }
  };
  ```

- [ ] **Step 2: Xác minh API trả về trường `department_name`**
  Thử nghiệm bằng cách chạy Backend và gửi yêu cầu POST đến endpoint `/api/getUsers` (nếu server đang hoạt động) hoặc dùng cURL/Postman sau khi chạy ứng dụng để đảm bảo cấu trúc JSON trả về có trường `department_name`.

---

### Task 2: Cập nhật UI Frontend Quản lý nhân sự

**Files:**
- Modify: `src/app/hr/page.js:212-246`

**Interfaces:**
- Consumes: API `/api/getUsers` trả về người dùng có `department_name`
- Produces: Giao diện danh sách nhân viên mới hiển thị cột "Phòng ban" thay cho "Màu nhận diện"

- [ ] **Step 1: Đổi tiêu đề cột trong bảng**
  Tìm dòng chứa các tiêu đề cột bảng `data-table` trong `src/app/hr/page.js` và đổi `<th>Màu nhận diện</th>` thành `<th>Phòng ban</th>`.

- [ ] **Step 2: Đổi giá trị hiển thị cột**
  Tìm đoạn lặp qua `users.map(u => ...)` trong thân bảng và sửa ô `<td>` cuối cùng từ việc render chấm tròn màu và mã màu hex thành việc render `{u.department_name || 'Chưa phân phòng'}`.

  Code thay thế cụ thể:
  ```jsx
  <td>
    {u.department_name || 'Chưa phân phòng'}
  </td>
  ```

- [ ] **Step 3: Kiểm tra giao diện trên trình duyệt**
  Tải lại trang `http://localhost:3000/hr` và kiểm chứng bảng danh sách nhân viên có cột "Phòng ban" với dữ liệu chính xác.
