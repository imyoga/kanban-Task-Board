import { Router } from "express";
import { db, columnsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import {
  CreateColumnBody,
  UpdateColumnParams,
  UpdateColumnBody,
  DeleteColumnParams,
} from "@workspace/api-zod";
import { getBoardAccess } from "../lib/boardAccess";
import { normalizeDefaultColumnsForBoard, seedDefaultColumnsForBoard } from "../lib/boards";
import { broadcastBoardEvent } from "../lib/boardEvents";

const router = Router();

router.get("/columns", async (req, res) => {
  const userId = req.session.userId!;
  const boardId = Number(req.query.boardId);

  if (!boardId) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const access = await getBoardAccess(boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  await seedDefaultColumnsForBoard(boardId, access.board.ownerId);
  await normalizeDefaultColumnsForBoard(boardId);

  const columns = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.boardId, boardId))
    .orderBy(asc(columnsTable.position));

  res.json(columns.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/columns", async (req, res) => {
  const parsed = CreateColumnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const { title, color, position, boardId } = parsed.data;

  if (!boardId) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const access = await getBoardAccess(boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const existing = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.boardId, boardId));
  const pos = position ?? existing.length;

  const [col] = await db
    .insert(columnsTable)
    .values({ boardId, userId, title, color, position: pos })
    .returning();

  broadcastBoardEvent(boardId, {
    type: "columns:changed",
    actorId: userId,
    action: "create",
    columnId: col.id,
  });

  res.status(201).json({ ...col, createdAt: col.createdAt.toISOString() });
});

router.patch("/columns/:id", async (req, res) => {
  const paramsParsed = UpdateColumnParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateColumnBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const [existing] = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.id, paramsParsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Column not found" });
    return;
  }

  const access = await getBoardAccess(existing.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (bodyParsed.data.title !== undefined) updates.title = bodyParsed.data.title;
  if (bodyParsed.data.color !== undefined) updates.color = bodyParsed.data.color;
  if (bodyParsed.data.position !== undefined) updates.position = bodyParsed.data.position;

  const [col] = await db
    .update(columnsTable)
    .set(updates)
    .where(eq(columnsTable.id, paramsParsed.data.id))
    .returning();

  broadcastBoardEvent(existing.boardId, {
    type: "columns:changed",
    actorId: userId,
    action: bodyParsed.data.position !== undefined ? "move" : "update",
    columnId: col.id,
  });

  res.json({ ...col, createdAt: col.createdAt.toISOString() });
});

router.delete("/columns/:id", async (req, res) => {
  const parsed = DeleteColumnParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const [existing] = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.id, parsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Column not found" });
    return;
  }

  const access = await getBoardAccess(existing.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  await db.delete(columnsTable).where(eq(columnsTable.id, parsed.data.id));

  broadcastBoardEvent(existing.boardId, {
    type: "columns:changed",
    actorId: userId,
    action: "delete",
    columnId: existing.id,
  });

  res.status(204).send();
});

export default router;
