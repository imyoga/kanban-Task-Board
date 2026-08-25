import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { boardsTable } from "./boards";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  boardId: integer("board_id")
    .references(() => boardsTable.id, { onDelete: "set null" })
    .unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Team = typeof teamsTable.$inferSelect;
