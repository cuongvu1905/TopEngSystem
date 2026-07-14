# AI-Assisted Hybrid Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a database CLI query helper script, setup a GitHub Actions CI workflow, and organize the ERD documentation to support AI-driven project management and database operations.

**Architecture:** Build a CLI database querying helper script using Node.js & `mysql2/promise` that reads variables from backend/.env, establish a GitHub CI workflow using Actions for Next.js checks (lint, build) and backend checks, and organize the ERD files under `docs/database/ERD.md`.

**Tech Stack:** Node.js, mysql2, GitHub Actions, Mermaid.js.

## Global Constraints
- Do NOT automatically run git commit or git push. Always ask for explicit permission before committing or pushing changes to GitHub.
- Keep paths absolute and correct.

---

### Task 1: CLI Database Helper Script (`backend/scripts/db-query.js`)

**Files:**
- Create: `backend/scripts/db-query.js`
- Test: Run test queries locally.

- [ ] **Step 1: Create backend/scripts directory**
  Run: `powershell -Command "New-Item -ItemType Directory -Force -Path backend/scripts"`
  Expected: Directory is created or already exists.

- [ ] **Step 2: Create the file `backend/scripts/db-query.js`**
  Write the database query script that reads the backend environment file and connects to MySQL:
  ```javascript
  const mysql = require('mysql2/promise');
  const path = require('path');
  require('dotenv').config({ path: path.join(__dirname, '../.env') });

  async function main() {
    const query = process.argv[2];
    if (!query) {
      console.error(JSON.stringify({ success: false, error: "Missing SQL query argument" }, null, 2));
      process.exit(1);
    }

    let connection;
    try {
      connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'topsystemdb',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306
      });

      const [rows] = await connection.query(query);
      console.log(JSON.stringify({ success: true, results: rows }, null, 2));
    } catch (error) {
      console.error(JSON.stringify({ success: false, error: error.message }, null, 2));
      process.exit(1);
    } finally {
      if (connection) await connection.end();
    }
  }

  main();
  ```

- [ ] **Step 3: Test connection and successful query execution**
  Run: `node backend/scripts/db-query.js "SELECT 1 + 1 AS test"`
  Expected: Output matching:
  ```json
  {
    "success": true,
    "results": [
      {
        "test": 2
      }
    ]
  }
  ```

- [ ] **Step 4: Verify error handling on invalid query**
  Run: `node backend/scripts/db-query.js "SELECT * FROM NonExistentTable"`
  Expected: Output containing `success: false` and error message about the non-existent table.

---

### Task 2: GitHub Actions CI Workflow (`.github/workflows/ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows directory**
  Run: `powershell -Command "New-Item -ItemType Directory -Force -Path .github/workflows"`
  Expected: Directory is created.

- [ ] **Step 2: Create the file `.github/workflows/ci.yml`**
  Write the configuration file:
  ```yaml
  name: TopEng Manager CI

  on:
    push:
      branches: [ main, master ]
    pull_request:
      branches: [ main, master ]

  jobs:
    frontend-ci:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout repository
          uses: actions/checkout@v4

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: 18
            cache: 'npm'

        - name: Install Frontend Dependencies
          run: npm ci

        - name: Run ESLint
          run: npm run lint

        - name: Build Frontend
          run: npm run build

    backend-ci:
      runs-on: ubuntu-latest
      steps:
        - name: Checkout repository
          uses: actions/checkout@v4

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: 18
            cache: 'npm'
            cache-dependency-path: backend/package-lock.json

        - name: Install Backend Dependencies
          run: |
            cd backend
            npm ci

        - name: Check Backend Entry Point
          run: |
            cd backend
            node --check server.js
  ```

---

### Task 3: Relocate & Update ERD Documentation (`docs/database/ERD.md`)

**Files:**
- Create: `docs/database/ERD.md`
- Delete: `database_erd.md`

- [ ] **Step 1: Create docs/database directory**
  Run: `powershell -Command "New-Item -ItemType Directory -Force -Path docs/database"`
  Expected: Directory is created.

- [ ] **Step 2: Copy the content of database_erd.md to docs/database/ERD.md**
  Read from `database_erd.md` and write the same content to `docs/database/ERD.md`.

- [ ] **Step 3: Remove the old file `database_erd.md`**
  Run: `powershell -Command "Remove-Item database_erd.md -ErrorAction SilentlyContinue"`
  Expected: `database_erd.md` in the root is deleted.
