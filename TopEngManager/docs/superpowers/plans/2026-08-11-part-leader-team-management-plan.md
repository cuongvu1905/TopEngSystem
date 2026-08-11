# Part Leader Team Management Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grant the Part Leader role access to "Quản lý Team" (HR module) with scoped access to only their Part's members in "Nhân sự & Tài khoản" and their Part's root path in "Quản lý phòng ban".

**Architecture:** Update `roles_permissions.json` to grant `view_hr` permission to `Part Leader`. Update Sidebar component copy for Part Leaders. Add Part Leader role scoping in `src/app/hr/page.js` for user list filtering and organizational department tree filtering.

**Tech Stack:** Next.js (React), Express backend config (`roles_permissions.json`).

## Global Constraints
- Only allow Part Leader access to their own Part members in Tab 1 ("Nhân sự & Tài khoản").
- Only allow Part Leader visibility of ancestor departments up to root plus their own Part in Tab 2 ("Quản lý phòng ban").
- Do NOT push code to GitHub unless requested.

---

### Task 1: Grant `view_hr` permission to Part Leader and update Sidebar label

**Files:**
- Modify: `backend/config/roles_permissions.json:258-275`
- Modify: `src/components/Sidebar.js:86-90`

**Interfaces:**
- Consumes: `hasPermission('view_hr')`, `currentUser.system_role`
- Produces: Sidebar "Quản lý Team" tab for `Part Leader` users

- [ ] **Step 1: Update `backend/config/roles_permissions.json`**

Add `"view_hr"` to the `"Part Leader"` array in `backend/config/roles_permissions.json`.

```json
    "Part Leader": [
      "view_dashboard",
      "view_all_projects",
      "create_project",
      "create_task",
      "edit_task",
      "delete_task",
      "update_task_status",
      "create_issue",
      "edit_issue",
      "view_documents",
      "upload_documents",
      "upload_project_documents",
      "create_daily_report",
      "chat_tag_all_project",
      "view_daily_reports",
      "approve_daily_report",
      "view_hr"
    ],
```

- [ ] **Step 2: Update Sidebar label in `src/components/Sidebar.js`**

Modify line 89 in `src/components/Sidebar.js` to show `"Quản lý Team"` for both `Team Leader` and `Part Leader`:

```javascript
        {hasPermission('view_hr') && (
          <Link href="/hr" onClick={handleNavigate} className={`menu-item ${pathname === '/hr' ? 'active' : ''}`}>
            <i className="fa-solid fa-user-gear"></i>
            <span>{t('sidebar.teamManagement', (currentUser.system_role === 'Team Leader' || currentUser.system_role === 'Part Leader') ? 'Quản lý Team' : 'Quản lý nhân sự')}</span>
          </Link>
        )}
```

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: Build passes with no syntax or type errors.

- [ ] **Step 4: Commit Task 1**

```bash
git add backend/config/roles_permissions.json src/components/Sidebar.js
git commit -m "feat(hr): grant view_hr permission to Part Leader and update Sidebar menu label"
```

---

### Task 2: Implement Part Leader scoping in `src/app/hr/page.js` (User List & Dept Tree)

**Files:**
- Modify: `src/app/hr/page.js:59-65`, `488-504`, `1138-1150`

**Interfaces:**
- Consumes: `currentUser.system_role`, `currentUser.department_id`, `currentUser.additional_part_leader_of`
- Produces: Filtered user list & department tree for `Part Leader` users

- [ ] **Step 1: Add Part Leader status indicators in `src/app/hr/page.js`**

At lines 59-62 of `src/app/hr/page.js`:

```javascript
  const isTeamLeader = currentUser?.system_role === 'Team Leader';
  const isPartLeader = currentUser?.system_role === 'Part Leader';
  const isAdmin = currentUser?.system_role?.includes("Admin");
  const isHR = currentUser?.system_role?.includes("Nhân sự");
  const isPartLeaderOnly = isPartLeader && !isAdmin && !isHR && !isTeamLeader;
```

- [ ] **Step 2: Update `getFilteredUsersList()` in `src/app/hr/page.js`**

In `getFilteredUsersList()`:

```javascript
  const getFilteredUsersList = () => {
    let list = users.filter(u => isAdmin || !u.system_role?.includes('Admin'));

    if (isPartLeaderOnly) {
      const myPartIds = [currentUser?.department_id, ...(currentUser?.additional_part_leader_of || [])].filter(Boolean);
      list = list.filter(u => myPartIds.includes(u.department_id));
    }

    if (userSearchQuery.trim()) {
      const query = userSearchQuery.toLowerCase().trim();
      list = list.filter(u => 
        u.name.toLowerCase().includes(query) || 
        (u.id && u.id.toLowerCase().includes(query))
      );
    }

    if (selectedDeptFilter !== 'all') {
      list = list.filter(u => u.department_id === selectedDeptFilter);
    }

    return list;
  };
```

- [ ] **Step 3: Update `visibleRootDepts` and `renderDeptNode()` tree filtering in `src/app/hr/page.js`**

Helper to check if department `d` is visible to Part Leader:

```javascript
  const isDeptVisibleToPartLeader = (deptId) => {
    if (!isPartLeaderOnly) return true;
    const myPartIds = [currentUser?.department_id, ...(currentUser?.additional_part_leader_of || [])].filter(Boolean);
    if (myPartIds.includes(deptId)) return true;
    
    // Check if deptId is an ancestor of any of myPartIds
    const isAncestor = myPartIds.some(partId => isDescendant(partId, deptId, departments));
    if (isAncestor) return true;

    // Check if deptId is a descendant of any of myPartIds
    const isDescendantOfMyPart = myPartIds.some(partId => isDescendant(deptId, partId, departments));
    if (isDescendantOfMyPart) return true;

    return false;
  };
```

In `renderDeptNode`:
Filter children nodes using `isDeptVisibleToPartLeader(child.department_id)`:

```javascript
  const getDeptChildren = (deptId) => {
    return departments.filter(d => d.parent_id === deptId && isDeptVisibleToPartLeader(d.department_id));
  };
```

And in `visibleRootDepts`:

```javascript
  const visibleRootDepts = (!isAdmin && !isHR && !isTeamLeader && isCurrentUserInRootDept)
    ? departments.filter(d => d.department_id === currentUser.department_id && isDeptVisibleToPartLeader(d.department_id))
    : departments.filter(d => (!d.parent_id || !departments.some(p => p.department_id === d.parent_id)) && isDeptVisibleToPartLeader(d.department_id));
```

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/app/hr/page.js
git commit -m "feat(hr): filter members and department tree for Part Leader in Team Management"
```
