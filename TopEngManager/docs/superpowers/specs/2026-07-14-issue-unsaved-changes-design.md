# Tài liệu thiết kế: Hiển thị cảnh báo thay đổi chưa lưu khi đóng Chi tiết Issue

Dự án sẽ bổ sung tính năng cảnh báo người dùng khi họ có các thay đổi chưa được lưu trong giao diện Chi tiết Issue (JIRA-style modal) và nhấn nút **X** (Đóng).

## 1. Yêu cầu chi tiết
- **Mục tiêu**: Ngăn chặn người dùng vô tình làm mất các dữ liệu vừa nhập (như hiện trạng, nguyên nhân, danh sách công việc con, mô tả,...) khi tắt giao diện chi tiết mà chưa lưu.
- **Hành vi**:
  - Khi người dùng bấm nút **X** để tắt:
    - Nếu issue đang bị khóa (Chỉ đọc - Read-only) hoặc không có bất kỳ thay đổi nào so với dữ liệu ban đầu, đóng modal bình thường.
    - Nếu phát hiện có bất kỳ thay đổi nào ở các trường soạn thảo nội bộ, hiện popup cảnh báo SweetAlert2.
    - Popup không có tiêu đề, hiển thị nội dung: `"Bạn có muốn lưu các thay đổi này trước khi đóng không?"`.
    - Có 3 tùy chọn:
      - **Lưu**: Gọi hàm lưu, nếu thành công thì đóng modal chi tiết Issue.
      - **Không lưu**: Đóng modal chi tiết Issue ngay lập tức mà không lưu.
      - **Hủy**: Đóng popup cảnh báo và tiếp tục giữ giao diện Chi tiết Issue hoạt động.

## 2. Giải pháp kỹ thuật

### Đăng ký State / Ref theo dõi dữ liệu gốc
Sử dụng một `React.useRef` trong file `src/app/projects/[id]/page.js`:
```javascript
const originalIssueDataRef = useRef(null);
```

### Lưu trữ dữ liệu gốc khi load chi tiết
Trong hàm `loadIssueDetail(issueId)`:
Sau khi lấy dữ liệu thành công từ `db.getIssueDetail(issueId)` và gọi các hàm `set...` để cập nhật trạng thái giao diện, lưu bản sao của các trường dữ liệu vào ref:
```javascript
originalIssueDataRef.current = {
  editIssueDesc: parsed.text || '',
  jiraDetailDeadline: formatDateForInput(parsed.deadline) || '',
  jiraDetailHienTrang: parsed.hientrang || '',
  jiraDetailNguyenNhan: parsed.nguyennhan || '',
  jiraDetailHuongGiaiQuyet: parsed.huonggiaiquyet || '',
  jiraDetailKetQua: parsed.ketqua || '',
  detailAssigneesText: parsed.assigneesText || (res.issue.assignee_id ? `@${users.find(u => u.id === res.issue.assignee_id)?.name || ''} ` : ''),
  issueAssigneeIds: parsed.relatedUserIds || (res.issue.assignee_id ? [res.issue.assignee_id] : []),
  projectTasks: parsed.issueTasks || []
};
```

### Hàm kiểm tra thay đổi `hasUnsavedChanges`
So sánh các giá trị hiện tại của component state với dữ liệu được lưu trong ref:
```javascript
const hasUnsavedChanges = () => {
  if (!originalIssueDataRef.current) return false;
  const orig = originalIssueDataRef.current;
  
  if (editIssueDesc !== orig.editIssueDesc) return true;
  if (jiraDetailDeadline !== orig.jiraDetailDeadline) return true;
  if (jiraDetailHienTrang !== orig.jiraDetailHienTrang) return true;
  if (jiraDetailNguyenNhan !== orig.jiraDetailNguyenNhan) return true;
  if (jiraDetailHuongGiaiQuyet !== orig.jiraDetailHuongGiaiQuyet) return true;
  if (jiraDetailKetQua !== orig.jiraDetailKetQua) return true;
  if (detailAssigneesText !== orig.detailAssigneesText) return true;
  if (JSON.stringify(issueAssigneeIds) !== JSON.stringify(orig.issueAssigneeIds)) return true;
  if (JSON.stringify(projectTasks) !== JSON.stringify(orig.projectTasks)) return true;
  
  return false;
};
```

### Sửa đổi luồng đóng modal `handleCloseIssueDetail`
```javascript
const forceCloseIssueDetail = async () => {
  if (lockIntervalRef.current) {
    clearInterval(lockIntervalRef.current);
    lockIntervalRef.current = null;
  }
  if (activeIssueDetail) {
    try {
      await db.unlockIssue(activeIssueDetail.id, currentUser.id);
    } catch (e) {
      console.error("Failed to unlock issue:", e);
    }
  }
  setIsDetailModalOpen(false);
};

const handleCloseIssueDetail = async () => {
  if (!isLockedByOther && hasUnsavedChanges()) {
    const result = await Swal.fire({
      text: 'Bạn có muốn lưu các thay đổi này trước khi đóng không?',
      icon: 'warning',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: 'Lưu',
      denyButtonText: 'Không lưu',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#3085d6',
      denyButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    });

    if (result.isConfirmed) {
      const saved = await handleSaveAllIssueTasks(true);
      if (!saved) return; // Không đóng nếu lưu lỗi hoặc không hợp lệ
    } else if (result.isDenied) {
      await forceCloseIssueDetail();
    }
  } else {
    await forceCloseIssueDetail();
  }
};
```

### Cập nhật hàm `handleSaveAllIssueTasks`
Cập nhật để trả về giá trị boolean biểu thị trạng thái lưu thành công và hỗ trợ tham số đóng modal `shouldClose`:
- Khi lưu thành công, trả về `true`. Nếu truyền `shouldClose = true`, gọi tiếp `forceCloseIssueDetail()`.
- Khi lưu thất bại hoặc thông tin chưa hợp lệ, hiển thị cảnh báo và trả về `false`.
