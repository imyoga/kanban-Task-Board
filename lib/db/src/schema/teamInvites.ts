import { pgTable, serial, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const teamInvitesTable = pgTable(
  "team_invites",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => teamsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("team_invites_team_email_idx").on(table.teamId, table.email)],
);

export type TeamInvite = typeof teamInvitesTable.$inferSelect;
