import { Router } from "express";
import { db, boardsTable, boardMembersTable, teamsTable, teamMembersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getBoardAccess } from "../lib/boardAccess";
import { createDefaultBoardForUser, seedDefaultColumnsForBoard } from "../lib/boards";
import { broadcastBoardEvent } from "../lib/boardEvents";

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
    key: board.key || "BOARD",
    allowLinkPreview: Boolean(board.allowLinkPreview),
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
  const customKey = typeof req.body?.key === "string" ? req.body.key.trim() : undefined;

  const board = await createDefaultBoardForUser(userId, name, customKey);
  if (typeof req.body?.allowLinkPreview === "boolean") {
    await db.update(boardsTable).set({ allowLinkPreview: req.body.allowLinkPreview }).where(eq(boardsTable.id, board.id));
    board.allowLinkPreview = req.body.allowLinkPreview;
  }
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

  const updates: Record<string, unknown> = {};
  if (typeof req.body?.name === "string" && req.body.name.trim()) {
    updates.name = req.body.name.trim();
  }
  if (typeof req.body?.key === "string" && req.body.key.trim()) {
    const cleanKey = req.body.key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 10);
    if (cleanKey.length >= 2) {
      updates.key = cleanKey;
    }
  }
  if (typeof req.body?.allowLinkPreview === "boolean") {
    updates.allowLinkPreview = req.body.allowLinkPreview;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [board] = await db
    .update(boardsTable)
    .set(updates)
    .where(eq(boardsTable.id, boardId))
    .returning();

  broadcastBoardEvent(boardId, {
    type: "board:updated",
    actorId: userId,
    action: "update",
  });

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

  broadcastBoardEvent(boardId, {
    type: "board:deleted",
    actorId: userId,
    action: "delete",
  });

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

  const memberMap = new Map<
    number,
    { userId: number; email: string; firstName: string; lastName: string; isOwner: boolean }
  >();

  // 1. Board owner
  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, access.board.ownerId));
  if (owner) {
    memberMap.set(owner.id, {
      userId: owner.id,
      email: owner.email,
      firstName: owner.firstName,
      lastName: owner.lastName,
      isOwner: true,
    });
  }

  // 2. Direct board members
  const directMembers = await db
    .select({ user: usersTable })
    .from(boardMembersTable)
    .innerJoin(usersTable, eq(boardMembersTable.userId, usersTable.id))
    .where(eq(boardMembersTable.boardId, boardId));

  for (const m of directMembers) {
    if (!memberMap.has(m.user.id)) {
      memberMap.set(m.user.id, {
        userId: m.user.id,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        isOwner: false,
      });
    }
  }

  // 3. Linked team members
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.boardId, boardId));
  if (team) {
    const teamMembers = await db
      .select({ user: usersTable })
      .from(teamMembersTable)
      .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
      .where(eq(teamMembersTable.teamId, team.id));

    for (const tm of teamMembers) {
      if (!memberMap.has(tm.user.id)) {
        memberMap.set(tm.user.id, {
          userId: tm.user.id,
          email: tm.user.email,
          firstName: tm.user.firstName,
          lastName: tm.user.lastName,
          isOwner: tm.user.id === access.board.ownerId,
        });
      }
    }
  }

  res.json(Array.from(memberMap.values()));
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
  broadcastBoardEvent(boardId, {
    type: "members:changed",
    actorId: userId,
    action: "create",
  });
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

  broadcastBoardEvent(boardId, {
    type: "members:changed",
    actorId: userId,
    action: "delete",
  });

  res.status(204).send();
});

export default router;
