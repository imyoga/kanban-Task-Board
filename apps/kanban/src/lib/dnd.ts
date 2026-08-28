import type { Column, Task } from "@workspace/api-client-react";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";

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

export function resolveTargetColumnId(
  over: DragOverEvent["over"] | DragEndEvent["over"],
): number | undefined {
  if (!over) return undefined;
  if (over.data.current?.type === "column") {
    return (over.data.current.column as Column).id;
  }
  if (over.data.current?.type === "task") {
    return (over.data.current.task as Task).columnId;
  }
  return undefined;
}

export function computeTaskInsertIndex(
  event: DragOverEvent | DragEndEvent,
  columnTasks: Task[],
  activeTaskId: number,
): number | undefined {
  const { active, over } = event;
  if (!over || active.id === over.id) return undefined;

  const sorted = [...columnTasks].sort(
    (left, right) => left.position - right.position || left.id - right.id,
  );

  if (over.data.current?.type === "column") {
    return sorted.filter((task) => task.id !== activeTaskId).length;
  }

  if (over.data.current?.type !== "task") return undefined;

  const overTask = over.data.current.task as Task;
  if (overTask.id === activeTaskId) return undefined;

  const overIndex = sorted.findIndex((task) => task.id === overTask.id);
  if (overIndex < 0) return undefined;

  const activeIndex = sorted.findIndex((task) => task.id === activeTaskId);
  const isBelowOverItem = Boolean(
    active.rect.current.translated &&
      active.rect.current.translated.top > over.rect.top + over.rect.height / 2,
  );

  let insertIndex = overIndex + (isBelowOverItem ? 1 : 0);
  if (activeIndex >= 0 && activeIndex < insertIndex) {
    insertIndex -= 1;
  }

  const withoutActive = sorted.filter((task) => task.id !== activeTaskId);
  return Math.max(0, Math.min(insertIndex, withoutActive.length));
}
