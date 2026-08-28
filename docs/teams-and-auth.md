# Teams & Authentication

## What it does

Handles user registration, login, logout, password hashing, session state persistence, multi-user team workspaces, role-based access control, team invite codes, and board collaboration.

---

## Implementation

### Key Files

| File | Role |
|---|---|
| `apps/kanban/src/pages/LoginPage.tsx` | Sign in and registration form with validation and error alerts |
| `apps/kanban/src/pages/TeamsPage.tsx` | Teams dashboard, invite generation, join-by-code dialog, member management |
| `apps/kanban/src/hooks/useAuth.ts` | React hook wrapping current user session and authentication mutations |
| `apps/api-server/src/routes/auth.ts` | Login, signup, logout, session verification (`/api/v1/auth/me`) |
| `apps/api-server/src/routes/teams.ts` | Team CRUD, member roles, invite code generation, invite redemption |
| `apps/api-server/src/middlewares/requireAuth.ts` | Session guard middleware protecting private endpoints |
| `apps/api-server/src/lib/boardAccess.ts` | Verification helper for board permission checks across personal/team contexts |

---

## Authentication Flow

1. **Sign Up (`POST /api/v1/auth/register`):**
   - Normalizes email (`toLowerCase()`).
   - Hashes password with salt.
   - Creates `users` record.
   - Auto-creates user's first default personal board ("My Board") and columns.
   - Accepts any pending team invitations waiting for this email.
   - Stores `userId` in `req.session.userId`.

2. **Sign In (`POST /api/v1/auth/login`):**
   - Looks up user by email.
   - Compares password hash.
   - Stores `userId` in `req.session.userId`.

3. **Session Verification (`GET /api/v1/auth/me`):**
   - Checks session cookie.
   - Returns current user profile (id, email, first name, last name, avatar).

---

## Teams & Workspaces

Users can create multiple team workspaces. Each team has:
- A unique 8-character uppercase `invite_code` (e.g. `KBN-X7R9`).
- Members with roles:
  - `owner`: Can delete team, remove members, manage all boards.
  - `admin`: Can invite members, create/link boards.
  - `member`: Can view team boards and collaborate on tasks.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new user account |
| `POST` | `/api/v1/auth/login` | Authenticate and create session |
| `POST` | `/api/v1/auth/logout` | Destroy session |
| `GET` | `/api/v1/auth/me` | Get current authenticated user |
| `GET` | `/api/v1/teams` | List teams current user belongs to |
| `POST` | `/api/v1/teams` | Create a new team |
| `GET` | `/api/v1/teams/:teamId` | Get team details and member list |
| `PATCH` | `/api/v1/teams/:teamId` | Update team name |
| `DELETE` | `/api/v1/teams/:teamId` | Delete team (owner only) |
| `POST` | `/api/v1/teams/:teamId/invites` | Send email invite / generate invite token |
| `POST` | `/api/v1/teams/join` | Join team via invite code |
| `DELETE` | `/api/v1/teams/:teamId/members/:userId` | Remove member from team |
