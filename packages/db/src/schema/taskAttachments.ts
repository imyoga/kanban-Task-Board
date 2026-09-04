import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";
import { boardsTable } from "./boards";
import { usersTable } from "./users";

export const taskAttachmentsTable = pgTable("task_attachments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskAttachmentSchema = createInsertSchema(taskAttachmentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof taskAttachmentsTable.$inferSelect;
