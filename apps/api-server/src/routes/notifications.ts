import { Router } from "express";
import {
  db,
  notificationsTable,
  usersTable,
  boardsTable,
  tasksTable,
} from "@workspace/db";
import { eq, desc, and, inArray, count } from "drizzle-orm";
import {
  ListNotificationsQueryParams,
  UpdateNotificationReadStatusParams,
  UpdateNotificationReadStatusBody,
} from "@workspace/api-zod";

const router = Router();

type UserRow = typeof usersTable.$inferSelect;
type BoardRow = typeof boardsTable.$inferSelect;
type TaskRow = typeof tasksTable.$inferSelect;

function serializeActor(user: UserRow | null | undefined) {
  return {
    id: user?.id ?? 0,
    email: user?.email ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  };
}

function serializeNotification(
  n: typeof notificationsTable.$inferSelect,
  actor?: UserRow | null,
  board?: BoardRow | null,
  task?: TaskRow | null,
) {
  const boardKey = board?.key || "BOARD";
  const taskNumber = task?.taskNumber ?? task?.id ?? n.taskId;
  const taskKey = `${boardKey}-${taskNumber}`;

  return {
    id: n.id,
    userId: n.userId,
    actorId: n.actorId,
    actor: serializeActor(actor),
    boardId: n.boardId,
    boardName: board?.name || "Board",
    taskId: n.taskId,
    taskKey,
    taskTitle: task?.title || "Task",
    commentId: n.commentId ?? null,
    type: n.type,
    title: n.title,
    content: n.content,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

// GET /notifications
router.get("/notifications", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const userId = req.session.userId!;

  const queryParsed = ListNotificationsQueryParams.safeParse(req.query);
  const unreadOnly = queryParsed.success && queryParsed.data.unreadOnly === true;

  const conditions = [eq(notificationsTable.userId, userId)];
  if (unreadOnly) {
    conditions.push(eq(notificationsTable.isRead, false));
  }

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(100);

  if (notifications.length === 0) {
    res.json([]);
    return;
  }

  const actorIds = [...new Set(notifications.map((n) => n.actorId))];
  const boardIds = [...new Set(notifications.map((n) => n.boardId))];
  const taskIds = [...new Set(notifications.map((n) => n.taskId))];

  const [actors, boards, tasks] = await Promise.all([
    actorIds.length > 0
      ? db.select().from(usersTable).where(inArray(usersTable.id, actorIds))
      : [],
    boardIds.length > 0
      ? db.select().from(boardsTable).where(inArray(boardsTable.id, boardIds))
      : [],
    taskIds.length > 0
      ? db.select().from(tasksTable).where(inArray(tasksTable.id, taskIds))
      : [],
  ]);

  const actorMap = new Map(actors.map((u) => [u.id, u]));
  const boardMap = new Map(boards.map((b) => [b.id, b]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  res.json(
    notifications.map((n) =>
      serializeNotification(
        n,
        actorMap.get(n.actorId),
        boardMap.get(n.boardId),
        taskMap.get(n.taskId),
      ),
    ),
  );
});

// GET /notifications/unread-count
router.get("/notifications/unread-count", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const userId = req.session.userId!;

  const [result] = await db
    .select({ count: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false),
      ),
    );

  res.json({ count: Number(result?.count ?? 0) });
});

// POST /notifications/read-all
router.post("/notifications/read-all", async (req, res) => {
  const userId = req.session.userId!;

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.userId, userId),
        eq(notificationsTable.isRead, false),
      ),
    );

  res.json({ success: true });
});

// PATCH /notifications/:id/read
router.patch("/notifications/:id/read", async (req, res) => {
  const paramsParsed = UpdateNotificationReadStatusParams.safeParse({
    id: Number(req.params.id),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid notification id" });
    return;
  }

  const userId = req.session.userId!;
  const notificationId = paramsParsed.data.id;

  const [existing] = await db
    .select()
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.id, notificationId),
        eq(notificationsTable.userId, userId),
      ),
    );

  if (!existing) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  const bodyParsed = UpdateNotificationReadStatusBody.safeParse(req.body ?? {});
  const isRead = bodyParsed.success && bodyParsed.data.isRead !== undefined
    ? bodyParsed.data.isRead
    : true;

  const [updated] = await db
    .update(notificationsTable)
    .set({ isRead })
    .where(eq(notificationsTable.id, notificationId))
    .returning();

  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, updated.actorId));
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, updated.boardId));
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, updated.taskId));

  res.json(serializeNotification(updated, actor, board, task));
});

export default router;
