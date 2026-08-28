# Agent Workflow Rules

## Before starting any task

Read in this order:
1. `AGENTS.md` (or `GEMINI.md` / `CLAUDE.md`) — project context, stack, patterns, monorepo layout.
2. `docs/index.md` — feature doc map, route overview, key deviations.
3. `docs/architecture.md` — folder layout, API conventions, key patterns.
4. The specific feature doc for any area the task touches (e.g. `docs/boards-and-tasks.md`, `docs/teams-and-auth.md`, `docs/api-contracts.md`, `docs/development.md`).

## Database commands

- **`pnpm db:up`** — Start the local PostgreSQL Docker container.
- **`pnpm db:push`** — Push Drizzle schema changes directly to the PostgreSQL database. Prefer this after editing `packages/db/src/schema/`.
- **`pnpm db:down`** — Stop the local PostgreSQL container.

**Do not run `pnpm db:seed` unless the user explicitly asks.** Never assume the user wants seed data.

If unsure, tell the user to run seed themselves.

## OpenAPI & Contract-First Rules

When modifying existing API endpoints or adding new routes:
1. **Spec First:** Update `packages/api-spec/openapi.yaml` with the endpoint, parameters, request body, and response schema.
2. **Codegen:** Run `pnpm --filter @workspace/api-spec run codegen` to regenerate Zod schemas and React Query hooks.
3. **Backend validation:** Use generated schemas in `@workspace/api-zod` for Express route validation (`validateBody`, `validateQuery`, `validateParams`).
4. **Frontend consumption:** Import generated hooks from `@workspace/api-client-react`.
5. **Verify:** Run `pnpm typecheck` to verify that contracts and implementations match.

## Git remotes

- **Do not add, remove, or change git remotes** — including `git remote add origin …`, `git remote set-url origin …`, or pointing `origin` at GitHub, Bitbucket, GitLab, or any other host.
- **Even if the user asks or provides a URL**, decline politely: you cannot configure remotes in this environment; the user must run those commands locally themselves.
- Do not push to a remote unless the user explicitly requests it (and only if a remote is already configured).

## Backend & Frontend Execution

- **Fullstack dev:** `pnpm dev` runs API (`:5000`) and Web (`:5173`) concurrently.
- **API standalone:** `pnpm dev:api` runs Express backend with nodemon file-watching across `apps/api-server/src` and `packages/`.
- **Frontend standalone:** `pnpm dev:web` runs Vite dev server on port `5173`.
- **Windows service:** Background execution managed via `install-service.ps1` and `app.bat` using NSSM.

## After any implementation, update, or deletion

Update `docs/` to keep it accurate:

| Change type | Required doc update |
|---|---|
| New feature / module | Create `docs/<feature>.md`; add entry to `docs/index.md` |
| Changed stack, pattern, or folder structure | Update `docs/architecture.md` |
| Existing feature modified | Update the relevant feature doc; add a row to `docs/index.md` "Key Deviations" if actual implementation differs from what the doc describes |
| File / module deleted | Remove or correct all references across affected docs |

Docs must reflect what is **actually built**, not what was planned. Keep them concise — tables, code blocks, bullet lists. No prose padding.
