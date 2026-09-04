# Kanban Task Board Documentation

Collaborative task management application with real-time drag-and-drop boards, column customization, session-based authentication, multi-user teams/workspaces, invite links, and task analytics. React frontend + Express API + PostgreSQL (Drizzle ORM), organized as a pnpm monorepo.

## Docs in This Folder

| Doc | Description |
|---|---|
| [architecture.md](./architecture.md) | Tech stack, folder layout, OpenAPI contract pipeline, database schema, session auth flow, deployment |
| [development.md](./development.md) | Local setup, Docker Postgres, scripts, Windows background service setup (NSSM), troubleshooting |
| [boards-and-tasks.md](./boards-and-tasks.md) | Board management, default columns, task CRUD, drag-and-drop reordering, priority tags, and stats |
| [teams-and-auth.md](./teams-and-auth.md) | User authentication, scrypt password hashing, teams, invite codes, member roles, and board permissions |
| [api-contracts.md](./api-contracts.md) | OpenAPI 3.0 spec maintenance, Orval code generator, Zod schemas, and React Query client |

## Quick Links

| Area | Stack | Location |
|---|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS v4, Radix UI, TanStack Query v5, Wouter | [apps/kanban](../apps/kanban) |
| Backend | Express 5, Node.js (20+), express-session, connect-pg-simple | [apps/api-server](../apps/api-server) |
| Database | PostgreSQL 16, Drizzle ORM | [packages/db](../packages/db) |
| Contracts | OpenAPI 3.0, Orval codegen | [packages/api-spec](../packages/api-spec) |
| Generated Zod | Zod request & response validators | [packages/api-zod](../packages/api-zod) |
| Generated React Client | TanStack Query custom-fetch hooks | [packages/api-client-react](../packages/api-client-react) |
| Monorepo | pnpm workspaces | [pnpm-workspace.yaml](../pnpm-workspace.yaml) |

Agent context: [AGENTS.md](../AGENTS.md) · [GEMINI.md](../GEMINI.md) · [CLAUDE.md](../CLAUDE.md)

## Route Overview

| Path | Component | Purpose |
|---|---|---|
| `/` | `HomeRedirect` | Redirects authenticated users to first board; redirects unauthenticated users to `/login` |
| `/login` | `LoginPage` | User login, registration, and password reset request forms |
| `/reset-password` | `ResetPasswordPage` | Dedicated token verification and password reset form |
| `/b/:boardId` | `BoardPage` | Interactive Kanban board with columns, task cards, and drag-and-drop |
| `/teams` | `TeamsPage` | Team management, member invites, invite codes, and team boards |
| `/stats` | `StatsPage` | Visual analytics and task completion distribution charts |
| `/account` | `AccountPage` | User profile settings and account preferences |

## Key Deviations

| Area | Initial / Scaffold | Actual |
|---|---|---|
| Monorepo Layout | Replit artifacts (`artifacts/` + `lib/`) | Standard monorepo structure (`apps/` + `packages/`) with full pnpm catalog support |
| API Contracts | Ad-hoc or manual types | Contract-First OpenAPI 3.0 spec auto-generating strict Zod schemas and React Query hooks via Orval |
| Auth Mechanism | Stateless JWT | Session-based authentication stored in PostgreSQL (`session` table via `connect-pg-simple`) with scrypt password hashing |
| Task Reordering | Integer index swap | Fractional positional indexing logic (`applyTaskMove`) for stable drag-and-drop positioning without mass row updates |
| Workspace Permissions | Single-user boards | Dual-mode board ownership: personal boards or team-linked boards with role-based member permissions |
| Windows Deployment | Manual process launch | Windows background service support using NSSM (`install-service.ps1` and `app.bat`) |
