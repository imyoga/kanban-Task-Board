import { db, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";

function sortTasks<T extends { position: number; id: number }>(tasks: T[]) {
  return [...tasks].sort((left, right) => left.position - right.position || left.id - right.id);
}

export async function applyTaskMove(taskId: number, newColumnId: number, newPosition: number) {
  const [moving] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!moving) {
    throw new Error("Task not found");
  }

  const oldColumnId = moving.columnId;
  const allTasks = await db.select().from(tasksTable).where(eq(tasksTable.boardId, moving.boardId));
  const columnIds = new Set([oldColumnId, newColumnId]);
  const byColumn = new Map<number, typeof allTasks>();

  for (const columnId of columnIds) {
    byColumn.set(
      columnId,
      sortTasks(allTasks.filter((task) => task.columnId === columnId && task.id !== taskId)),
    );
  }

  const targetList = byColumn.get(newColumnId) ?? [];
  const insertAt = Math.max(0, Math.min(newPosition, targetList.length));
  targetList.splice(insertAt, 0, { ...moving, columnId: newColumnId });
  byColumn.set(newColumnId, targetList);

  for (const columnId of columnIds) {
    const list = byColumn.get(columnId) ?? [];
    for (let index = 0; index < list.length; index += 1) {
      const task = list[index];
      if (task.position !== index || task.columnId !== columnId) {
        await db
          .update(tasksTable)
          .set({
            columnId,
            position: index,
            updatedAt: new Date(),
          })
          .where(eq(tasksTable.id, task.id));
      }
    }
  }
}
