# Remove MockDB and Clean Database UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remove the Mock Database (localStorage-based mock database) and all related configuration/reset UI elements, setting the real MySQL database as the sole data source for the application.

**Architecture:** Refactor the unified database dispatcher to directly export the MySQL client adapter, remove the database selector from the login screen, delete the database config modal and its entry point in the header, and remove the data reset functionality in the sidebar.

**Tech Stack:** React, Next.js, JavaScript, TailwindCSS/Vanilla CSS

## Global Constraints
* Maintain strict architectural isolation: use MySQL database backend API via Route Handlers.
* Keep the code clean: remove all unused MockDB references and avoid dead code.
* Ensure all files modify safely and compile successfully.

---

### Task 1: Refactor Database Dispatcher and Delete MockDB File

**Files:**
- Modify: `src/utils/db.js`
- Delete: `src/utils/mockDB.js`

**Interfaces:**
- Consumes: None
- Produces: `db` object pointing directly to `MySQLAdapter`

- [ ] **Step 1: Refactor `src/utils/db.js` to only use `MySQLAdapter`**
  
  Update `src/utils/db.js` content to:
  ```javascript
  import { MySQLAdapter } from './mysqlClient';

  const db = MySQLAdapter; // Run only in MySQL Backend Mode

  console.log("EMS Database: Running in MySQL Backend Mode");

  export { db };
  export default db;
  export { MySQLAdapter };
  ```

- [ ] **Step 2: Delete `src/utils/mockDB.js`**
  
  Run terminal command to delete the file:
  `rm src/utils/mockDB.js` or `git rm src/utils/mockDB.js` (on Windows PowerShell: `Remove-Item src/utils/mockDB.js` or `git rm src/utils/mockDB.js`)

- [ ] **Step 3: Commit the task**
  
  ```bash
  git add src/utils/db.js
  git rm src/utils/mockDB.js
  git commit -m "chore: remove mockDB.js and update db.js to use MySQLAdapter directly"
  ```

---

### Task 2: Clean up Unused MockDB Imports in Pages & Components

**Files:**
- Modify: `src/app/chat/page.js:6`
- Modify: `src/app/projects/[id]/page.js:5`
- Modify: `src/components/Header.js:5`

**Interfaces:**
- Consumes: `db` from `@/utils/db`
- Produces: None

- [ ] **Step 1: Remove `MockDB` from `src/app/chat/page.js` imports**
  
  Target Line:
  ```javascript
  import { db, MockDB } from '@/utils/db';
  ```
  Change to:
  ```javascript
  import { db } from '@/utils/db';
  ```

- [ ] **Step 2: Remove `MockDB` from `src/app/projects/[id]/page.js` imports**
  
  Target Line:
  ```javascript
  import { db, MockDB } from '@/utils/db';
  ```
  Change to:
  ```javascript
  import { db } from '@/utils/db';
  ```

- [ ] **Step 3: Remove `MockDB` from `src/components/Header.js` imports**
  
  Target Line:
  ```javascript
  import { db, MockDB } from '@/utils/db';
  ```
  Change to:
  ```javascript
  import { db } from '@/utils/db';
  ```

- [ ] **Step 4: Commit the task**
  
  ```bash
  git add src/app/chat/page.js src/app/projects/\[id\]/page.js src/components/Header.js
  git commit -m "chore: remove unused MockDB imports from pages and Header"
  ```

---

### Task 3: Remove Database Selector UI from Login Screen

**Files:**
- Modify: `src/components/Login.js`

**Interfaces:**
- Consumes: None
- Produces: None

- [ ] **Step 1: Remove database selection states and methods**
  
  Remove `dbType` state initialization and its `useEffect` / `handleDbTypeChange` hooks (lines 10, 14-25).
  Remove `dbType === 'mock'` conditional block (lines 85-89).
  
- [ ] **Step 2: Remove "Phương thức lưu trữ" selector markup**
  
  Remove the following block from `src/components/Login.js`:
  ```javascript
            <div className="form-group">
              <label>Phương thức lưu trữ</label>
              <div className="input-with-icon">
                <i className="fa-solid fa-database"></i>
                <select 
                  value={dbType} 
                  onChange={(e) => handleDbTypeChange(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: '8px 12px 8px 32px', 
                    borderRadius: '6px', 
                    border: '1px solid var(--neutral-border)', 
                    outline: 'none', 
                    fontSize: '13.5px',
                    backgroundColor: 'var(--neutral-light)',
                    color: 'var(--neutral-dark)',
                    cursor: 'pointer'
                  }}
                >
                  <option value="mysql">MySQL Database (Cần khởi chạy backend & database)</option>
                  <option value="mock">Mock Database Cục bộ (Chạy trực tiếp trên trình duyệt)</option>
                </select>
              </div>
            </div>
  ```

- [ ] **Step 3: Commit the task**
  
  ```bash
  git add src/components/Login.js
  git commit -m "feat: remove database method selector from login screen"
  ```

---

### Task 4: Remove Database configuration trigger and Modal

**Files:**
- Modify: `src/components/Header.js`
- Modify: `src/components/Modals.js`

**Interfaces:**
- Consumes: None
- Produces: None

- [ ] **Step 1: Remove Database Modal Trigger from Header**
  
  Remove `DatabaseModal` import from `src/components/Header.js`.
  Remove `isDatabaseModalOpen` state from `src/components/Header.js`.
  Remove the `<DatabaseModal>` JSX element rendering and the "Cấu hình Database" button block (lines 121-130) from the header dropdown menu.

- [ ] **Step 2: Remove DatabaseModal Component from Modals.js**
  
  Delete `DatabaseModal` component export completely from `src/components/Modals.js` (lines 906-998). Also, remove `MySQLAdapter` and `MockDB` imports from `src/components/Modals.js`.

- [ ] **Step 3: Commit the task**
  
  ```bash
  git add src/components/Header.js src/components/Modals.js
  git commit -m "feat: remove DatabaseModal and its trigger from Header"
  ```

---

### Task 5: Remove Data Reset from Sidebar

**Files:**
- Modify: `src/components/Sidebar.js`

**Interfaces:**
- Consumes: None
- Produces: None

- [ ] **Step 1: Remove reset data states and methods**
  
  Remove `MockDB` import, `handleResetData` function, and the reset button markup from `src/components/Sidebar.js` (lines 20-40 and the button at lines 108-110).

- [ ] **Step 2: Commit the task**
  
  ```bash
  git add src/components/Sidebar.js
  git commit -m "feat: remove reset data button and related logic from Sidebar"
  ```
