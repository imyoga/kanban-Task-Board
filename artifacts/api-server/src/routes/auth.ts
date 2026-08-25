import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, boardsTable, teamInvitesTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createDefaultBoardForUser } from "../lib/boards";
import { normalizeEmail, acceptPendingInvitesForUser } from "../lib/teams";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

async function ensureDefaultBoardForUser(userId: number) {
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.ownerId, userId))
    .limit(1);

  if (!board) {
    await createDefaultBoardForUser(userId);
  }
}

router.get("/auth/invite/:token", async (req, res) => {
  const token = req.params.token;
  const [invite] = await db
    .select()
    .from(teamInvitesTable)
    .where(eq(teamInvitesTable.token, token));

  if (!invite) {
    res.status(404).json({ error: "Invitation not found or expired" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, invite.teamId));
  if (!team) {
    res.status(404).json({ error: "Invitation not found or expired" });
    return;
  }

  res.json({
    email: invite.email,
    teamName: team.name,
    token: invite.token,
  });
});

router.get("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json(serializeUser(user));
});

router.patch("/auth/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const firstName =
    typeof req.body?.firstName === "string" ? req.body.firstName.trim() : undefined;
  const lastName =
    typeof req.body?.lastName === "string" ? req.body.lastName.trim() : undefined;

  if (!firstName || !lastName) {
    res.status(400).json({ error: "First and last name are required" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ firstName, lastName })
    .where(eq(usersTable.id, req.session.userId))
    .returning();

  res.json(serializeUser(user));
});

router.post("/auth/signup", async (req, res) => {
  const { email, password, firstName, lastName, inviteToken } = req.body as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    inviteToken?: string;
  };

  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "Email, password, first name, and last name are required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();

  if (!trimmedFirst || !trimmedLast) {
    res.status(400).json({ error: "First and last name are required" });
    return;
  }

  if (!EMAIL_RE.test(normalizedEmail)) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail));

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      passwordHash,
      firstName: trimmedFirst,
      lastName: trimmedLast,
    })
    .returning();

  try {
    await acceptPendingInvitesForUser(user.id, normalizedEmail, inviteToken);
  } catch (err) {
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid invitation",
    });
    return;
  }

  await createDefaultBoardForUser(user.id);

  req.session.userId = user.id;
  req.session.userEmail = user.email;
  res.status(201).json(serializeUser(user));
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizeEmail(email)));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await ensureDefaultBoardForUser(user.id);
  req.session.userId = user.id;
  req.session.userEmail = user.email;
  res.json(serializeUser(user));
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
