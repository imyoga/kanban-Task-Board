# Team Member @Mentions & Notifications

## What it does

Allows users to tag team members using the `@` sign in task descriptions (WYSIWYG editor) and task comments with an interactive autocomplete popup of matching names. Tagged teammates receive persistent in-app notifications with unread badges, accessed via a bell icon in the top-right corner that opens a modal showing context, board, task keys, and comment snippets with direct navigation to the tagged task.

## Implementation

| File | Role |
|---|---|
| `packages/db/src/schema/notifications.ts` | Drizzle PostgreSQL schema for `notificationsTable` |
| `packages/api-spec/openapi.yaml` | OpenAPI contract for `/notifications` endpoints and updated `BoardMember` schema |
| `apps/api-server/src/lib/notifications.ts` | Mention extraction (markdown `@[Name](id)`, HTML `data-id`, `@email`) and notification dispatch |
| `apps/api-server/src/routes/notifications.ts` | Express routes for listing notifications, unread count, read toggles, and bulk read |
| `apps/api-server/src/routes/comments.ts` | Triggers mention notifications on comment creation and edits |
| `apps/api-server/src/routes/tasks.ts` | Triggers mention notifications on task description updates |
| `apps/api-server/src/routes/boards.ts` | Returns full member info (`firstName`, `lastName`) and linked team members |
| `apps/kanban/src/components/MentionSuggestionList.tsx` | Reusable mention autocomplete dropdown with keyboard navigation |
| `apps/kanban/src/components/RichTextEditor.tsx` | TipTap editor integrated with `@tiptap/extension-mention` and mention popup |
| `apps/kanban/src/components/TaskCommentsTab.tsx` | Textarea mention trigger, suggestion popup, and highlighted mention rendering |
| `apps/kanban/src/components/NotificationBell.tsx` | Top-right bell icon with live unread badge count |
| `apps/kanban/src/components/NotificationsModal.tsx` | Dialog showing All and Unread notifications, comment snippets, and task deep links |

## API & Schema

### `notifications` Table

| Column | Type | Description |
|---|---|---|
| `id` | `serial` | Primary key |
| `user_id` | `integer` | Recipient user ID (references `users.id` cascade) |
| `actor_id` | `integer` | Tagging user ID (references `users.id` cascade) |
| `board_id` | `integer` | Board ID (references `boards.id` cascade) |
| `task_id` | `integer` | Task ID (references `tasks.id` cascade) |
| `comment_id` | `integer` | Optional comment ID (references `task_comments.id` cascade) |
| `type` | `text` | `"mention_comment"` or `"mention_description"` |
| `title` | `text` | Notification title string |
| `content` | `text` | Comment or description snippet containing mention |
| `is_read` | `boolean` | Read status (default `false`) |
| `created_at` | `timestamp` | Timestamp of notification creation |

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/notifications` | List user's notifications (`?unreadOnly=true` supported) |
| `GET` | `/api/v1/notifications/unread-count` | Get integer count of unread notifications |
| `POST` | `/api/v1/notifications/read-all` | Mark all user notifications as read |
| `PATCH` | `/api/v1/notifications/:id/read` | Toggle or set read status for a notification |

## Known limitations / deviations from plan

- Self-mentions are automatically filtered so users do not receive notifications when tagging themselves.
- Mentions are scoped to users who have access to the board (board owner, direct board members, and team members if linked to a team).
