# Cho Phép Sửa Mã Dự Án (Project Key) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép các vai trò Admin, Team Leader, PM, và Kinh doanh chỉnh sửa Mã dự án (Project Key) từ giao diện Chỉnh Sửa Dự Án và lưu thành công vào Database.

**Architecture:** Mở khóa thuộc tính disabled của input Mã dự án ở Frontend dựa trên vai trò hệ thống (Admin, Leader, Kinh doanh) hoặc vai trò dự án (PM). Backend sẽ kiểm tra tính duy nhất (tránh trùng lặp) của Mã dự án mới và cập nhật vào Database qua Prisma raw SQL.

**Tech Stack:** React 19, Next.js 16 (App Router), Express.js, Prisma, MySQL.

## Global Constraints

* Mã dự án là duy nhất (UNIQUE) và có tối đa 10 ký tự.
* Mã dự án phải luôn được chuẩn hóa viết hoa (UPPERCASE) và loại bỏ khoảng trắng thừa.
* Nếu Mã dự án mới trùng với dự án khác, backend trả về lỗi 400 và không cập nhật.

---

### Task 1: Backend Controller Update

**Files:**
- Modify: `backend/controllers/projectController.js:98-110`

**Interfaces:**
- Consumes: `req.body.proj` chứa `id` và `project_key`.
- Produces: JSON response `200 OK` khi cập nhật thành công hoặc `400 Bad Request` khi mã dự án bị trùng lặp.

- [ ] **Step 1: Thay đổi code ở backend/controllers/projectController.js**

  Cập nhật logic `saveProject` trong nhánh `else` (update) để lấy `project_key` gửi lên, kiểm tra tính duy nhất và cập nhật vào SQL:

  ```javascript
    } else {
      let projectKey = proj.project_key ? proj.project_key.trim().toUpperCase() : null;
      if (!projectKey) {
        return res.status(400).json({ error: 'Mã dự án không được để trống.' });
      }

      // Check unique
      const existing = await prisma.project.findFirst({
        where: { 
          project_key: projectKey,
          NOT: { project_id: id }
        }
      });
      if (existing) {
        return res.status(400).json({ error: `Mã dự án '${projectKey}' đã tồn tại ở dự án khác!` });
      }

      await prisma.$executeRaw`
        UPDATE Project 
        SET project_name = ${finalProjectName}, 
            project_description = ${proj.description}, 
            project_key = ${projectKey},
            customer_id = ${proj.customer_id || null},
            status = ${proj.status || 'Thực thi'}, 
            start_date = ${proj.start_date || '2026-06-01'}, 
            end_date = ${proj.end_date || '2026-12-31'},
            visibility = ${visibility}
        WHERE project_id = ${id}
      `;
    }
  ```

- [ ] **Step 2: Chạy thử backend để đảm bảo không lỗi cú pháp**

  Chạy command sau để kiểm tra:
  Run: `node -c backend/controllers/projectController.js`
  Expected: Không báo lỗi cú pháp.

- [ ] **Step 3: Commit các thay đổi backend**

  Run:
  ```bash
  git add backend/controllers/projectController.js
  git commit -m "backend: update project_key during project updates with uniqueness checks"
  ```

---

### Task 2: Frontend Modals Update

**Files:**
- Modify: `src/components/Modals.js:196-220`

**Interfaces:**
- Consumes: `currentUser` prop và `selectedMembers` state trong `ProjectModal`.
- Produces: Giao diện input Mã dự án cho phép các vai trò được phân quyền nhập và chỉnh sửa.

- [ ] **Step 1: Thêm logic canEditProjectKey và thay đổi disabled cho input**

  Khai báo `canEditProjectKey` trước phần `return` trong component `ProjectModal`:

  ```javascript
    const canEditProjectKey = !projectId || 
      currentUser?.system_role?.includes("Admin") || 
      currentUser?.system_role?.includes("Leader") || 
      currentUser?.system_role?.includes("Kinh doanh") || 
      currentUser?.system_role?.includes("Sales") || 
      selectedMembers[currentUser?.id] === 'PM';
  ```

  Cập nhật thuộc tính `disabled` cho ô input Mã dự án ở hàng 217:

  ```javascript
              <div className="form-group">
                <label>Mã dự án <span className="required">*</span></label>
                <input 
                  type="text" 
                  value={projectKey} 
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())} 
                  required 
                  disabled={!canEditProjectKey}
                  placeholder="Ví dụ: PS000000,PP00000..." 
                />
              </div>
  ```

- [ ] **Step 2: Commit các thay đổi frontend**

  Run:
  ```bash
  git add src/components/Modals.js
  git commit -m "frontend: allow Admin, TeamLeader, PM, and Sales to edit project key"
  ```
