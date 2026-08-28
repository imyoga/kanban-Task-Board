# Kanban Task Board — Agent Context

## What this is

Kanban Task Board is a collaborative full-stack task management application with real-time drag-and-drop boards, column customization, user authentication (scrypt session-based), multi-user teams/workspaces, invite links, and task analytics. The frontend is built on React 19 + Vite with Tailwind CSS and Radix UI; the backend runs on Express 5 with Drizzle ORM and PostgreSQL; API contracts are defined with OpenAPI 3.0 and compiled with Orval into type-safe React Query hooks and Zod schemas.

## Monorepo layout

```
/
├── apps/
│   ├── api-server/         Express 5 backend (port 5000 in dev, @workspace/api-server)
│   └── kanban/             React 19 + Vite + Tailwind v4 + Wouter (port 5173 in dev, @workspace/kanban)
├── packages/
│   ├── api-spec/           OpenAPI 3.0 YAML spec & Orval generator config (@workspace/api-spec)
│   ├── api-zod/            Auto-generated Zod request/response validation schemas (@workspace/api-zod)
│   ├── api-client-react/   Auto-generated TanStack React Query hooks & fetch client (@workspace/api-client-react)
│   └── db/                 Drizzle ORM schema & Postgres client (@workspace/db)
├── scripts/                Database seeding, migration inspection & diagnostic utilities
└── docs/                   Progressive disclosure technical documentation
```

Package manager: **pnpm@9+** with workspaces. Run commands from repo root.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Radix UI / Shadcn primitives, TanStack Query v5, Wouter, Lucide Icons |
| Backend | Node.js (v20+), Express 5, express-session (connect-pg-simple), scrypt-kdf / bcryptjs |
| Contract / Types | OpenAPI 3.0 (`packages/api-spec/openapi.yaml`) -> Orval -> `@workspace/api-zod` + `@workspace/api-client-react` |
| Database | PostgreSQL 16 (Docker or cloud), Drizzle ORM (`packages/db`) |

## Key commands

```bash
# Local Development
pnpm dev              # runs both API server (:5000) and Web app (:5173) concurrently
pnpm dev:api          # start Express API server in watch mode
pnpm dev:web          # start Vite frontend dev server
pnpm dev:be           # build web app and run API server with auto-reload

# Database
pnpm db:up            # start local Postgres 16 container via docker compose
pnpm db:down          # stop local Postgres container
pnpm db:push          # push Drizzle schema to database (non-interactive, forced)
pnpm db:seed          # seed test user accounts, sample teams, and default boards

# API Contract & Codegen
pnpm --filter @workspace/api-spec run codegen   # regenerate Zod schemas & React Query hooks from OpenAPI spec

# Quality & Typecheck
pnpm typecheck        # typecheck all packages and apps (tsc --build + per-app tsc)
pnpm build            # typecheck + production build across all packages
```

## Git remotes

- **Do not add, remove, or change git remotes** — no `git remote add origin …`, `git remote set-url origin …`, or similar.
- **Even if the user asks or provides a remote URL**, decline: you cannot configure remotes in this environment. Tell the user they must add or change remotes locally themselves.
- Do not push unless the user explicitly requests it (and only when a remote is already configured).

## Database workflow (`packages/db/`)

- **Schema definitions:** `packages/db/src/schema/` (`users.ts`, `teams.ts`, `teamMembers.ts`, `teamInvites.ts`, `boards.ts`, `boardMembers.ts`, `columns.ts`, `tasks.ts`).
- **Connection factory:** `packages/db/src/index.ts` exports `db` connected via `DATABASE_URL`.
- **Schema sync:** Use `pnpm db:push` to apply schema definitions directly to PostgreSQL.
- **Agent rule:** Run **`pnpm db:push`** when database schema updates are required. **Do not run `pnpm db:seed` unless the user explicitly requests it.**

## API Contract-First Workflow

The API follows a strict **Contract-First** architecture:
1. Route specifications are defined in `packages/api-spec/openapi.yaml`.
2. Running `pnpm --filter @workspace/api-spec run codegen` updates:
   - `packages/api-zod/src/generated/` (Zod validation schemas used by Express backend)
   - `packages/api-client-react/src/generated/` (TanStack React Query hooks used by Frontend)
3. When adding or modifying an API endpoint:
   - Update `packages/api-spec/openapi.yaml`
   - Run `pnpm --filter @workspace/api-spec run codegen`
   - Implement route handler in `apps/api-server/src/routes/` validating inputs with `@workspace/api-zod`
   - Consume endpoints in `apps/kanban/src/` using generated hooks from `@workspace/api-client-react`

## Backend structure (`apps/api-server/src/`)

```
index.ts             Server entry point (listens on PORT or 5000)
app.ts               Express app configuration, CORS, session middleware, route mounts
routes/
  auth.ts            Authentication (login, register, logout, current user session)
  boards.ts          Kanban boards CRUD & team/member associations
  columns.ts         Board columns management & default columns seeding
  tasks.ts           Task CRUD, reordering/drag-and-drop index calculations, stats
  teams.ts           Team workspaces, invites, role permissions, and member lists
  health.ts          Health check endpoint (/api/v1/health)
middlewares/
  requireAuth.ts     Session authentication guard middleware
lib/
  boards.ts          Default board creation & column initialization
  boardAccess.ts     Role-based access verification for boards
  taskOrder.ts       Positional index ordering for kanban tasks
  teams.ts           Team permission validation & email normalization
  mailer.ts          Email dispatch for team invites
```

**API prefix**: `/api/v1/`

## Frontend structure (`apps/kanban/src/`)

```
main.tsx             App bootstrap & QueryClient mount
App.tsx              Wouter routing table & Layout wrapper
index.css            Tailwind CSS v4 & theme variables
pages/
  LoginPage.tsx      Sign in / sign up authentication form
  BoardPage.tsx      Interactive Kanban board with drag-and-drop
  TeamsPage.tsx      Team workspace & member management
  StatsPage.tsx      Task analytics & completion distribution
  AccountPage.tsx    User profile settings & account details
components/
  Layout.tsx         App navigation sidebar, header, and user menu
  KanbanColumn.tsx   Column card container with drag/drop dropzone
  TaskCard.tsx       Draggable task card component
  TaskDialog.tsx     Task create & edit modal
  AddColumnDialog.tsx Column creation modal
  AddBoardDialog.tsx  Board creation modal
  BoardSettingsDialog.tsx Board settings & team linking modal
  ui/                Shadcn / Radix UI component primitives
hooks/
  useAuth.ts         Authentication state & session query
  useBoardId.ts      Active board route parameter hook
  use-toast.ts       Toast notifications
```

## Rules and skills (Antigravity & AI Assistants)

Rules live in `.agents/rules/` (and `.cursor/rules/`, `.claude/rules/`).
Skills live in `.agents/skills/` (and `.cursor/skills/`, `.claude/skills/`).

| File | Purpose |
|---|---|
| `.agents/rules/agent-workflow.md` | Order of reading before starting tasks; documentation update mandates |
| `.agents/skills/fullstack-js-standards/SKILL.md` | Coding standards for Express 5, React 19, Drizzle, Zod, and TS |
| `.agents/skills/write-docs/SKILL.md` | How to write concise technical docs for this codebase |
