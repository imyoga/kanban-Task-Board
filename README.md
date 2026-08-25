# Kanban Task Board

Full-stack Kanban board: React frontend + Express API + PostgreSQL (Drizzle ORM).

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS (`artifacts/kanban`)
- **Backend:** Express 5 (`artifacts/api-server`)
- **Database:** PostgreSQL + Drizzle (`lib/db`)
- **API contract:** OpenAPI + Orval-generated client/Zod (`lib/api-spec`, `lib/api-client-react`, `lib/api-zod`)

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

This runs Drizzle push in CI mode with `--force` — no rename/create prompts.

## Run locally

```bash
# Terminal 1 — API (http://localhost:5000)
pnpm dev:api

# Terminal 2 — Web (http://localhost:5173, proxies /api → API)
pnpm dev:web
```

## Useful scripts

| Command | Description |
|---|---|
| `pnpm dev:api` | Build and start the API server |
| `pnpm dev:web` | Start the Vite frontend |
| `pnpm db:push` | Apply Drizzle schema to Postgres (non-interactive, forced) |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client from OpenAPI |

## Environment

See `.env.example`. Main variables:

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` — cookie signing secret
- `API_PORT` / `PORT` — API port (default `5000`)
- `BASE_PATH` — frontend base path (default `/`)
