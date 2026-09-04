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
| `apps/kanban/src/components/TaskAttachments.tsx` | File attachments dropzone, list, size limit validation, download, and deletion |
| `apps/kanban/src/components/TaskCommentsTab.tsx` | Jira-style task comments thread with add, inline edit, delete, and author metadata |
| `apps/kanban/src/components/TaskHistoryTab.tsx` | Visual task audit timeline tracking description, attachment, comment, assignee, date, and status changes |
| `apps/kanban/src/components/RichTextEditor.tsx` | TipTap-based WYSIWYG rich text editor supporting inline formatting, screenshot clipboard pasting, drag-and-drop, S/M/L image sizing, and corner resizing |
| `apps/kanban/src/hooks/useBoardEvents.ts` | Client WebSocket hook managing board subscription, remote event invalidation, and real-time active user presence |
| `apps/kanban/src/lib/dnd.ts` | DnD helper calculations for column/task identifier parsing and target insertion |
| `apps/api-server/src/routes/boards.ts` | Board CRUD and team linking endpoints |
| `apps/api-server/src/routes/columns.ts` | Column CRUD and default column creation |
| `apps/api-server/src/routes/tasks.ts` | Task CRUD, stats endpoint, and positional move reordering |
| `apps/api-server/src/routes/attachments.ts` | Attachment upload (Multer with configurable max size), list, download, and delete |
| `apps/api-server/src/routes/comments.ts` | Comment CRUD endpoints with author authorization |
| `apps/api-server/src/lib/boardEvents.ts` | WebSocket server managing board channels, ping intervals, event broadcast, and user presence deduplication |
| `apps/api-server/src/lib/taskActivity.ts` | Task change audit event logging utility |
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

## Board Keys & Task URL Deep-Linking

Boards and tasks support Jira/Linear-style keys and deep-linkable URLs:

- **Board Keys**: Each board has a unique uppercase alphanumeric key (e.g. `PRDED` for "Product Development", `MYBRD` for "My Board"). Owners and managers can view and configure the Board Key in **Board Settings**.
- **Task Numbering**: Each task is assigned a sequential `taskNumber` per board.
- **Task Key Badges**: Task cards render a monospaced badge (e.g. `PRDED-5945`, `PRDED-7`) preceding the title.
- **Deep-Linkable URLs**:
  - Clicking a task updates the browser URL to `/boards/:boardId/:taskKey` (e.g. `/boards/1/PRDED-5945`).
  - Closing the task modal restores the URL to `/boards/:boardId`.
  - Sharing or refreshing any `/boards/:boardId/:taskKey` URL loads the board and immediately opens the task dialog for that task.

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
| `GET` | `/api/v1/tasks/attachments/config` | Get max file size limit and upload configuration |
| `GET` | `/api/v1/tasks/:taskId/attachments` | List all attachments for a task |
| `POST` | `/api/v1/tasks/:taskId/attachments` | Upload file attachment (multipart/form-data) |
| `DELETE` | `/api/v1/tasks/:taskId/attachments/:attachmentId` | Delete task attachment and unlink file from storage |
| `GET` | `/api/v1/tasks/:taskId/attachments/:attachmentId/download` | Download attachment file |
| `GET` | `/api/v1/tasks/:taskId/comments` | List all comments for a task |
| `POST` | `/api/v1/tasks/:taskId/comments` | Post a new comment |
| `PATCH` | `/api/v1/tasks/:taskId/comments/:commentId` | Update a comment (author or board owner) |
| `DELETE` | `/api/v1/tasks/:taskId/comments/:commentId` | Delete a comment (author or board owner) |
| `GET` | `/api/v1/tasks/:taskId/activities` | List chronological change history and audit trail for a task |

---

## Task File Attachments

Tasks support file attachments up to a configurable maximum size (default: **100MB**):

- **Storage**: Files are saved on the server in `uploads/attachments/` using sanitized UUID timestamps to avoid collisions.
- **Configurable Limits**: Configured through `MAX_FILE_SIZE_MB` in `.env` (backend) and `VITE_MAX_FILE_SIZE_MB` (frontend). The frontend also queries `/api/v1/tasks/attachments/config` to dynamically align with server limits.
- **Client Features**:
  - Dropzone supporting drag & drop or click-to-browse.
  - Multi-file upload batching with upload progress.
  - Pre-flight client-side size validation before transmission.
  - File type icons for images, PDFs, archives, code/data, and generic documents.
  - Human-readable file size and relative upload timestamps.
  - Direct download and deletion actions.

---

## Task Comments & Activity History (Jira-style Tabs)

Existing tasks in the task modal feature two tabs at the bottom: **Comments** and **History**:

### Comments Tab
- **Jira-Style Editor**: Quick-expand comment box with author initials avatar, multi-line textarea, `Ctrl+Enter` submit shortcut, and Cancel/Save buttons.
- **Comment Thread**: Displays author avatar, name, relative time, and an `(edited)` indicator if updated.
- **Author Controls**: Authors (and board owners) can edit their comments inline or delete them with an inline confirmation prompt.

### History (Audit Trail) Tab
- **Automatic Event Tracking**: Logs discrete entries for:
  - Task creation (`task_created`)
  - Description edits (`Updated task description`)
  - Title changes (`Changed title from ... to ...`)
  - Priority changes with old -> new badges (`Changed priority from medium to high`)
  - Assignee assignments and unassignments (`Assigned task to ...` / `Unassigned this task`)
  - Due date modifications (`Set due date to ...` / `Removed due date`)
  - Column status moves (`Moved from "Backlog" to "In Progress"`)
  - File attachments (`Attached file ...` / `Removed attachment ...`)
  - Comments (`Added a comment`, `Edited a comment`, `Deleted a comment`)
- **Timeline UI**: Vertical feed with contextual icons for each event type, actor initials, actor name, old/new value comparison pills, and timestamps.

---

## Real-Time User Presence (WebSocket)

Next to the board title in the board header, active teammate presence is tracked and rendered in real time via WebSocket:

- **Live-Only Avatars**: Instead of showing all team members statically, only users currently active on the board UI have their initials circle rendered in the header.
- **WebSocket Protocol**:
  - `subscribe`: When a client loads a board, it transmits `{ type: "subscribe", boardId, user }`.
  - `identify`: Re-transmits identity if auth session finishes loading after connection establishment.
  - `unsubscribe`: Sent when navigating away or unmounting before socket closure.
  - `presence`: The server broadcasts `{ type: "presence", boardId, users: PresenceUser[] }` to all clients on that board whenever any user joins, switches boards, or disconnects.
- **Tab Deduplication**: If a user opens multiple browser tabs to the same board, they are deduplicated by `userId` on the server so they only appear once in the presence stack.
- **Visual Design**:
  - Initials circle with hover zoom effect and ring accents (`primary` for current user `(You)`, `emerald` for active teammates).
  - Pulsing emerald live indicator badge (`w-2.5 h-2.5 bg-emerald-500 rounded-full`).
  - Interactive tooltip displaying full name, `(You)` indicator, and `"Active now on this board"`.
  - Overflow indicator (`+N`) for boards with more than 5 concurrent active users with a full list in tooltip.


