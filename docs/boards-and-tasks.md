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
| `apps/kanban/src/components/TaskCard.tsx` | Draggable task card rendering title, priority badges, tags, assignee, due date, and stripped HTML description snippet |
| `apps/kanban/src/components/TaskDialog.tsx` | Modal form for creating and updating tasks with expanded WYSIWYG rich text editor layout |
| `apps/kanban/src/components/RichTextEditor.tsx` | TipTap-based WYSIWYG rich text editor supporting inline formatting, screenshot clipboard pasting, drag-and-drop, S/M/L image sizing, and corner resizing |
| `apps/kanban/src/lib/dnd.ts` | DnD helper calculations for column/task identifier parsing and target insertion |
| `apps/api-server/src/routes/boards.ts` | Board CRUD and team linking endpoints |
| `apps/api-server/src/routes/columns.ts` | Column CRUD and default column creation |
| `apps/api-server/src/routes/tasks.ts` | Task CRUD, stats endpoint, and positional move reordering |
| `apps/api-server/src/lib/taskOrder.ts` | Positional indexing logic for calculating target positions |

---

## WYSIWYG Rich Text Descriptions & Image Sizing (TipTap)

Task descriptions support a single, Word-style **WYSIWYG** editing experience via `RichTextEditor` powered by **TipTap** (ProseMirror):

- **Single Canvas Visual Editing**: No preview tabs, split panes, or raw syntax. Formats are applied directly inline (bold, italic, underline, strike, headings H1-H3, bullet/numbered lists, task checklists, quotes, code blocks, links).
- **Inline Screenshot Pasting & Drag-and-Drop**: Capturing clipboard screenshots (`Ctrl+V`) or dragging image files directly embeds them inline.
- **S / M / L Image Sizing**:
  - `S` (Small): ~220px max-width.
  - `M` (Medium, default): ~460px standard width.
  - `L` (Large): 100% full container width.
  - Hovering or clicking an image reveals an active floating badge with `[S] [M] [L]` size selectors, full-screen lightbox zoom, and remove button.
- **Expandable Box & No Horizontal Scroll**: The editor is vertically resizable from the corner (`resize-y`) with smooth vertical scrolling (`overflow-y-auto`) and strict `overflow-x-hidden` prevention of horizontal scrollbars.
- **Board Card Preview Cleanliness**: `stripHtmlPreview` strips HTML tags and base64 image strings from the 2-line preview on `TaskCard` so Kanban boards remain clean and uncluttered.

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
