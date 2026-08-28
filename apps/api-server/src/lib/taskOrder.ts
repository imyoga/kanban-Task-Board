import { db, tasksTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

function sortTasks<T extends { position: number; id: number }>(tasks: T[]) {
  return [...tasks].sort((left, right) => left.position - right.position || left.id - right.id);
}

export async function applyTaskMove(
  taskId: number,
  oldColumnId: number,
  newColumnId: number,
  newPosition: number,
) {
  const [moving] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  if (!moving) {
    throw new Error("Task not found");
  }

  const boardId = moving.boardId;
  const allBoardTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.boardId, boardId))
    .orderBy(asc(tasksTable.position), asc(tasksTable.id));

  // If moving within the same column
  if (oldColumnId === newColumnId) {
    const colTasks = sortTasks(allBoardTasks.filter((t) => t.columnId === newColumnId && t.id !== taskId));
    const insertAt = Math.max(0, Math.min(newPosition, colTasks.length));
    colTasks.splice(insertAt, 0, { ...moving, columnId: newColumnId });

    for (let index = 0; index < colTasks.length; index += 1) {
      const task = colTasks[index];
      if (task.position !== index || task.id === taskId) {
        await db
          .update(tasksTable)
          .set({
            columnId: newColumnId,
            position: index,
            updatedAt: new Date(),
          })
          .where(eq(tasksTable.id, task.id));
      }
    }
    return;
  }

  // Moving across different columns:
  // 1. Re-index old column without the moving task
  const sourceTasks = sortTasks(allBoardTasks.filter((t) => t.columnId === oldColumnId && t.id !== taskId));
  for (let index = 0; index < sourceTasks.length; index += 1) {
    const task = sourceTasks[index];
    if (task.position !== index) {
      await db
        .update(tasksTable)
        .set({
          position: index,
          updatedAt: new Date(),
        })
        .where(eq(tasksTable.id, task.id));
    }
  }

  // 2. Insert into target column and re-index
  const targetTasks = sortTasks(allBoardTasks.filter((t) => t.columnId === newColumnId && t.id !== taskId));
  const insertAt = Math.max(0, Math.min(newPosition, targetTasks.length));
  targetTasks.splice(insertAt, 0, { ...moving, columnId: newColumnId });

  for (let index = 0; index < targetTasks.length; index += 1) {
    const task = targetTasks[index];
    if (task.position !== index || task.id === taskId || task.columnId !== newColumnId) {
      await db
        .update(tasksTable)
        .set({
          columnId: newColumnId,
          position: index,
          updatedAt: new Date(),
        })
        .where(eq(tasksTable.id, task.id));
    }
  }
}
