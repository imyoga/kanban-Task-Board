import { db, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { logger } from "./logger";

export async function backfillUserNames() {
  const users = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.firstName, ""), eq(usersTable.lastName, "")));

  for (const user of users) {
    const firstName = user.firstName || user.email;
    const lastName = user.lastName || "User";
    await db
      .update(usersTable)
      .set({ firstName, lastName })
      .where(eq(usersTable.id, user.id));
  }

  if (users.length > 0) {
    logger.info({ count: users.length }, "Backfilled user names");
  }
}
