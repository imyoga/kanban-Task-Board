import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, taskAttachmentsTable, tasksTable, usersTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { getBoardAccess } from "../lib/boardAccess";

const router = Router();

export function getMaxFileSizeMb(): number {
  const parsed = parseInt(process.env.MAX_FILE_SIZE_MB ?? "100", 10);
  return isNaN(parsed) || parsed <= 0 ? 100 : parsed;
}

export function getMaxFileSizeBytes(): number {
  return getMaxFileSizeMb() * 1024 * 1024;
}

function getUploadDir(): string {
  const dir = process.env.ATTACHMENTS_DIR
    ? path.resolve(process.env.ATTACHMENTS_DIR)
    : path.resolve(process.cwd(), "uploads", "attachments");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const rawExt = path.extname(file.originalname);
    const sanitizedExt = rawExt.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 16);
    cb(null, `${Date.now()}-${uniqueId}${sanitizedExt}`);
  },
});

function createUploadMiddleware() {
  const upload = multer({
    storage,
    limits: {
      fileSize: getMaxFileSizeBytes(),
    },
  }).single("file");

  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({
              error: `File size exceeds the maximum limit of ${getMaxFileSizeMb()}MB`,
            });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        res.status(400).json({ error: err.message || "Failed to parse file upload" });
        return;
      }
      next();
    });
  };
}

function decodeOriginalName(name: string): string {
  try {
    return Buffer.from(name, "latin1").toString("utf8");
  } catch {
    return name;
  }
}

// 1. Get attachment upload limits/configuration
router.get("/tasks/attachments/config", (_req: Request, res: Response) => {
  res.json({
    maxFileSizeMb: getMaxFileSizeMb(),
    maxFileSizeBytes: getMaxFileSizeBytes(),
  });
});

// 2. List attachments for a task
router.get("/tasks/:id/attachments", async (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  if (!taskId || isNaN(taskId)) {
    res.status(400).json({ error: "Invalid task id" });
    return;
  }

  const userId = req.session.userId!;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const attachments = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.taskId, taskId))
    .orderBy(desc(taskAttachmentsTable.createdAt));

  const uploaderIds = [
    ...new Set(attachments.map((a) => a.userId).filter((id): id is number => id != null)),
  ];
  const uploaderMap = new Map<number, string>();
  if (uploaderIds.length > 0) {
    const uploaders = await db
      .select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(inArray(usersTable.id, uploaderIds));
    for (const u of uploaders) {
      const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      uploaderMap.set(u.id, name || "User");
    }
  }

  res.json(
    attachments.map((att) => ({
      id: att.id,
      taskId: att.taskId,
      boardId: att.boardId,
      userId: att.userId,
      uploaderName: uploaderMap.get(att.userId) || "User",
      originalName: att.originalName,
      mimeType: att.mimeType,
      size: att.size,
      createdAt: att.createdAt.toISOString(),
    })),
  );
});

// 3. Upload attachment for a task
router.post(
  "/tasks/:id/attachments",
  createUploadMiddleware(),
  async (req: Request, res: Response) => {
    const taskId = Number(req.params.id);
    if (!taskId || isNaN(taskId)) {
      if (req.file) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(400).json({ error: "Invalid task id" });
      return;
    }

    const userId = req.session.userId!;
    const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
    if (!task) {
      if (req.file) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const access = await getBoardAccess(task.boardId, userId);
    if (!access || !access.canEdit) {
      if (req.file) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const originalName = decodeOriginalName(req.file.originalname);
    const mimeType = req.file.mimetype || "application/octet-stream";
    const size = req.file.size;
    const filename = req.file.filename;

    const [attachment] = await db
      .insert(taskAttachmentsTable)
      .values({
        taskId,
        boardId: task.boardId,
        userId,
        filename,
        originalName,
        mimeType,
        size,
      })
      .returning();

    const [user] = await db
      .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
      .from(usersTable)
      .where(eq(usersTable.id, userId));
    const uploaderName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim() : "User";

    res.status(201).json({
      id: attachment.id,
      taskId: attachment.taskId,
      boardId: attachment.boardId,
      userId: attachment.userId,
      uploaderName: uploaderName || "User",
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt.toISOString(),
    });
  },
);

// 4. Delete attachment
router.delete("/tasks/:id/attachments/:attachmentId", async (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  if (!taskId || !attachmentId || isNaN(taskId) || isNaN(attachmentId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access || !access.canEdit) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Board not found" });
    return;
  }

  const [attachment] = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.id, attachmentId));

  if (!attachment || attachment.taskId !== taskId) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  // Delete from database
  await db.delete(taskAttachmentsTable).where(eq(taskAttachmentsTable.id, attachmentId));

  // Delete from disk
  const filePath = path.join(getUploadDir(), attachment.filename);
  fs.promises.unlink(filePath).catch(() => {});

  res.status(204).send();
});

// 5. Download attachment
router.get("/tasks/:id/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  const taskId = Number(req.params.id);
  const attachmentId = Number(req.params.attachmentId);
  if (!taskId || !attachmentId || isNaN(taskId) || isNaN(attachmentId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const userId = req.session.userId!;
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const access = await getBoardAccess(task.boardId, userId);
  if (!access) {
    res.status(404).json({ error: "Board not found" });
    return;
  }

  const [attachment] = await db
    .select()
    .from(taskAttachmentsTable)
    .where(eq(taskAttachmentsTable.id, attachmentId));

  if (!attachment || attachment.taskId !== taskId) {
    res.status(404).json({ error: "Attachment not found" });
    return;
  }

  const filePath = path.join(getUploadDir(), attachment.filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found on server" });
    return;
  }

  res.download(filePath, attachment.originalName);
});

export default router;
