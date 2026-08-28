# API Contracts & Codegen

## Overview

Kanban Task Board enforces a **Contract-First Architecture** using OpenAPI 3.0 and [Orval](https://orval.dev/).

```
packages/api-spec/openapi.yaml
         │
         ├──( Orval Codegen )
         │
         ├──> packages/api-zod/src/generated/
         │      ├── api.ts (Zod endpoint schemas)
         │      └── types/*.ts (TypeScript entity types)
         │
         └──> packages/api-client-react/src/generated/
                ├── api.ts (TanStack Query hooks)
                └── api.schemas.ts (Client-side types)
```

---

## Modifying or Adding Endpoints

### 1. Update the OpenAPI Spec

Edit `packages/api-spec/openapi.yaml` to define the route, HTTP method, parameters, request body, and response structure.

Example:

```yaml
/boards/{boardId}/tasks:
  get:
    summary: List tasks for a board
    operationId: listTasks
    parameters:
      - name: boardId
        in: path
        required: true
        schema:
          type: integer
    responses:
      '200':
        description: List of tasks
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/Task'
```

### 2. Run Codegen

Run the Orval compilation command from root:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This updates both packages and runs `tsc --build`.

---

## Backend Usage (`@workspace/api-zod`)

Import generated Zod validation schemas in Express routes:

```typescript
import { listTasksQueryResponse } from '@workspace/api-zod';

router.get('/boards/:boardId/tasks', async (req, res) => {
  const tasks = await getTasks(Number(req.params.boardId));
  const validated = listTasksQueryResponse.parse(tasks);
  res.json(validated);
});
```

---

## Frontend Usage (`@workspace/api-client-react`)

Import auto-generated TanStack React Query hooks:

```tsx
import { useListTasks, useCreateTask } from '@workspace/api-client-react';

export function KanbanColumn({ boardId }: { boardId: number }) {
  const { data: tasks, isLoading } = useListTasks(boardId);
  const { mutate: addTask } = useCreateTask();

  const handleCreate = () => {
    addTask({ data: { boardId, title: "New Feature", columnId: 1 } });
  };

  return <div>{/* Render tasks */}</div>;
}
```

---

## Invariants

- **Never edit generated files directly:** Files under `packages/api-zod/src/generated/` and `packages/api-client-react/src/generated/` are overwritten during codegen.
- **Custom fetch mutator:** The frontend HTTP client uses `packages/api-client-react/src/custom-fetch.ts` to attach `credentials: 'include'` and handle base URL routing.
