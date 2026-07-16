# Thiết kế: Cho phép chỉnh sửa Mã dự án (Project Key)

Tài liệu thiết kế chi tiết tính năng cho phép các vai trò được chỉ định cập nhật Mã dự án (Project Key) khi chỉnh sửa thông tin dự án.

## 1. Yêu cầu & Mục tiêu

* **Mục tiêu**: Bổ sung quyền chỉnh sửa "Mã dự án" trong form "Chỉnh Sửa Dự Án" cho 4 nhóm vai trò: Admin, Team Leader (Leader), PM, và Kinh doanh (Sales).
* **Ràng buộc**:
  * Mã dự án là duy nhất (`UNIQUE` ở cơ sở dữ liệu) và giới hạn tối đa 10 ký tự.
  * Khi lưu, mã dự án mới phải được kiểm tra trùng lặp trên cơ sở dữ liệu.
  * Nếu mã dự án mới trùng với dự án khác, trả về lỗi 400 và không cho phép cập nhật.
  * Dữ liệu mã dự án khi gửi lên database phải được chuẩn hóa thành chữ viết hoa (UPPERCASE) và cắt bỏ các khoảng trắng thừa.

## 2. Thiết kế Kiến trúc & Luồng dữ liệu

### 2.1. Luồng dữ liệu (Data Flow)
```mermaid
sequenceDiagram
    actor User as Admin/Leader/PM/Sales
    participant FE as Frontend (ProjectModal)
    participant BFF as BFF Proxy (/api/db)
    participant BE as Express Backend (/api/saveProject)
    database DB as MySQL Database

    User->>FE: Thay đổi Mã dự án & nhấn "Lưu thay đổi"
    FE->>BFF: POST /api/db { action: "saveProject", payload: { proj, membersList } }
    BFF->>BE: POST /api/saveProject { proj, membersList }
    BE->>DB: Kiểm tra project_key trùng lặp (không bao gồm dự án hiện tại)
    alt Trùng lặp
        DB-->>BE: Kết quả tồn tại
        BE-->>FE: Lỗi 400: "Mã dự án '<KEY>' đã tồn tại ở dự án khác!"
        FE-->>User: Hiển thị Alert Thất bại (SweetAlert)
    else Hợp lệ
        DB-->>BE: Kết quả không trùng lặp
        BE->>DB: UPDATE Project SET project_key = <KEY> ... WHERE project_id = <ID>
        DB-->>BE: OK
        BE-->>FE: Kết quả thành công (200 OK)
        FE-->>User: Đóng modal, hiển thị Alert Thành công & Reload trang
    end
```

### 2.2. Kiểm tra quyền ở Frontend
* **Đối tượng**: `currentUser`
* **Logic phân quyền**:
  * Nếu là dự án mới (`!projectId`): Mọi người dùng có quyền mở modal đều được nhập mã dự án.
  * Nếu là chỉnh sửa dự án (`projectId`): Cho phép sửa nếu người dùng thỏa mãn một trong các điều kiện sau:
    * Vai trò hệ thống (`system_role`) chứa `"Admin"`.
    * Vai trò hệ thống (`system_role`) chứa `"Leader"`.
    * Vai trò hệ thống (`system_role`) chứa `"Kinh doanh"` hoặc `"Sales"`.
    * Vai trò dự án của người dùng hiện tại là `"PM"` (`selectedMembers[currentUser.id] === 'PM'`).

## 3. Chi tiết các thay đổi mã nguồn

### 3.1. Frontend: [Modals.js](file:///c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/src/components/Modals.js)
* Thêm logic định nghĩa `canEditProjectKey`:
  ```javascript
  const canEditProjectKey = !projectId || 
    currentUser?.system_role?.includes("Admin") || 
    currentUser?.system_role?.includes("Leader") || 
    currentUser?.system_role?.includes("Kinh doanh") || 
    currentUser?.system_role?.includes("Sales") || 
    selectedMembers[currentUser?.id] === 'PM';
  ```
* Cập nhật thuộc tính `disabled` của input Mã dự án:
  ```diff
  - disabled={!!projectId}
  + disabled={!canEditProjectKey}
  ```

### 3.2. Backend: [projectController.js](file:///c:/Users/mrcuo/Downloads/TopEngSystem-main/TopEngSystem-main/TopEngManager/backend/controllers/projectController.js)
* Sửa logic nhánh `else` (update) của hàm `saveProject`:
  1. Trích xuất `projectKey` từ `proj.project_key`.
  2. Báo lỗi `400` nếu `projectKey` rỗng hoặc để trống.
  3. Kiểm tra trùng lặp mã dự án với các dự án khác:
     ```javascript
     const existing = await prisma.project.findFirst({
       where: {
         project_key: projectKey,
         NOT: { project_id: id }
       }
     });
     ```
  4. Cập nhật câu lệnh SQL `UPDATE Project` để lưu `project_key`.

## 4. Kế hoạch xác minh (Verification Plan)

### Kiểm thử thủ công:
1. Đăng nhập bằng tài khoản `Quản trị viên (Admin)` (`admin@test.com`).
   * Truy cập chi tiết dự án bất kỳ, bấm nút Chỉnh sửa.
   * Xác nhận input "Mã dự án" được mở khóa (không bị disable).
   * Thay đổi mã sang một mã chưa tồn tại và Lưu thay đổi -> Xác nhận lưu thành công.
   * Thay đổi mã sang một mã đã tồn tại ở dự án khác và Lưu -> Xác nhận hệ thống báo lỗi trùng lặp.
2. Đăng nhập bằng tài khoản `Leader/Part Leader` (`leader@test.com`).
   * Kiểm tra tương tự và xác nhận có quyền sửa mã dự án.
3. Đăng nhập bằng tài khoản `Kinh doanh (Sales)` (`sales@test.com`).
   * Kiểm tra tương tự và xác nhận có quyền sửa mã dự án.
4. Đăng nhập bằng tài khoản `Nhân viên (Staff)` (`staff@test.com`).
   * Nếu nhân viên đó là thành viên dự án và được gán vai trò `PM` (trong phần Thành viên dự án).
     * Mở modal chỉnh sửa dự án, xác nhận có quyền sửa mã dự án.
   * Nếu nhân viên đó có vai trò `Member` bình thường:
     * Xác nhận nút "Chỉnh sửa dự án" bị ẩn hoặc không thể sửa mã dự án.
