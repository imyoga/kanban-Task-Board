import { Router } from "express";
import { db, boardsTable, boardMembersTable, teamsTable, teamMembersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBoardAccess } from "../lib/boardAccess";
import { createDefaultBoardForUser, seedDefaultColumnsForBoard } from "../lib/boards";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function serializeBoard(board: typeof boardsTable.$inferSelect, userId: number) {
  const isOwner = board.ownerId === userId;
  return {
    id: board.id,
    name: board.name,
    isOwner,
    isShared: !isOwner,
    createdAt: board.createdAt.toISOString(),
  };
}

router.get("/boards", async (req, res) => {
  const userId = req.session.userId!;

  const owned = await db.select().from(boardsTable).where(eq(boardsTable.ownerId, userId));
  const memberRows = await db
    .select({ board: boardsTable })
    .from(boardMembersTable)
    .innerJoin(boardsTable, eq(boardMembersTable.boardId, boardsTable.id))
    .where(eq(boardMembersTable.userId, userId));

  const shared = memberRows.map((row) => row.board);
  const teamRows = await db
    .select({ board: boardsTable })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
    .innerJoin(boardsTable, eq(teamsTable.boardId, boardsTable.id))
    .where(eq(teamMembersTable.userId, userId));

  const teamBoards = teamRows.map((row) => row.board);
  const ownedIds = new Set(owned.map((b) => b.id));
  const uniqueShared = shared.filter((b) => !ownedIds.has(b.id));
  const uniqueTeam = teamBoards.filter((b) => !ownedIds.has(b.id) && !uniqueShared.some((s) => s.id === b.id));

  res.json([
    ...owned.map((b) => serializeBoard(b, userId)),
    ...uniqueShared.map((b) => serializeBoard(b, userId)),
    ...uniqueTeam.map((b) => serializeBoard(b, userId)),
  ]);
});

router.post("/boards", async (req, res) => {
  const userId = req.session.userId!;
  const name = typeof req.body?.name === "string" && req.body.name.trim()
    ? req.body.name.trim()
    : "Untitled board";

  const board = await createDefaultBoardForUser(userId, name);
  await seedDefaultColumnsForBoard(board.id, userId);
  res.status(201).json(serializeBoard(board, userId));
});

router.patch("/boards/:id", async (req, res) => {
  const boardId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getBoardAccess(boardId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [board] = await db
    .update(boardsTable)
    .set({ name })
    .where(eq(boardsTable.id, boardId))
    .returning();

  res.json(serializeBoard(board, userId));
});

router.delete("/boards/:id", async (req, res) => {
  const boardId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getBoardAccess(boardId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  await db.delete(boardsTable).where(eq(boardsTable.id, boardId));
  res.status(204).send();
});

router.get("/boards/:id/members", async (req, res) => {
  const boardId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getBoardAccess(boardId, userId);

  if (!access) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, access.board.ownerId));
  const members = await db
    .select({ user: usersTable })
    .from(boardMembersTable)
    .innerJoin(usersTable, eq(boardMembersTable.userId, usersTable.id))
    .where(eq(boardMembersTable.boardId, boardId));

  res.json([
  {
    userId: owner!.id,
    email: owner!.email,
    isOwner: true,
  },
  ...members.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    isOwner: false,
  })),
  ]);
});

router.post("/boards/:id/members", async (req, res) => {
  const boardId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getBoardAccess(boardId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const rawEmail = req.body?.email;
  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [memberUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!memberUser) {
    res.status(404).json({ error: "No user found with that email address" });
    return;
  }

  const memberUserId = memberUser.id;

  if (memberUserId === access.board.ownerId) {
    res.status(400).json({ error: "Owner already has access" });
    return;
  }

  const [existing] = await db
    .select()
    .from(boardMembersTable)
    .where(and(eq(boardMembersTable.boardId, boardId), eq(boardMembersTable.userId, memberUserId)));

  if (existing) {
    res.status(409).json({ error: "User already has access" });
    return;
  }

  await db.insert(boardMembersTable).values({ boardId, userId: memberUserId });
  res.status(201).json({ userId: memberUser.id, email: memberUser.email, isOwner: false });
});

router.delete("/boards/:id/members/:userId", async (req, res) => {
  const boardId = Number(req.params.id);
  const memberUserId = Number(req.params.userId);
  const userId = req.session.userId!;
  const access = await getBoardAccess(boardId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  if (memberUserId === access.board.ownerId) {
    res.status(400).json({ error: "Cannot remove board owner" });
    return;
  }

  const [removed] = await db
    .delete(boardMembersTable)
    .where(and(eq(boardMembersTable.boardId, boardId), eq(boardMembersTable.userId, memberUserId)))
    .returning();

  if (!removed) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.status(204).send();
});

export default router;
