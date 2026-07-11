# Thiết kế Thay đổi Cột Màu Nhận Diện sang Phòng Ban trong Quản Lý Nhân Sự

Tài liệu này mô tả thiết kế kỹ thuật cho việc loại bỏ cột "Màu nhận diện" và thay thế bằng cột "Phòng ban" trong danh sách nhân viên của trang Quản trị Hệ thống & Nhân sự.

## Mục tiêu
- Loại bỏ thông tin màu nhận diện không cần thiết hiển thị trên bảng danh sách nhân viên.
- Hiển thị thông tin phòng ban trực thuộc của từng nhân viên để nâng cao trải nghiệm quản trị nhân sự chéo.

## Thay đổi đề xuất

### 1. Phía Backend (API)

#### [MODIFY] [authController.js](file:///c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/backend/controllers/authController.js)
- Cập nhật hàm `getUsers` để kết nối quan hệ với bảng `department` khi lấy danh sách người dùng.
- Trả về thêm trường `department_name` của nhân viên.

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

### 2. Phía Frontend (UI)

#### [MODIFY] [page.js](file:///c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/src/app/hr/page.js)
- Thay đổi cột trong bảng `data-table` tại danh sách nhân viên:
  - Tiêu đề: Đổi `<th>Màu nhận diện</th>` thành `<th>Phòng ban</th>`.
  - Giá trị: Thay thế cột chấm tròn màu/mã màu bằng `<td>{u.department_name || 'Chưa phân phòng'}</td>`.

## Kế hoạch kiểm thử & Xác minh
1. Khởi chạy Backend và Frontend.
2. Truy cập trang `/hr`.
3. Kiểm tra danh sách nhân viên để đảm bảo cột phòng ban hiển thị chính xác tên phòng ban tương ứng.
4. Đảm bảo cột Màu nhận diện cũ không còn xuất hiện.
