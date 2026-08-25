import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, boardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createDefaultBoardForUser } from "../lib/boards";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
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

router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ id: req.session.userId, email: req.session.userEmail });
});

router.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = normalizeEmail(email);

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
    .values({ email: normalizedEmail, passwordHash })
    .returning();

  await createDefaultBoardForUser(user.id);

  req.session.userId = user.id;
  req.session.userEmail = user.email;
  res.status(201).json({ id: user.id, email: user.email });
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
  res.json({ id: user.id, email: user.email });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
