import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const boardsTable = pgTable("boards", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  key: text("key").notNull().default("BOARD"),
  allowLinkPreview: boolean("allow_link_preview").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Board = typeof boardsTable.$inferSelect;
