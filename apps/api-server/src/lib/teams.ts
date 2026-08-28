import crypto from "node:crypto";
import {
  db,
  teamsTable,
  teamMembersTable,
  teamInvitesTable,
  usersTable,
  boardsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

export function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

export function generateInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function isTeamOwner(teamId: number, userId: number) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  return team?.ownerId === userId;
}

export async function getTeamAccess(teamId: number, userId: number) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) return null;

  const isOwner = team.ownerId === userId;
  if (isOwner) return { team, isOwner, canManage: true };

  const [member] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));

  if (!member) return null;
  return { team, isOwner: false, canManage: false };
}

export async function acceptPendingInvitesForUser(
  userId: number,
  email: string,
  inviteToken?: string,
) {
  const normalizedEmail = normalizeEmail(email);

  if (inviteToken) {
    const [invite] = await db
      .select()
      .from(teamInvitesTable)
      .where(eq(teamInvitesTable.token, inviteToken));

    if (!invite || invite.email !== normalizedEmail) {
      throw new Error("Invalid or expired invitation");
    }
  }

  const pending = await db
    .select()
    .from(teamInvitesTable)
    .where(eq(teamInvitesTable.email, normalizedEmail));

  for (const invite of pending) {
    await db
      .insert(teamMembersTable)
      .values({ teamId: invite.teamId, userId })
      .onConflictDoNothing();
    await db.delete(teamInvitesTable).where(eq(teamInvitesTable.id, invite.id));
  }
}

export async function validateBoardLink(boardId: number, userId: number, currentTeamId?: number) {
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  if (!board) return { ok: false, error: "Board not found" };
  if (board.ownerId !== userId) return { ok: false, error: "You can only link boards you own" };

  const [existingTeam] = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.boardId, boardId));

  if (existingTeam && existingTeam.id !== currentTeamId) {
    return { ok: false, error: "Board is already linked to another team" };
  }

  return { ok: true, board };
}
