# Design Spec: Start Servers as Background Tasks

## Goal
Start both the Frontend (Next.js) and Backend (Express.js) servers as background tasks in the local workspace.

## Proposed Setup

1. **Backend Server**
   - **Command**: `npm run dev`
   - **Path**: `backend/`
   - **Expected Port**: 5000

2. **Frontend Server**
   - **Command**: `npm run dev`
   - **Path**: root directory (`./`)
   - **Expected Port**: 3000

## Verification
- Run TCP connections check on ports 3000 and 5000.
