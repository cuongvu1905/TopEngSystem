# Issue Unsaved Changes Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị popup hỏi ý kiến người dùng khi bấm đóng Chi tiết Issue và có thay đổi chưa lưu.

**Architecture:** Sử dụng `useRef` để theo dõi trạng thái dữ liệu gốc của Issue khi được tải vào. Khi người dùng đóng modal, so sánh trạng thái hiện tại với dữ liệu gốc để quyết định hiển thị cảnh báo.

**Tech Stack:** React (Next.js client component), SweetAlert2.

## Global Constraints
- Chỉ sửa đổi tệp `src/app/projects/[id]/page.js`.
- Tuyệt đối không được phá vỡ logic lưu hay thay đổi các trạng thái liên quan khác.

---

### Task 1: Khởi tạo Ref và lưu trữ trạng thái dữ liệu gốc của Issue

**Files:**
- Modify: `src/app/projects/[id]/page.js`

**Interfaces:**
- Consumes: `loadIssueDetail`
- Produces: `originalIssueDataRef`

- [ ] **Step 1: Định nghĩa `originalIssueDataRef` ở đầu component**

Thêm định nghĩa `originalIssueDataRef` sau các khai báo useRef khác (khoảng dòng 185-230):
```javascript
const originalIssueDataRef = useRef(null);
```

- [ ] **Step 2: Ghi lại dữ liệu gốc trong hàm `loadIssueDetail`**

Cập nhật hàm `loadIssueDetail` để ghi lại dữ liệu ban đầu vào `originalIssueDataRef.current` ngay sau khi load xong.
Tìm đoạn code trong `loadIssueDetail`:
```javascript
      if (parsed.issueTasks && Array.isArray(parsed.issueTasks)) {
        setProjectTasks(parsed.issueTasks);
      } else {
        setProjectTasks([
          ...
        ]);
      }
```
Và thêm ngay dưới đó:
```javascript
      const defaultTasks = parsed.issueTasks && Array.isArray(parsed.issueTasks) ? parsed.issueTasks : [
        {
          id: 'task-1',
          name: 'Công việc 1',
          deadline: '2026-07-20',
          assignee: '@Nguyễn Đình Thắng',
          creator: currentUser?.full_name || currentUser?.name || 'Admin',
          contentNeeded: '- Làm việc a\n- Làm việc b\n- Làm việc c',
          solutions: [
            { id: 'sol-1-1', action: 'Nội dung thực hiện mẫu 1', executor: currentUser?.full_name || currentUser?.name || 'Admin', date: new Date().toISOString().split('T')[0] },
            { id: 'sol-1-2', action: '', executor: '', date: '' }
          ]
        },
        {
          id: 'task-2',
          name: '',
          deadline: '',
          assignee: '',
          creator: currentUser?.full_name || currentUser?.name || 'Admin',
          contentNeeded: '',
          solutions: [
            { id: 'sol-2-1', action: '', executor: '', date: '' },
            { id: 'sol-2-2', action: '', executor: '', date: '' }
          ]
        }
      ];

      originalIssueDataRef.current = {
        editIssueDesc: parsed.text || '',
        jiraDetailDeadline: formatDateForInput(parsed.deadline) || '',
        jiraDetailHienTrang: parsed.hientrang || '',
        jiraDetailNguyenNhan: parsed.nguyennhan || '',
        jiraDetailHuongGiaiQuyet: parsed.huonggiaiquyet || '',
        jiraDetailKetQua: parsed.ketqua || '',
        detailAssigneesText: parsed.assigneesText || (res.issue.assignee_id ? `@${users.find(u => u.id === res.issue.assignee_id)?.name || ''} ` : ''),
        issueAssigneeIds: parsed.relatedUserIds || (res.issue.assignee_id ? [res.issue.assignee_id] : []),
        projectTasks: parsed.issueTasks && Array.isArray(parsed.issueTasks) ? parsed.issueTasks : defaultTasks
      };
```

---

### Task 2: Triển khai kiểm tra thay đổi và tích hợp cảnh báo khi đóng modal

**Files:**
- Modify: `src/app/projects/[id]/page.js`

**Interfaces:**
- Consumes: `originalIssueDataRef`, `handleSaveAllIssueTasks`, `handleCloseIssueDetail`
- Produces: `hasUnsavedChanges`, `forceCloseIssueDetail`, `handleCloseIssueDetail`

- [ ] **Step 1: Định nghĩa hàm so sánh `hasUnsavedChanges`**

Thêm hàm `hasUnsavedChanges` phía trên hàm `handleCloseIssueDetail`:
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

- [ ] **Step 2: Định nghĩa `forceCloseIssueDetail` và viết lại `handleCloseIssueDetail`**

Chuyển logic đóng nguyên bản của `handleCloseIssueDetail` thành `forceCloseIssueDetail`, sau đó viết lại `handleCloseIssueDetail` tích hợp cảnh báo:
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
        if (!saved) return;
      } else if (result.isDenied) {
        await forceCloseIssueDetail();
      }
    } else {
      await forceCloseIssueDetail();
    }
  };
```

- [ ] **Step 3: Cập nhật `handleSaveAllIssueTasks` để hỗ trợ đóng modal và trả về trạng thái lưu**

Thay đổi chữ ký hàm `handleSaveAllIssueTasks` để chấp nhận tham số `shouldClose = false` và trả về `true` (khi thành công) hoặc `false` (khi thất bại/không hợp lệ):
```javascript
  const handleSaveAllIssueTasks = async (shouldClose = false) => {
    if (!activeIssueDetail) return false;

    // Validate subtasks
    const subTaskCheck = validateSubTasks(projectTasks);
    if (!subTaskCheck.valid) {
      Swal.fire({ icon: 'warning', title: 'Thông tin chưa đầy đủ', text: subTaskCheck.message });
      return false;
    }

    if (activeIssueDetail.status === 'DONE') {
      if (!jiraDetailHienTrang.trim() || !jiraDetailNguyenNhan.trim() || !jiraDetailHuongGiaiQuyet.trim() || !jiraDetailKetQua.trim()) {
        Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: "Lỗi: Trạng thái Issue hiện tại là DONE. Chỉ khi cả 4 mục (Hiện trạng, Nguyên nhân, Hướng giải quyết, Kết quả) đều có thông tin mới có thể lưu!" });
        return false;
      }
    }
    try {
      const newDescription = JSON.stringify({
        text: editIssueDesc,
        hientrang: jiraDetailHienTrang,
        nguyennhan: jiraDetailNguyenNhan,
        huonggiaiquyet: jiraDetailHuongGiaiQuyet,
        ketqua: jiraDetailKetQua,
        deadline: jiraDetailDeadline,
        issueTasks: projectTasks,
        assigneesText: detailAssigneesText,
        relatedUserIds: issueAssigneeIds
      });
      const updatedIssue = { 
        ...activeIssueDetail, 
        description: newDescription
      };
      await db.updateIssue(updatedIssue, currentUser.id);
      
      // Send notifications for mentions in grid
      await notifyMentionedUsersInGrid(projectTasks, activeIssueDetail.issue_key, activeIssueDetail.summary, activeIssueDetail.id);

      await loadIssueDetail(activeIssueDetail.id);
      loadIssues();
      Swal.fire({ icon: 'success', title: 'Thành công', text: "Đã lưu thay đổi thành công!" });
      
      if (shouldClose) {
        await forceCloseIssueDetail();
      }
      return true;
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Thất bại', text: "Lỗi lưu thay đổi: " + err.message });
      return false;
    }
  };
```

---

## Verification Plan

### Manual Verification
1. Mở một dự án, truy cập tab Issues.
2. Bấm vào một Issue để mở modal Chi tiết Issue (chọn Issue mà bạn có quyền chỉnh sửa - không bị khoá).
3. Đóng modal bằng nút **X** ngay khi vừa mở (chưa chỉnh sửa gì). Xác nhận modal đóng ngay lập tức mà không có cảnh báo.
4. Mở lại Issue, thực hiện chỉnh sửa một trường (ví dụ: thay đổi văn bản trong "Hiện trạng").
5. Bấm nút **X** để đóng:
   - Xác nhận xuất hiện popup SweetAlert2 hỏi `"Bạn có muốn lưu các thay đổi này trước khi đóng không?"`.
   - Bấm **Hủy**: popup đóng, modal Chi tiết Issue vẫn mở và giữ nguyên thay đổi.
   - Bấm **Không lưu**: modal Chi tiết Issue đóng, thay đổi không được ghi nhận vào database.
   - Bấm **Lưu**: hệ thống thực hiện lưu thay đổi thành công, hiển thị thông báo "Đã lưu thay đổi thành công!" và đóng modal chi tiết Issue.
