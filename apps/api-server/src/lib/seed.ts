import bcrypt from "bcryptjs";
import pg from "pg";
import { db, usersTable, boardsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { createDefaultBoardForUser, migrateUsersToBoards } from "./boards";
import { ensureSchema } from "./ensureSchema";
import { backfillUserNames } from "./backfillUsers";

const TEST_EMAIL = "moradiyayogeshg@gmail.com";
const TEST_PASSWORD = "Yogesh123";

async function ensureSessionTable() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`);
  } finally {
    await client.end();
  }
}

export async function seedIfNeeded() {
  await ensureSchema();
  await ensureSessionTable();
  await migrateUsersToBoards();
  await backfillUserNames();

  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, TEST_EMAIL));

  if (!user) {
    logger.info("Seeding test user...");
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    [user] = await db
      .insert(usersTable)
      .values({
        email: TEST_EMAIL,
        passwordHash,
        firstName: "Yogesh",
        lastName: "Moradiya",
      })
      .returning();
    logger.info({ userId: user.id }, "Test user created");
  }

  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.ownerId, user.id))
    .limit(1);

  if (!board) {
    logger.info("Seeding default board for test user...");
    await createDefaultBoardForUser(user.id);
    logger.info("Default board created");
  }
}
