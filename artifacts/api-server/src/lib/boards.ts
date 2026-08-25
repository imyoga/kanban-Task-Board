import { db, boardsTable, columnsTable, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DEFAULT_COLUMNS } from "./defaultColumns";

export async function createDefaultBoardForUser(userId: number, name = "My Board") {
  const [board] = await db
    .insert(boardsTable)
    .values({ ownerId: userId, name })
    .returning();

  await db.insert(columnsTable).values(
    DEFAULT_COLUMNS.map((column) => ({
      ...column,
      boardId: board.id,
      userId,
    })),
  );

  return board;
}

export async function migrateUsersToBoards() {
  const columns = await db.select().from(columnsTable);
  const tasks = await db.select().from(tasksTable);

  const userIds = new Set<number>();
  for (const column of columns) userIds.add(column.userId);
  for (const task of tasks) userIds.add(task.userId);

  for (const userId of userIds) {
    const [existingBoard] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.ownerId, userId))
      .limit(1);

    if (existingBoard) {
      const userColumns = columns.filter((c) => c.userId === userId);
      for (const column of userColumns) {
        if (column.boardId !== existingBoard.id) {
          await db
            .update(columnsTable)
            .set({ boardId: existingBoard.id })
            .where(eq(columnsTable.id, column.id));
        }
      }
      const userTasks = tasks.filter((t) => t.userId === userId);
      for (const task of userTasks) {
        if (task.boardId !== existingBoard.id) {
          await db
            .update(tasksTable)
            .set({ boardId: existingBoard.id })
            .where(eq(tasksTable.id, task.id));
        }
      }
      continue;
    }

    const userColumns = columns.filter((c) => c.userId === userId);
    if (userColumns.length === 0) {
      await createDefaultBoardForUser(userId);
      continue;
    }

    const [board] = await db
      .insert(boardsTable)
      .values({ ownerId: userId, name: "My Board" })
      .returning();

    for (const column of userColumns) {
      await db
        .update(columnsTable)
        .set({ boardId: board.id })
        .where(eq(columnsTable.id, column.id));
    }

    const userTasks = tasks.filter((t) => t.userId === userId);
    for (const task of userTasks) {
      await db
        .update(tasksTable)
        .set({ boardId: board.id })
        .where(eq(tasksTable.id, task.id));
    }
  }
}
