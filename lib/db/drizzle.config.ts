import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Copy .env.example to .env and set your Postgres connection string.",
  );
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Ignore express-session's `session` table so push does not prompt to rename it.
  tablesFilter: [
    "users",
    "boards",
    "board_members",
    "columns",
    "tasks",
    "teams",
    "team_members",
    "team_invites",
  ],
});
