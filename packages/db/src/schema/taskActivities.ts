import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";
import { boardsTable } from "./boards";
import { usersTable } from "./users";

export const taskActivitiesTable = pgTable("task_activities", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => tasksTable.id, { onDelete: "cascade" }),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  field: text("field"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTaskActivitySchema = createInsertSchema(taskActivitiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type TaskActivity = typeof taskActivitiesTable.$inferSelect;
