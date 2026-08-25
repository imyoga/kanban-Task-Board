import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { boardsTable } from "./boards";
import { usersTable } from "./users";

export const columnsTable = pgTable("columns", {
  id: serial("id").primaryKey(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  color: text("color"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertColumnSchema = createInsertSchema(columnsTable).omit({ id: true, createdAt: true });
export type InsertColumn = z.infer<typeof insertColumnSchema>;
export type Column = typeof columnsTable.$inferSelect;
