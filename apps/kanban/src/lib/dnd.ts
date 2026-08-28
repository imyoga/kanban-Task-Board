import type { Column, Task } from "@workspace/api-client-react";

export const taskDndId = (id: number) => `task-${id}`;
export const columnDndId = (id: number) => `column-${id}`;

export function getTaskFromDndActive(data: { type?: string; task?: Task } | undefined): Task | undefined {
  if (data?.type === "task" && data.task) return data.task;
  return undefined;
}

export function getColumnFromDndActive(data: { type?: string; column?: Column } | undefined): Column | undefined {
  if (data?.type === "column" && data.column) return data.column;
  return undefined;
}

export function buildReorderedTasks(
  allTasks: Task[],
  activeTaskId: number,
  targetColumnId: number,
  insertIndex: number,
): Task[] {
  const movingTask = allTasks.find((t) => t.id === activeTaskId);
  if (!movingTask) return allTasks;

  const sourceColumnId = movingTask.columnId;
  const isSameColumn = sourceColumnId === targetColumnId;

  // Source column tasks excluding moving task
  const sourceTasks = allTasks
    .filter((t) => t.columnId === sourceColumnId && t.id !== activeTaskId)
    .sort((a, b) => a.position - b.position || a.id - b.id);

  // Target column tasks excluding moving task
  const targetTasks = isSameColumn
    ? sourceTasks
    : allTasks
        .filter((t) => t.columnId === targetColumnId && t.id !== activeTaskId)
        .sort((a, b) => a.position - b.position || a.id - b.id);

  // Insert moving task into target column at desired index
  const clampedIndex = Math.max(0, Math.min(insertIndex, targetTasks.length));
  const newTargetList = [...targetTasks];
  newTargetList.splice(clampedIndex, 0, { ...movingTask, columnId: targetColumnId });

  // Re-index target list
  const reindexedTarget = newTargetList.map((t, idx) => ({ ...t, position: idx }));

  // Re-index source list if different column
  const reindexedSource = isSameColumn
    ? []
    : sourceTasks.map((t, idx) => ({ ...t, position: idx }));

  // Untouched other columns
  const otherTasks = allTasks.filter(
    (t) => t.columnId !== sourceColumnId && t.columnId !== targetColumnId,
  );

  return [...otherTasks, ...reindexedSource, ...reindexedTarget];
}
