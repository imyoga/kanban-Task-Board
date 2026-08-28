# Boards & Tasks

## What it does

Provides the core Kanban board experience: creating and customizing boards, managing columns (swimlanes), creating and editing task cards, drag-and-drop reordering between columns, tag filtering, priority management, and aggregate task statistics.

---

## Implementation

### Key Files

| File | Role |
|---|---|
| `apps/kanban/src/pages/BoardPage.tsx` | Main board view, drag-and-drop context, column layout, dialog triggers |
| `apps/kanban/src/components/KanbanColumn.tsx` | Droppable column container with task list and quick add button |
| `apps/kanban/src/components/TaskCard.tsx` | Draggable task card rendering title, priority badges, tags, assignee, due date |
| `apps/kanban/src/components/TaskDialog.tsx` | Modal form for creating and updating tasks |
| `apps/kanban/src/lib/dnd.ts` | DnD helper calculations for column/task identifier parsing and target insertion |
| `apps/api-server/src/routes/boards.ts` | Board CRUD and team linking endpoints |
| `apps/api-server/src/routes/columns.ts` | Column CRUD and default column creation |
| `apps/api-server/src/routes/tasks.ts` | Task CRUD, stats endpoint, and positional move reordering |
| `apps/api-server/src/lib/taskOrder.ts` | Positional indexing logic for calculating target positions |

---

## Drag-and-Drop Positional Ordering

Instead of updating the integer sequence of every card when a task moves, the system uses floating-point position offsets (`applyTaskMove` in `apps/api-server/src/lib/taskOrder.ts`):

- When dropped at the top of a column: `target_position = (first_task.position / 2)`
- When dropped between two tasks: `target_position = (prev_task.position + next_task.position) / 2`
- When dropped at the bottom: `target_position = (last_task.position + 1000)`

This guarantees $O(1)$ single-row updates during drag-and-drop operations.

---

## Default Columns Initialization

When a new board is created, `seedDefaultColumnsForBoard()` initializes four default columns:

1. **Backlog** (`#64748b`)
2. **In Progress** (`#3b82f6`)
3. **Review** (`#eab308`)
4. **Done** (`#22c55e`)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/boards` | List accessible boards for current user |
| `POST` | `/api/v1/boards` | Create a new personal or team board |
| `GET` | `/api/v1/boards/:boardId` | Get board details |
| `PATCH` | `/api/v1/boards/:boardId` | Update board name, background color, or team association |
| `DELETE` | `/api/v1/boards/:boardId` | Delete board |
| `GET` | `/api/v1/boards/:boardId/columns` | List columns for a board |
| `POST` | `/api/v1/boards/:boardId/columns` | Add a new column |
| `PATCH` | `/api/v1/columns/:columnId` | Update column title or color |
| `DELETE` | `/api/v1/columns/:columnId` | Delete column and cascade delete tasks |
| `GET` | `/api/v1/boards/:boardId/tasks` | List tasks in board |
| `POST` | `/api/v1/tasks` | Create a new task |
| `PATCH` | `/api/v1/tasks/:taskId` | Update task details (title, description, priority, tags, assignee) |
| `PATCH` | `/api/v1/tasks/:taskId/move` | Move task to target column and index position |
| `DELETE` | `/api/v1/tasks/:taskId` | Delete task |
| `GET` | `/api/v1/boards/:boardId/stats` | Aggregate stats by priority and column counts |
