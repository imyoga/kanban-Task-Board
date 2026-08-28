import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { boardsTable } from "./boards";
import { usersTable } from "./users";

export const boardMembersTable = pgTable(
  "board_members",
  {
    boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.boardId, table.userId] })],
);

export type BoardMember = typeof boardMembersTable.$inferSelect;
