import { db, boardsTable, columnsTable, tasksTable } from "@workspace/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { DEFAULT_COLUMNS } from "./defaultColumns";

export async function seedDefaultColumnsForBoard(boardId: number, userId: number) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${boardId})`);

    const existing = await tx
      .select({ id: columnsTable.id })
      .from(columnsTable)
      .where(eq(columnsTable.boardId, boardId));

    if (existing.length > 0) return;

    await tx.insert(columnsTable).values(
      DEFAULT_COLUMNS.map((column) => ({
        ...column,
        boardId,
        userId,
      })),
    );
  });
}

function isDefaultColumn(column: typeof columnsTable.$inferSelect) {
  return DEFAULT_COLUMNS.some(
    (defaultColumn) =>
      defaultColumn.title === column.title && defaultColumn.position === column.position,
  );
}

export async function normalizeDefaultColumnsForBoard(boardId: number) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${boardId})`);

    const columns = await tx
      .select()
      .from(columnsTable)
      .where(eq(columnsTable.boardId, boardId))
      .orderBy(asc(columnsTable.position), asc(columnsTable.id));

    const duplicateGroups = new Map<string, Array<typeof columnsTable.$inferSelect>>();
    for (const column of columns) {
      if (!isDefaultColumn(column)) continue;
      const key = `${column.position}:${column.title}`;
      const group = duplicateGroups.get(key);
      if (group) {
        group.push(column);
      } else {
        duplicateGroups.set(key, [column]);
      }
    }

    let changed = false;

    for (const group of duplicateGroups.values()) {
      if (group.length <= 1) continue;

      changed = true;
      const [keep, ...duplicates] = group;
      const duplicateIds = duplicates.map((column) => column.id);

      const tasksToMove = await tx
        .select()
        .from(tasksTable)
        .where(inArray(tasksTable.columnId, duplicateIds))
        .orderBy(asc(tasksTable.position), asc(tasksTable.id));

      const existingKeepTasks = await tx
        .select({ id: tasksTable.id })
        .from(tasksTable)
        .where(eq(tasksTable.columnId, keep.id))
        .orderBy(asc(tasksTable.position), asc(tasksTable.id));

      for (const [index, task] of tasksToMove.entries()) {
        await tx
          .update(tasksTable)
          .set({
            columnId: keep.id,
            position: existingKeepTasks.length + index,
            updatedAt: new Date(),
          })
          .where(eq(tasksTable.id, task.id));
      }

      await tx.delete(columnsTable).where(inArray(columnsTable.id, duplicateIds));
    }

    if (!changed) {
      return false;
    }

    const normalizedColumns = await tx
      .select()
      .from(columnsTable)
      .where(eq(columnsTable.boardId, boardId))
      .orderBy(asc(columnsTable.position), asc(columnsTable.id));

    for (const [index, column] of normalizedColumns.entries()) {
      if (column.position === index) continue;
      await tx.update(columnsTable).set({ position: index }).where(eq(columnsTable.id, column.id));
    }

    return true;
  });
}

export function generateBoardKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "BOARD";
  if (words.length === 1) {
    const letters = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return letters.slice(0, 5) || "BOARD";
  }
  if (words.length === 2) {
    const w1 = words[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const w2 = words[1].replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const key = `${w1.slice(0, 3)}${w2.slice(0, 2)}`;
    return key || "BOARD";
  }
  const acronym = words.map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().charAt(0)).join("");
  return acronym.slice(0, 6) || "BOARD";
}

export async function createDefaultBoardForUser(userId: number, name = "My Board", customKey?: string) {
  const key = customKey ? customKey.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 10) : generateBoardKey(name);
  const [board] = await db
    .insert(boardsTable)
    .values({ ownerId: userId, name, key })
    .returning();

  await seedDefaultColumnsForBoard(board.id, userId);

  return board;
}

export async function migrateUsersToBoards() {
  const columnsWithoutBoard = await db
    .select()
    .from(columnsTable)
    .where(sql`${columnsTable.boardId} IS NULL OR ${columnsTable.boardId} = 0`);
  const tasksWithoutBoard = await db
    .select()
    .from(tasksTable)
    .where(sql`${tasksTable.boardId} IS NULL OR ${tasksTable.boardId} = 0`);

  const userIds = new Set<number>();
  for (const column of columnsWithoutBoard) userIds.add(column.userId);
  for (const task of tasksWithoutBoard) userIds.add(task.userId);

  for (const userId of userIds) {
    let [existingBoard] = await db
      .select()
      .from(boardsTable)
      .where(eq(boardsTable.ownerId, userId))
      .limit(1);

    if (!existingBoard) {
      existingBoard = await createDefaultBoardForUser(userId);
    }

    const userColumns = columnsWithoutBoard.filter((c) => c.userId === userId);
    for (const column of userColumns) {
      await db
        .update(columnsTable)
        .set({ boardId: existingBoard.id })
        .where(eq(columnsTable.id, column.id));
    }

    const userTasks = tasksWithoutBoard.filter((t) => t.userId === userId);
    for (const task of userTasks) {
      await db
        .update(tasksTable)
        .set({ boardId: existingBoard.id })
        .where(eq(tasksTable.id, task.id));
    }
  }

  const allBoards = await db.select().from(boardsTable);
  for (const board of allBoards) {
    await seedDefaultColumnsForBoard(board.id, board.ownerId);
  }
}
