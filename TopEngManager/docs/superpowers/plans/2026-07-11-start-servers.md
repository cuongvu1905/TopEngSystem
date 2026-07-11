# Start Servers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start both Frontend (Next.js) and Backend (Express.js) servers as background tasks and verify that they are running.

**Architecture:** Start the Express.js backend first from the `backend/` directory as a background task. Start the Next.js frontend second from the root directory as a background task. Check TCP connections on ports 5000 and 3000 to verify successful startup.

**Tech Stack:** Node.js, Express.js, Next.js, PowerShell.

## Global Constraints
- Do not run blocking commands synchronously (set appropriate WaitMsBeforeAsync or send to background).
- Both servers must run concurrently.

---

### Task 1: Start Backend Server

**Files:**
- Modify: None
- Test: Check port 5000 active connections

**Interfaces:**
- Consumes: None
- Produces: Backend API on `http://localhost:5000`

- [ ] **Step 1: Run the backend server start command**

Run: `npm run dev` in `c:\Users\mrcuo\Downloads\TopEngSystem-main\TopEngSystem-main\TopEngManager\backend` as a background task.
Command: `npm run dev`

- [ ] **Step 2: Verify backend server is listening on port 5000**

Run: `Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue`
Expected: Connection output showing state "Listen" on port 5000.

---

### Task 2: Start Frontend Server

**Files:**
- Modify: None
- Test: Check port 3000 active connections

**Interfaces:**
- Consumes: Backend API on `http://localhost:5000`
- Produces: Frontend web app on `http://localhost:3000`

- [ ] **Step 3: Run the frontend server start command**

Run: `npm run dev` in `c:\Users\mrcuo\Downloads\TopEngSystem-main\TopEngSystem-main\TopEngManager` as a background task.
Command: `npm run dev`

- [ ] **Step 4: Verify frontend server is listening on port 3000**

Run: `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue`
Expected: Connection output showing state "Listen" on port 3000.
