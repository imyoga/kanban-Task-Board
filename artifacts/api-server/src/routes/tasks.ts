import { Router } from "express";
import { db, tasksTable, columnsTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { getBoardAccess } from "../lib/boardAccess";

const router = Router();

function serializeTask(t: typeof tasksTable.$inferSelect) {
  return {
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

router.get("/tasks/stats", async (req, res) => {
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

  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.boardId, boardId));
  const columns = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.boardId, boardId))
    .orderBy(asc(columnsTable.position));

  const now = new Date();
  const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;

  const byColumn = columns.map((col) => ({
    columnId: col.id,
    columnTitle: col.title,
    count: tasks.filter((t) => t.columnId === col.id).length,
  }));

  const byPriority = {
    low: tasks.filter((t) => t.priority === "low").length,
    medium: tasks.filter((t) => t.priority === "medium").length,
    high: tasks.filter((t) => t.priority === "high").length,
  };

  res.json({ total: tasks.length, overdue, byColumn, byPriority });
});

router.get("/tasks", async (req, res) => {
  const parsed = ListTasksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const { boardId, columnId } = parsed.data;

  if (!boardId) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const access = await getBoardAccess(boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  let query = db.select().from(tasksTable).$dynamic();
  if (columnId !== undefined) {
    query = query.where(and(eq(tasksTable.boardId, boardId), eq(tasksTable.columnId, columnId)));
  } else {
    query = query.where(eq(tasksTable.boardId, boardId));
  }

  const tasks = await query.orderBy(asc(tasksTable.position));
  res.json(tasks.map(serializeTask));
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const { title, description, columnId, priority, position, dueDate, boardId } = parsed.data;

  if (!boardId) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const access = await getBoardAccess(boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const [column] = await db
    .select()
    .from(columnsTable)
    .where(and(eq(columnsTable.id, columnId), eq(columnsTable.boardId, boardId)));

  if (!column) {
    res.status(400).json({ error: "Invalid column for board" });
    return;
  }

  const existing = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.boardId, boardId), eq(tasksTable.columnId, columnId)));
  const pos = position ?? existing.length;

  const [task] = await db
    .insert(tasksTable)
    .values({
      boardId,
      userId,
      title,
      description: description ?? null,
      columnId,
      priority: priority ?? "medium",
      position: pos,
      dueDate: dueDate ?? null,
    })
    .returning();

  res.status(201).json(serializeTask(task));
});

router.get("/tasks/:id", async (req, res) => {
  const parsed = GetTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, parsed.data.id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(serializeTask(task));
});

router.patch("/tasks/:id", async (req, res) => {
  const paramsParsed = UpdateTaskParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const bodyParsed = UpdateTaskBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, paramsParsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(existing.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Task not found" });
    return;
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const body = bodyParsed.data;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.columnId !== undefined) updates.columnId = body.columnId;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.position !== undefined) updates.position = body.position;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate;

  if (body.columnId !== undefined) {
    const [column] = await db
      .select()
      .from(columnsTable)
      .where(and(eq(columnsTable.id, body.columnId), eq(columnsTable.boardId, existing.boardId)));

    if (!column) {
      res.status(400).json({ error: "Invalid column for board" });
      return;
    }
  }

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, paramsParsed.data.id))
    .returning();

  res.json(serializeTask(task));
});

router.delete("/tasks/:id", async (req, res) => {
  const parsed = DeleteTaskParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const [existing] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, parsed.data.id));

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(existing.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Task not found" });
    return;
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, parsed.data.id));
  res.status(204).send();
});

export default router;
