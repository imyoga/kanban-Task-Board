---
name: fullstack-js-standards
description: >-
  Applies full-stack JavaScript/TypeScript quality standards: structure, naming,
  architecture, JSDoc, and maintainability. Use when writing or reviewing
  frontend, backend, or shared code; refactoring large files; or when the user
  asks for best practices, scalable organization, or "senior" JS/TS style.
---

# Full-stack JavaScript/TypeScript standards

Apply these by default to all new code and when refactoring. Prefer **clarity, small surfaces, and consistency with the existing repo** over generic "best practice" that fights local conventions.

## File size and splitting

- **Target: under ~500 lines per file** (components, modules, route handlers). If a file grows past that, **split** before adding more behavior.
- Split by **cohesion**: hooks, subcomponents, mappers, API clients, or domain helpers in adjacent files; avoid "utils" dumping grounds.
- **Barrel files** (`index.ts`): re-export public API only; do not re-export every internal to hide structure.

## Naming

| Area | Convention |
|------|--------------|
| **Components (React)** | `PascalCase.tsx` for components; colocate `ComponentName.test.tsx` or `__tests__/` if the project uses tests. |
| **Hooks** | `useThing.ts` or `useThingQuery.ts` — name reflects data or behavior. |
| **Event handlers** | `handleClick`, `handleSubmit` or `onX` props matching DOM/React norms. |
| **Server modules** | `camelCase` or `kebab-case` matching existing files; one style per layer. |
| **Constants** | `SCREAMING_SNAKE` for true module-level invariants; otherwise `camelCase`. |
| **No ambiguous names** | Avoid `data`, `info`, `manager` without domain context. |

## Frontend structure (React 19 + Vite)

- **One main responsibility per file.** Presentational vs container split only when it reduces noise; do not over-abstract.
- **Order inside a file (typical):** imports (external → internal → types) → types/interfaces → constants → component(s) → helpers.
- **State:** colocate state as low as it can live; lift only when multiple children need it. Prefer TanStack Query (`@workspace/api-client-react`) for server state, not ad hoc `useEffect` fetch.
- **Forms & Validation:** schema-driven validation using Zod (`@workspace/api-zod`) shared between client and server.
- **Styling:** Tailwind CSS v4 + Radix UI primitives. Use utility classes and `cn()` helper (`@/lib/utils`).

## Backend API (Express 5 on Node.js)

**File structure:**
- Route handlers: `apps/api-server/src/routes/*.ts`
- Middleware: `apps/api-server/src/middlewares/*.ts`
- Domain helpers: `apps/api-server/src/lib/*.ts`

**Express 5 conventions:**
- Route parameters and async error handling are built-in in Express 5.
- Validation at the boundary: use `@workspace/api-zod` schemas to validate `req.body`, `req.query`, and `req.params`.
- Thin route handlers: parse/validate request, invoke service or domain helper, return response.
- Auth middleware: protect private routes using `requireAuth` middleware.

## Database (Drizzle ORM + PostgreSQL)

**Schema definition:**
- Define schemas in `packages/db/src/schema/*.ts`
- Export all tables via `packages/db/src/schema/index.ts`
- Use `pgTable`, `varchar`, `text`, `integer`, `timestamp`, `boolean`, `serial` from `drizzle-orm/pg-core`

**Query patterns:**
- Use `db.select()`, `db.insert()`, `db.update()`, `db.delete()`
- Prefer `.where()` with `eq`, `and`, `or`, `inArray` helpers
- Use `.returning()` for INSERT/UPDATE to retrieve updated records
- Type-safe joins with `leftJoin`, `innerJoin`

## API Contract maintenance

- **Spec First:** Always edit `packages/api-spec/openapi.yaml` when adding or changing API interfaces.
- **Recompile:** Run `pnpm --filter @workspace/api-spec run codegen` to update `@workspace/api-zod` and `@workspace/api-client-react`.
- Never manually edit generated files under `packages/api-zod/src/generated/` or `packages/api-client-react/src/generated/`.

## Code quality bar

- **No dead code** left from refactors. **No** commented-out blocks.
- **Early returns** to reduce nesting; handle errors first.
- **No `any` without a narrow escape comment**; prefer `unknown` + narrowing.
- **Async:** always `async/await` in app code; handle potential database or network errors cleanly.
- **Immutability:** do not mutate props or shared objects; use spreads or immutable patterns.

## When changing existing code

1. **Read** the nearest similar file and **mirror** its patterns.
2. **Refactor** only to satisfy the task — no unrelated cleanups.
3. **Update** project docs if the change alters public behavior, routes, or schema (per `agent-workflow` / `write-docs`).
