import { Router } from "express";
import {
  db,
  tasksTable,
  columnsTable,
  usersTable,
  teamMembersTable,
  boardsTable,
  taskActivitiesTable,
} from "@workspace/db";
import { eq, asc, desc, and, inArray, sql } from "drizzle-orm";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  GetTaskParams,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  ListTaskActivitiesParams,
} from "@workspace/api-zod";
import { getBoardAccess, getTeamForBoard } from "../lib/boardAccess";
import { applyTaskMove } from "../lib/taskOrder";
import { broadcastBoardEvent } from "../lib/boardEvents";
import { recordTaskActivity } from "../lib/taskActivity";

const router = Router();

type UserRow = typeof usersTable.$inferSelect;

function serializeAssignee(user: UserRow | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

function serializeUser(user: UserRow | null | undefined) {
  return {
    id: user?.id ?? 0,
    email: user?.email ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  };
}

function serializeTask(
  t: typeof tasksTable.$inferSelect,
  assignee?: UserRow | null,
  boardKey = "BOARD",
) {
  const taskNumber = t.taskNumber ?? t.id;
  const taskKey = `${boardKey}-${taskNumber}`;
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    columnId: t.columnId,
    priority: t.priority,
    position: t.position,
    dueDate: t.dueDate,
    assigneeId: t.assigneeId,
    assignee: serializeAssignee(assignee),
    taskNumber,
    taskKey,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

async function loadAssignees(assigneeIds: number[]) {
  if (assigneeIds.length === 0) return new Map<number, UserRow>();
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, assigneeIds));
  return new Map(users.map((u) => [u.id, u]));
}

async function validateAssignee(boardId: number, assigneeId: number | null | undefined) {
  if (assigneeId == null) return { ok: true };

  const team = await getTeamForBoard(boardId);
  if (!team) {
    return { ok: false, error: "This board has no linked team" };
  }

  const [member] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, team.id), eq(teamMembersTable.userId, assigneeId)));

  if (!member) {
    return { ok: false, error: "Assignee must be a member of the linked team" };
  }

  return { ok: true };
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

  const tasks = await query.orderBy(asc(tasksTable.position), asc(tasksTable.id));
  const assigneeMap = await loadAssignees(
    tasks.map((t) => t.assigneeId).filter((id): id is number => id != null),
  );

  const [board] = await db
    .select({ key: boardsTable.key })
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId));
  const boardKey = board?.key || "BOARD";

  res.json(
    tasks.map((t) => serializeTask(t, t.assigneeId ? assigneeMap.get(t.assigneeId) : null, boardKey)),
  );
});

router.post("/tasks", async (req, res) => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.session.userId!;
  const { title, description, columnId, priority, position, dueDate, boardId, assigneeId } =
    parsed.data;

  if (!boardId) {
    res.status(400).json({ error: "boardId is required" });
    return;
  }

  const access = await getBoardAccess(boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const assigneeCheck = await validateAssignee(boardId, assigneeId);
  if (!assigneeCheck.ok) {
    res.status(400).json({ error: assigneeCheck.error });
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

  const [maxTask] = await db
    .select({ maxNum: sql<number>`COALESCE(MAX(${tasksTable.taskNumber}), 0)` })
    .from(tasksTable)
    .where(eq(tasksTable.boardId, boardId));
  const nextNumber = Number(maxTask?.maxNum ?? 0) + 1;

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
      assigneeId: assigneeId ?? null,
      taskNumber: nextNumber,
    })
    .returning();

  let assignee: UserRow | null = null;
  if (task.assigneeId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId));
    assignee = u ?? null;
  }

  const [board] = await db
    .select({ key: boardsTable.key })
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId));
  const boardKey = board?.key || "BOARD";

  broadcastBoardEvent(boardId, {
    type: "tasks:changed",
    actorId: userId,
    action: "create",
    taskId: task.id,
    columnId: task.columnId,
  });

  await recordTaskActivity({
    taskId: task.id,
    boardId,
    userId,
    action: "task_created",
    message: "Created this task",
  });

  res.status(201).json(serializeTask(task, assignee, boardKey));
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

  let assignee: UserRow | null = null;
  if (task.assigneeId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId));
    assignee = u ?? null;
  }

  const [board] = await db
    .select({ key: boardsTable.key })
    .from(boardsTable)
    .where(eq(boardsTable.id, task.boardId));
  const boardKey = board?.key || "BOARD";

  res.json(serializeTask(task, assignee, boardKey));
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
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.dueDate !== undefined) updates.dueDate = body.dueDate;

  if (body.assigneeId !== undefined) {
    const assigneeCheck = await validateAssignee(
      existing.boardId,
      body.assigneeId === null ? null : body.assigneeId,
    );
    if (!assigneeCheck.ok) {
      res.status(400).json({ error: assigneeCheck.error });
      return;
    }
    updates.assigneeId = body.assigneeId;
  }

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

  // Check differences to record activities
  if (body.title !== undefined && body.title !== existing.title) {
    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_updated",
      field: "title",
      oldValue: existing.title,
      newValue: body.title,
      message: `Changed title from "${existing.title}" to "${body.title}"`,
    });
  }

  if (body.description !== undefined && (body.description ?? "") !== (existing.description ?? "")) {
    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_updated",
      field: "description",
      message: "Updated task description",
    });
  }

  if (body.priority !== undefined && body.priority !== existing.priority) {
    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_updated",
      field: "priority",
      oldValue: existing.priority,
      newValue: body.priority,
      message: `Changed priority from ${existing.priority} to ${body.priority}`,
    });
  }

  if (body.dueDate !== undefined && (body.dueDate ?? null) !== (existing.dueDate ?? null)) {
    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_updated",
      field: "dueDate",
      oldValue: existing.dueDate ?? null,
      newValue: body.dueDate ?? null,
      message: body.dueDate ? `Set due date to ${body.dueDate}` : "Removed due date",
    });
  }

  if (body.assigneeId !== undefined && (body.assigneeId ?? null) !== (existing.assigneeId ?? null)) {
    let oldName: string | null = null;
    let newName: string | null = null;

    if (existing.assigneeId) {
      const [oldU] = await db.select().from(usersTable).where(eq(usersTable.id, existing.assigneeId));
      if (oldU) oldName = `${oldU.firstName} ${oldU.lastName}`.trim() || oldU.email;
    }
    if (body.assigneeId) {
      const [newU] = await db.select().from(usersTable).where(eq(usersTable.id, body.assigneeId));
      if (newU) newName = `${newU.firstName} ${newU.lastName}`.trim() || newU.email;
    }

    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_updated",
      field: "assignee",
      oldValue: oldName,
      newValue: newName,
      message: newName ? `Assigned task to ${newName}` : "Unassigned this task",
    });
  }

  if (body.columnId !== undefined && body.columnId !== existing.columnId) {
    const [oldCol] = await db.select().from(columnsTable).where(eq(columnsTable.id, existing.columnId));
    const [newCol] = await db.select().from(columnsTable).where(eq(columnsTable.id, body.columnId));
    const oldTitle = oldCol?.title || `Column ${existing.columnId}`;
    const newTitle = newCol?.title || `Column ${body.columnId}`;

    await recordTaskActivity({
      taskId: existing.id,
      boardId: existing.boardId,
      userId,
      action: "task_moved",
      field: "column",
      oldValue: oldTitle,
      newValue: newTitle,
      message: `Moved from "${oldTitle}" to "${newTitle}"`,
    });
  }

  // Apply metadata updates first (title, description, priority, dueDate, assigneeId)
  if (Object.keys(updates).length > 1) { // more than just updatedAt
    await db
      .update(tasksTable)
      .set(updates)
      .where(eq(tasksTable.id, paramsParsed.data.id));
  }

  // If column or position changed, perform reordering across affected columns
  if (body.columnId !== undefined || body.position !== undefined) {
    const newColumnId = body.columnId ?? existing.columnId;
    const newPosition = body.position ?? existing.position;

    try {
      await applyTaskMove(existing.id, existing.columnId, newColumnId, newPosition);
    } catch {
      res.status(404).json({ error: "Task not found" });
      return;
    }
  }

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, paramsParsed.data.id));
  let assignee: UserRow | null = null;
  if (task.assigneeId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, task.assigneeId));
    assignee = u ?? null;
  }

  broadcastBoardEvent(existing.boardId, {
    type: "tasks:changed",
    actorId: userId,
    action: (body.columnId !== undefined || body.position !== undefined) ? "move" : "update",
    taskId: task.id,
    columnId: task.columnId,
  });

  const [board] = await db
    .select({ key: boardsTable.key })
    .from(boardsTable)
    .where(eq(boardsTable.id, existing.boardId));
  const boardKey = board?.key || "BOARD";

  res.json(serializeTask(task, assignee, boardKey));
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

  broadcastBoardEvent(existing.boardId, {
    type: "tasks:changed",
    actorId: userId,
    action: "delete",
    taskId: existing.id,
    columnId: existing.columnId,
  });

  res.status(204).send();
});

// GET /tasks/:id/activities
router.get("/tasks/:id/activities", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const parsed = ListTaskActivitiesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const taskId = parsed.data.id;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const activities = await db
    .select()
    .from(taskActivitiesTable)
    .where(eq(taskActivitiesTable.taskId, taskId))
    .orderBy(desc(taskActivitiesTable.createdAt));

  const userIds = [...new Set(activities.map((a) => a.userId))];
  const users = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  res.json(
    activities.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      boardId: a.boardId,
      userId: a.userId,
      user: serializeUser(userMap.get(a.userId)),
      action: a.action,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
    }))
  );
});

export default router;
