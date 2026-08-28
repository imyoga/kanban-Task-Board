# Development Guide

## Prerequisites

- **Node.js**: v20+ (recommended v22+)
- **pnpm**: v9+ (e.g. `npm i -g pnpm`)
- **Docker Desktop**: For running local PostgreSQL

---

## Local Setup

### 1. Environment Configuration

Copy example environment variables:

```bash
cp .env.example .env
```

Ensure `.env` contains:

```ini
PORT=5000
DATABASE_URL=postgresql://kanban:kanban@127.0.0.1:5432/kanban
SESSION_SECRET=dev-session-secret-key-at-least-32-chars
VITE_API_URL=http://localhost:5000
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start PostgreSQL Database

```bash
# Start Postgres 16 container in background
pnpm db:up

# Apply Drizzle database schema
pnpm db:push

# Optional: Seed default test account & sample board
pnpm db:seed
```

> [!NOTE]
> `pnpm db:seed` provisions a test account `moradiyayogeshg@gmail.com` with password `Yogesh123` and a sample development board.

---

## Running the Application

### Concurrent Full-Stack Mode

```bash
pnpm dev
```

Starts:
- Express API server on `http://localhost:5000`
- Vite frontend application on `http://localhost:5173`

### Individual Services

```bash
# Start API server in watch mode
pnpm dev:api

# Start Vite React frontend
pnpm dev:web

# Production build and run API with built frontend
pnpm dev:be
```

---

## Quality & Build Commands

```bash
# Typecheck all packages
pnpm typecheck

# Build all packages for production
pnpm build

# Recompile OpenAPI contracts to Zod & React Query hooks
pnpm --filter @workspace/api-spec run codegen
```

---

## Windows Background Service Setup (NSSM)

The project includes Windows Service deployment scripts using [NSSM (Non-Sucking Service Manager)](https://nssm.cc/):

- `app.bat`: Startup script that launches the production build on the configured port.
- `install-service.ps1`: PowerShell script to register and start the application as a background Windows Service.

To install as a Windows Service (run PowerShell as Administrator):

```powershell
.\install-service.ps1
```

To stop or inspect the service:

```powershell
Get-Service -Name "app13-45013-kanban-task-board"
```

Logs are output to the `logs/stdout.log` and `logs/stderr.log` files with automatic log rotation.
