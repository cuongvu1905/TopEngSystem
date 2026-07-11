# Spec: Removing MockDB and Cleaning Database UI

This specification details the plan to completely remove the Mock Database (localStorage-based mock database) and all related configuration/reset UI elements, making the real MySQL database the sole data source for the application.

## 1. Objectives
* Standardize the application architecture to run only on the real MySQL database via backend APIs.
* Remove the "Phương thức lưu trữ" (Storage method) dropdown from the Login page.
* Remove the "Cấu hình Database" (Database config) modal and its header option.
* Remove the "Reset dữ liệu" (Reset data) button from the left sidebar footer.
* Delete the unused `mockDB.js` source file.

## 2. Affected Components & Proposed Changes

---

### `src/utils/db.js`
* **Changes:** Remove `MockDB` imports and conditional logic checking `ems_db_type` from `localStorage`. Directly export `MySQLAdapter` as `db`.
* **Export Signature:** Keep the export names (`db`, `MySQLAdapter`) unchanged to avoid breaking existing imports in pages/components, but remove `MockDB` exports.

---

### `src/utils/mockDB.js` [DELETE]
* **Changes:** Completely delete the file as it is no longer needed.

---

### `src/components/Login.js`
* **Changes:** 
  * Remove `dbType` React state and its `useEffect` hook.
  * Remove the "Phương thức lưu trữ" form-group from the rendered JSX.
  * Remove the warning info box that displayed when `dbType === 'mock'`.

---

### `src/components/Header.js`
* **Changes:**
  * Remove `DatabaseModal` import.
  * Remove `isDatabaseModalOpen` state.
  * Remove "Cấu hình Database" button from the settings dropdown menu.
  * Remove the `<DatabaseModal>` wrapper rendering.

---

### `src/components/Sidebar.js`
* **Changes:**
  * Remove the `db` and `MockDB` imports.
  * Remove the `handleResetData` function.
  * Remove the reset button (arrows rotating icon) from the sidebar footer.

---

### `src/components/Modals.js`
* **Changes:**
  * Remove `DatabaseModal` export completely.
  * Remove any unused imports of `MockDB` or `dbType` from database modal helpers.

---

## 3. Verification Plan

### Manual Verification
1. **Login Page:** 
   * Navigate to the login page and verify that the database selection dropdown is no longer visible.
   * Verify that logging in with standard MySQL user accounts works correctly.
2. **Header Menu:**
   * Open the user dropdown menu in the top-right corner.
   * Verify that the "Cấu hình Database" option is removed.
3. **Sidebar:**
   * Look at the bottom of the left sidebar.
   * Verify that the Reset button (rotating arrows icon) is removed.
4. **App Functionality:**
   * Verify that navigating through Projects, Kanban board, Issues, Tasks, Chat, and Daily Reports operates seamlessly using the real MySQL database.
