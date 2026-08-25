import { db, boardsTable, boardMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function getBoardAccess(boardId: number, userId: number) {
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  if (!board) return null;

  if (board.ownerId === userId) {
    return { board, isOwner: true, canManage: true, canEdit: true };
  }

  const [member] = await db
    .select()
    .from(boardMembersTable)
    .where(and(eq(boardMembersTable.boardId, boardId), eq(boardMembersTable.userId, userId)));

  if (!member) return null;

  return { board, isOwner: false, canManage: false, canEdit: true };
}

export async function getAccessibleBoardIds(userId: number) {
  const owned = await db
    .select({ id: boardsTable.id })
    .from(boardsTable)
    .where(eq(boardsTable.ownerId, userId));
  const shared = await db
    .select({ boardId: boardMembersTable.boardId })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.userId, userId));
  return [...owned.map((o) => o.id), ...shared.map((s) => s.boardId)];
}
