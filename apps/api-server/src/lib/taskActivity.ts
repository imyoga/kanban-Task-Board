import { db, taskActivitiesTable } from "@workspace/db";
import { logger } from "./logger";

export interface LogTaskActivityParams {
  taskId: number;
  boardId: number;
  userId: number;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  message: string;
}

export async function recordTaskActivity(params: LogTaskActivityParams) {
  try {
    await db.insert(taskActivitiesTable).values({
      taskId: params.taskId,
      boardId: params.boardId,
      userId: params.userId,
      action: params.action,
      field: params.field ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      message: params.message,
    });
  } catch (error) {
    logger.error({ err: error, params }, "Failed to record task activity");
  }
}
