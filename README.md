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
# Terminal 1 - API (http://localhost:5000 by default, or your .env PORT)
pnpm dev:api

# Terminal 2 - Web (http://localhost:5173, proxies /api -> API)
pnpm dev:web
```

## Useful scripts

| Command | Description |
|---|---|
| `pnpm dev:api` | Start the API server in watch mode |
| `pnpm dev:web` | Start the Vite frontend |
| `pnpm db:push` | Apply Drizzle schema to Postgres (non-interactive, forced) |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm build` | Typecheck + build all packages |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API client from OpenAPI |

## Environment

See `.env.example`. Main variables:

- `DATABASE_URL` - Postgres connection string
- `SESSION_SECRET` - Cookie signing secret
- `PORT` - API port (default `5000`)
- `BASE_PATH` - Frontend base path (default `/`)
