# Teams & Authentication

## What it does

Handles user registration, login, logout, password hashing, session state persistence, multi-user team workspaces, role-based access control, team invite codes, and board collaboration.

---

## Implementation

### Key Files

| File | Role |
|---|---|
| `apps/kanban/src/pages/LoginPage.tsx` | Sign in, registration, and forgot password request form with validation and error alerts |
| `apps/kanban/src/pages/ResetPasswordPage.tsx` | Temporary link verification and new password creation form |
| `apps/kanban/src/pages/TeamsPage.tsx` | Teams dashboard, invite generation, join-by-code dialog, member management |
| `apps/kanban/src/hooks/useAuth.ts` | React hook wrapping current user session, auth mutations, and password reset |
| `apps/api-server/src/routes/auth.ts` | Login, signup, logout, session verification, forgot password, reset password |
| `apps/api-server/src/routes/teams.ts` | Team CRUD, member roles, invite code generation, invite redemption |
| `apps/api-server/src/middlewares/requireAuth.ts` | Session guard middleware protecting private endpoints |
| `apps/api-server/src/lib/mailer.ts` | SMTP email dispatch for team invitations and password reset links |
| `apps/api-server/src/lib/boardAccess.ts` | Verification helper for board permission checks across personal/team contexts |

---

## Authentication Flow

1. **Sign Up (`POST /api/auth/signup`):**
   - Normalizes email (`toLowerCase()`).
   - Hashes password with salt.
   - Creates `users` record.
   - Auto-creates user's first default personal board ("My Board") and columns.
   - Accepts any pending team invitations waiting for this email.
   - Stores `userId` in `req.session.userId`.

2. **Sign In (`POST /api/auth/login`):**
   - Looks up user by email.
   - Compares password hash.
   - Stores `userId` in `req.session.userId`.

3. **Session Verification (`GET /api/auth/me`):**
   - Checks session cookie.
   - Returns current user profile (id, email, first name, last name, avatar).

4. **Forgot Password (`POST /api/auth/forgot-password`):**
   - Normalizes email and finds user.
   - Generates cryptographically secure 32-byte token with 1-hour expiration.
   - Saves record into `password_reset_tokens` table (pruning any prior tokens for the user).
   - Sends email via nodemailer Gmail SMTP containing temporary reset link: `/reset-password?token=<token>`.
   - Returns generic success message to prevent account enumeration.

5. **Token Verification (`GET /api/auth/reset-password/:token`):**
   - Verifies token exists and `expiresAt > now`.
   - Returns user email or 400 error if expired/invalid.

6. **Reset Password (`POST /api/auth/reset-password`):**
   - Verifies token and new password (minimum 6 characters).
   - Hashes new password with bcrypt.
   - Updates `passwordHash` in `users` table.
   - Deletes all password reset tokens for that user.

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
| `POST` | `/api/auth/signup` | Register new user account |
| `POST` | `/api/auth/login` | Authenticate and create session |
| `POST` | `/api/auth/logout` | Destroy session |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/auth/forgot-password` | Request password reset email |
| `GET` | `/api/auth/reset-password/:token` | Verify temporary reset token |
| `POST` | `/api/auth/reset-password` | Set new password using reset token |
| `GET` | `/api/v1/teams` | List teams current user belongs to |
| `POST` | `/api/v1/teams` | Create a new team |
| `GET` | `/api/v1/teams/:teamId` | Get team details and member list |
| `PATCH` | `/api/v1/teams/:teamId` | Update team name |
| `DELETE` | `/api/v1/teams/:teamId` | Delete team (owner only) |
| `POST` | `/api/v1/teams/:teamId/invites` | Send email invite / generate invite token |
| `POST` | `/api/v1/teams/join` | Join team via invite code |
| `DELETE` | `/api/v1/teams/:teamId/members/:userId` | Remove member from team |
