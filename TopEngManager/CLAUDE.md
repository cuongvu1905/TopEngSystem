# TopEng Manager - Project Instructions & Guidelines

## Common Commands
### Setup & Installation
- Install dependencies for both Frontend & Backend: `setup.bat` (Windows) or `npm install && cd backend && npm install`
- Setup environment variables: Verify `.env.local` in root directory and `backend/.env` in `backend/` directory.

### Running the Application
- Run Frontend (Next.js): `npm run dev` or `run_frontend.bat` (Runs on http://localhost:3000)
- Run Backend (Express.js): `cd backend && npm run dev` or `run_backend.bat` (Runs on http://localhost:5000)

### Building & Linting
- Build Frontend: `npm run build`
- Start built Frontend: `npm run start`
- Lint Frontend: `npm run lint`

### Database Scripts (MySQL)
- Import complete schema: `mysql -u root -p topsystemdb < Top_Sys.sql` (or `schema.sql`)
- Import demo/seed data: `mysql -u root -p topsystemdb < insertdemodata.sql`

---

## Code Style & Architecture Guidelines
### Frontend (Next.js & React)
- **Framework**: Next.js App Router (`src/app/`) with React 19.
- **Styling**: TailwindCSS v4. Follow modern, vibrant, and interactive aesthetics. Use smooth animations, hover effects, and premium color palettes (e.g., tailored HSL colors, dark modes).
- **State Management**: Use React Context (`src/context/AppContext.js`).
- **Icons**: Utilize inline SVGs or custom React components for icons, styled with Tailwind.
- **Path Aliases**: Use `@/` for imports from the `src/` directory (e.g., `@/components/AppLayout`, `@/utils/db`).
- **Logic Rule**: Keep business logic out of the presentation layer. Use helpers in `src/utils/` and fetch endpoints from the backend API.

### Backend (Express.js)
- **Framework**: Node.js, Express.js.
- **Structure**: MVC pattern inside `backend/`:
  - `config/`: Configuration & database pool (`db.js`).
  - `controllers/`: Request handlers containing business logic.
  - `routes/`: Express routers mapping paths to controllers.
  - `middlewares/`: Middleware functions (authentication, validation, error handler).
- **Error Handling**: Use the central `errorMiddleware.js` for clean, consistent error responses.
- **Database Access**: Perform SQL queries using parameterized queries with the `mysql2` pool to prevent SQL Injection.
- **API Responses**: Always return JSON payloads with standard HTTP status codes:
  - Success: `200 OK` (Fetch/Update), `201 Created` (Creation)
  - Client errors: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
  - Server errors: `500 Internal Server Error`

### Database Schema Guidelines
- Follow the schema defined in `Top_Sys.sql`.
- Key entities: `users`, `departments`, `positions`, `projects`, `tasks`, `documents`, `chat_channels`, `chat_messages`, `issues`, `notifications`, `activity_logs`.
