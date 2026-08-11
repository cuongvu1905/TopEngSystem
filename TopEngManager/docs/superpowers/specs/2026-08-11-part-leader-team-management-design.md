# Design Document: Part Leader Permissions in Team Management

## Overview
This design document defines the permissions and data filtering rules for the **Part Leader** role within the **Team Management** (Quản lý Team / HR) module of TopEngSystem.

---

## 1. Sidebar Menu & Access Control
- **Permission key**: Add `view_hr` to the `Part Leader` role in `backend/config/roles_permissions.json`.
- **Sidebar Label**: Display menu title as `"Quản lý Team"` when the logged-in user is a `Team Leader` or `Part Leader` (and `"Quản lý nhân sự"` for Admin / HR).
- **Tab Access**:
  - `Part Leader` sees **Tab 1: "Nhân sự & Tài khoản"** and **Tab 2: "Quản lý phòng ban"**.
  - `Part Leader` does NOT see **Tab 3: "Phân quyền vai trò"** (restricted to Admin/HR).

---

## 2. Tab 1: "Nhân sự & Tài khoản" (User List Filtering)
- **Scoping Rule**:
  - Identify all Part department IDs managed by the Part Leader (`currentUser.department_id` and any department IDs in `currentUser.additional_part_leader_of`).
  - Filter `users` list so that a `Part Leader` (who is not Admin, HR, or Team Leader) can **only view employees whose `department_id` belongs to their Part**.
  - Members of other Parts, other Teams, or unassigned departments are hidden.

---

## 3. Tab 2: "Quản lý phòng ban" (Department Treeview Filtering)
- **Scoping Rule**:
  - When rendering the organizational tree for a `Part Leader`, include only:
    1. **Ancestor departments** (Root department up to Parent Team, e.g., `BOD TOPV` -> `PC Team`).
    2. **Part Leader's own Part department(s)** (e.g., `PC Team 1`).
    3. **Descendant departments** of the Part Leader's Part (if any child departments exist under their Part).
  - Sibling Parts under the same parent Team (e.g., `PC Team 2`, `PC Team 3`) and other unrelated Teams/departments are hidden.

---

## 4. Modified Components & Files
1. `backend/config/roles_permissions.json`: Grant `view_hr` to `Part Leader`.
2. `src/components/Sidebar.js`: Ensure Sidebar label is `"Quản lý Team"` for `Part Leader`.
3. `src/app/hr/page.js`:
   - Update `getFilteredUsersList()` to restrict users for `Part Leader`.
   - Update `visibleRootDepts` & `renderDeptNode()` to restrict the department tree structure for `Part Leader`.
   - Ensure proper tab auto-switching & tab header filtering for `Part Leader`.
