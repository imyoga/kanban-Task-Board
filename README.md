# Kanban Task Board

Full-stack Kanban board: React frontend + Express API + PostgreSQL (Drizzle ORM).

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS (`apps/kanban`)
- **Backend:** Express 5 (`apps/api-server`)
- **Database:** PostgreSQL + Drizzle (`packages/db`)
- **API contract:** OpenAPI + Orval-generated client/Zod (`packages/api-spec`, `packages/api-client-react`, `packages/api-zod`)

## Setup

1. Install [pnpm](https://pnpm.io/) and Node.js 20+
2. Copy env file and set your DB URL when ready:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
pnpm install
```

4. When Postgres is available, apply the schema (non-interactive):

```bash
pnpm db:push
```

This runs Drizzle push in CI mode with `--force` and skips interactive rename prompts.

## Run locally

```bash
# Both FE + BE concurrently
pnpm dev

# Or run individual services:
pnpm dev:be  # Start API Backend (http://localhost:5000)
pnpm dev:fe  # Start React Frontend (http://localhost:5173)

# Production build & run:
pnpm prod    # Build all packages & run single-port server (http://localhost:45013)
```

## Useful scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start both Backend and Frontend concurrently |
| `pnpm dev:be` | Start the Express API server in watch mode |
| `pnpm dev:fe` | Start the Vite React frontend |
| `pnpm prod` | Build all packages and run production server |
| `pnpm db:push` | Apply Drizzle schema to Postgres (non-interactive, forced) |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client from OpenAPI |

## Environment

The workspace supports separate environment configuration files:

- `.env.development` — Local development configuration (Dual ports: API on `5000`, Web UI on `5173`).
- `.env.production` — Production configuration (Single port `45013` serving both API and static frontend bundle).

Main variables:

- `DATABASE_URL` - Postgres connection string
- `SESSION_SECRET` - Cookie signing secret
- `PORT` - API / Production server port
- `CLIENT_ORIGIN` - Frontend application URL
- `SMTP_USER` & `GOOGLE_APP_PASSWORD` - Gmail credentials for team invite emails

