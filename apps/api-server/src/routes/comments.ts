import { Router } from "express";
import { db, taskCommentsTable, tasksTable, usersTable } from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";
import {
  ListTaskCommentsParams,
  CreateTaskCommentParams,
  CreateTaskCommentBody,
  UpdateTaskCommentParams,
  UpdateTaskCommentBody,
  DeleteTaskCommentParams,
} from "@workspace/api-zod";
import { getBoardAccess } from "../lib/boardAccess";
import { recordTaskActivity } from "../lib/taskActivity";

const router = Router();

type UserRow = typeof usersTable.$inferSelect;

function serializeAuthor(user: UserRow | null | undefined) {
  return {
    id: user?.id ?? 0,
    email: user?.email ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
  };
}

function serializeComment(
  c: typeof taskCommentsTable.$inferSelect,
  author?: UserRow | null,
) {
  return {
    id: c.id,
    taskId: c.taskId,
    boardId: c.boardId,
    userId: c.userId,
    author: serializeAuthor(author),
    content: c.content,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

// GET /tasks/:id/comments
router.get("/tasks/:id/comments", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  const paramsParsed = ListTaskCommentsParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const userId = req.session.userId!;
  const taskId = paramsParsed.data.id;

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

  const comments = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.taskId, taskId))
    .orderBy(asc(taskCommentsTable.createdAt));

  const userIds = [...new Set(comments.map((c) => c.userId))];
  const authors = userIds.length > 0
    ? await db.select().from(usersTable).where(inArray(usersTable.id, userIds))
    : [];
  const authorMap = new Map(authors.map((u) => [u.id, u]));

  res.json(comments.map((c) => serializeComment(c, authorMap.get(c.userId))));
});

// POST /tasks/:id/comments
router.post("/tasks/:id/comments", async (req, res) => {
  const paramsParsed = CreateTaskCommentParams.safeParse({ id: Number(req.params.id) });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const bodyParsed = CreateTaskCommentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const content = bodyParsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Comment content cannot be empty" });
    return;
  }

  const userId = req.session.userId!;
  const taskId = paramsParsed.data.id;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Task not found" });
    return;
  }

  const [created] = await db
    .insert(taskCommentsTable)
    .values({
      taskId,
      boardId: task.boardId,
      userId,
      content,
    })
    .returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  await recordTaskActivity({
    taskId,
    boardId: task.boardId,
    userId,
    action: "comment_added",
    field: "comment",
    newValue: content.slice(0, 100),
    message: "Added a comment",
  });

  res.status(201).json(serializeComment(created, author));
});

// PATCH /tasks/:id/comments/:commentId
router.patch("/tasks/:id/comments/:commentId", async (req, res) => {
  const paramsParsed = UpdateTaskCommentParams.safeParse({
    id: Number(req.params.id),
    commentId: Number(req.params.commentId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const bodyParsed = UpdateTaskCommentBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const content = bodyParsed.data.content.trim();
  if (!content) {
    res.status(400).json({ error: "Comment content cannot be empty" });
    return;
  }

  const userId = req.session.userId!;
  const { id: taskId, commentId } = paramsParsed.data;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Task not found" });
    return;
  }

  const [comment] = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId));

  if (!comment || comment.taskId !== taskId) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  // Only author or board owner can edit comment
  if (comment.userId !== userId && !access.isOwner) {
    res.status(403).json({ error: "You cannot edit someone else's comment" });
    return;
  }

  const [updated] = await db
    .update(taskCommentsTable)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(eq(taskCommentsTable.id, commentId))
    .returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, comment.userId));

  await recordTaskActivity({
    taskId,
    boardId: task.boardId,
    userId,
    action: "comment_edited",
    field: "comment",
    newValue: content.slice(0, 100),
    message: "Edited a comment",
  });

  res.json(serializeComment(updated, author));
});

// DELETE /tasks/:id/comments/:commentId
router.delete("/tasks/:id/comments/:commentId", async (req, res) => {
  const paramsParsed = DeleteTaskCommentParams.safeParse({
    id: Number(req.params.id),
    commentId: Number(req.params.commentId),
  });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const userId = req.session.userId!;
  const { id: taskId, commentId } = paramsParsed.data;

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Task not found" });
    return;
  }

  const [comment] = await db
    .select()
    .from(taskCommentsTable)
    .where(eq(taskCommentsTable.id, commentId));

  if (!comment || comment.taskId !== taskId) {
    res.status(404).json({ error: "Comment not found" });
    return;
  }

  // Only author or board owner can delete comment
  if (comment.userId !== userId && !access.isOwner) {
    res.status(403).json({ error: "You cannot delete someone else's comment" });
    return;
  }

  await db.delete(taskCommentsTable).where(eq(taskCommentsTable.id, commentId));

  await recordTaskActivity({
    taskId,
    boardId: task.boardId,
    userId,
    action: "comment_deleted",
    field: "comment",
    message: "Deleted a comment",
  });

  res.status(204).send();
});

export default router;
