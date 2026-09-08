import {
  db,
  boardsTable,
  boardMembersTable,
  teamsTable,
  teamMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

export type BoardAccessResult = {
  exists: boolean;
  hasAccess: boolean;
  board: typeof boardsTable.$inferSelect | null;
  isOwner: boolean;
  canManage: boolean;
  canEdit: boolean;
};

export async function checkBoardAccess(boardId: number, userId: number): Promise<BoardAccessResult> {
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  if (!board) {
    return { exists: false, hasAccess: false, board: null, isOwner: false, canManage: false, canEdit: false };
  }

  if (board.ownerId === userId) {
    return { exists: true, hasAccess: true, board, isOwner: true, canManage: true, canEdit: true };
  }

  const [member] = await db
    .select()
    .from(boardMembersTable)
    .where(and(eq(boardMembersTable.boardId, boardId), eq(boardMembersTable.userId, userId)));

  if (member) {
    return { exists: true, hasAccess: true, board, isOwner: false, canManage: false, canEdit: true };
  }

  const [teamMember] = await db
    .select({ team: teamsTable })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
    .where(and(eq(teamsTable.boardId, boardId), eq(teamMembersTable.userId, userId)));

  if (teamMember) {
    return { exists: true, hasAccess: true, board, isOwner: false, canManage: false, canEdit: true };
  }

  return { exists: true, hasAccess: false, board, isOwner: false, canManage: false, canEdit: false };
}

export async function getBoardAccess(boardId: number, userId: number) {
  const access = await checkBoardAccess(boardId, userId);
  if (!access.hasAccess || !access.board) return null;
  return { board: access.board, isOwner: access.isOwner, canManage: access.canManage, canEdit: access.canEdit };
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
  const teamBoards = await db
    .select({ boardId: teamsTable.boardId })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
    .where(eq(teamMembersTable.userId, userId));

  const ids = new Set<number>();
  for (const o of owned) ids.add(o.id);
  for (const s of shared) ids.add(s.boardId);
  for (const t of teamBoards) {
    if (t.boardId != null) ids.add(t.boardId);
  }
  return [...ids];
}

export async function getTeamForBoard(boardId: number) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.boardId, boardId));
  return team ?? null;
}
