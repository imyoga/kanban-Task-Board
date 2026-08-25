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
