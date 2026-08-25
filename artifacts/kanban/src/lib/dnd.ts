import type { Task } from "@workspace/api-client-react";

export const taskDndId = (id: number) => `task-${id}`;
export const columnDndId = (id: number) => `column-${id}`;

export function getTaskFromDndActive(data: { type?: string; task?: Task } | undefined): Task | undefined {
  if (data?.type === "task" && data.task) return data.task;
  return undefined;
}
