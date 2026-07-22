import bcrypt from "bcryptjs";
import pg from "pg";
import { db, usersTable, columnsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { logger } from "./logger";

const TEST_EMAIL = "moradiyayogeshg@gmail.com";
const TEST_PASSWORD = "Yogesh123";

const DEFAULT_COLUMNS = [
  { title: "To Do", color: "#6366f1", position: 0 },
  { title: "In Progress", color: "#f59e0b", position: 1 },
  { title: "Done", color: "#10b981", position: 2 },
];

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
  await ensureSessionTable();
  // Ensure test user exists
  let [user] = await db.select().from(usersTable).where(eq(usersTable.email, TEST_EMAIL));

  if (!user) {
    logger.info("Seeding test user...");
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    [user] = await db
      .insert(usersTable)
      .values({ email: TEST_EMAIL, passwordHash })
      .returning();
    logger.info({ userId: user.id }, "Test user created");
  }

  // Ensure the test user has at least the default columns
  const existing = await db
    .select()
    .from(columnsTable)
    .where(eq(columnsTable.userId, user.id))
    .orderBy(asc(columnsTable.position));

  if (existing.length === 0) {
    logger.info("Seeding default columns for test user...");
    await db.insert(columnsTable).values(
      DEFAULT_COLUMNS.map(c => ({ ...c, userId: user.id }))
    );
    logger.info("Default columns created");
  }
}
