import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  boardsTable,
  teamsTable,
  teamMembersTable,
  teamInvitesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createDefaultBoardForUser } from "../lib/boards";
import {
  normalizeEmail,
  generateInviteToken,
  getTeamAccess,
  acceptPendingInvitesForUser,
  validateBoardLink,
} from "../lib/teams";
import { sendTeamInviteEmail, sendTeamAddedEmail } from "../lib/mailer";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

function serializeTeam(
  team: typeof teamsTable.$inferSelect,
  userId: number,
  boardName?: string | null,
) {
  return {
    id: team.id,
    name: team.name,
    boardId: team.boardId,
    boardName: boardName ?? null,
    isOwner: team.ownerId === userId,
    createdAt: team.createdAt.toISOString(),
  };
}

router.get("/teams", async (req, res) => {
  const userId = req.session.userId!;

  const owned = await db.select().from(teamsTable).where(eq(teamsTable.ownerId, userId));
  const memberRows = await db
    .select({ team: teamsTable })
    .from(teamMembersTable)
    .innerJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
    .where(eq(teamMembersTable.userId, userId));

  const ownedIds = new Set(owned.map((t) => t.id));
  const memberTeams = memberRows.map((r) => r.team).filter((t) => !ownedIds.has(t.id));
  const allTeams = [...owned, ...memberTeams];

  const boardIds = allTeams.map((t) => t.boardId).filter((id): id is number => id != null);
  const boardNames = new Map<number, string>();
  if (boardIds.length > 0) {
    const boards = await db.select().from(boardsTable);
    for (const b of boards) {
      if (boardIds.includes(b.id)) boardNames.set(b.id, b.name);
    }
  }

  res.json(
    allTeams.map((t) =>
      serializeTeam(t, userId, t.boardId ? boardNames.get(t.boardId) : null),
    ),
  );
});

router.post("/teams", async (req, res) => {
  const userId = req.session.userId!;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

  if (!name) {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  const [team] = await db
    .insert(teamsTable)
    .values({ ownerId: userId, name })
    .returning();

  await db.insert(teamMembersTable).values({ teamId: team.id, userId });

  res.status(201).json(serializeTeam(team, userId));
});

router.patch("/teams/:id", async (req, res) => {
  const teamId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  const updates: Partial<typeof teamsTable.$inferInsert> = {};
  if (typeof req.body?.name === "string" && req.body.name.trim()) {
    updates.name = req.body.name.trim();
  }

  if (req.body?.boardId !== undefined) {
    if (req.body.boardId === null) {
      updates.boardId = null;
    } else {
      const boardId = Number(req.body.boardId);
      const validation = await validateBoardLink(boardId, userId, teamId);
      if (!validation.ok) {
        res.status(400).json({ error: validation.error });
        return;
      }
      updates.boardId = boardId;
    }
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid updates provided" });
    return;
  }

  const [team] = await db
    .update(teamsTable)
    .set(updates)
    .where(eq(teamsTable.id, teamId))
    .returning();

  let boardName: string | null = null;
  if (team.boardId) {
    const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, team.boardId));
    boardName = board?.name ?? null;
  }

  res.json(serializeTeam(team, userId, boardName));
});

router.delete("/teams/:id", async (req, res) => {
  const teamId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  res.status(204).send();
});

router.get("/teams/:id/members", async (req, res) => {
  const teamId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const members = await db
    .select({ user: usersTable })
    .from(teamMembersTable)
    .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, teamId));

  res.json(
    members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      isOwner: m.user.id === access.team.ownerId,
    })),
  );
});

router.get("/teams/:id/invites", async (req, res) => {
  const teamId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  const invites = await db
    .select()
    .from(teamInvitesTable)
    .where(eq(teamInvitesTable.teamId, teamId));

  res.json(
    invites.map((i) => ({
      id: i.id,
      email: i.email,
      createdAt: i.createdAt.toISOString(),
    })),
  );
});

router.post("/teams/:id/invites", async (req, res) => {
  const teamId = Number(req.params.id);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  const rawEmail = req.body?.email;
  if (!rawEmail || typeof rawEmail !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const email = normalizeEmail(rawEmail);
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const [inviter] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const team = access.team;

  if (email === inviter!.email) {
    res.status(400).json({ error: "You are already on this team" });
    return;
  }

  const [existingMember] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingMember) {
    const [alreadyMember] = await db
      .select()
      .from(teamMembersTable)
      .where(
        and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, existingMember.id)),
      );

    if (alreadyMember) {
      res.status(409).json({ error: "User is already a team member" });
      return;
    }

    await db
      .insert(teamMembersTable)
      .values({ teamId, userId: existingMember.id })
      .onConflictDoNothing();

    let boardName: string | null = null;
    if (team.boardId) {
      const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, team.boardId));
      boardName = board?.name ?? null;
    }

    try {
      await sendTeamAddedEmail({
        to: email,
        teamName: team.name,
        inviterEmail: inviter!.email,
        boardName,
      });
    } catch (err) {
      console.error("Failed to send team notification email:", err);
    }

    res.status(201).json({
      type: "member",
      userId: existingMember.id,
      email: existingMember.email,
      firstName: existingMember.firstName,
      lastName: existingMember.lastName,
      isOwner: false,
    });
    return;
  }

  const [existingInvite] = await db
    .select()
    .from(teamInvitesTable)
    .where(and(eq(teamInvitesTable.teamId, teamId), eq(teamInvitesTable.email, email)));

  if (existingInvite) {
    res.status(409).json({ error: "Invitation already sent to this email" });
    return;
  }

  const token = generateInviteToken();
  const [invite] = await db
    .insert(teamInvitesTable)
    .values({ teamId, email, token })
    .returning();

  try {
    await sendTeamInviteEmail({
      to: email,
      teamName: team.name,
      inviterEmail: inviter!.email,
      inviteToken: token,
    });
  } catch (err) {
    await db.delete(teamInvitesTable).where(eq(teamInvitesTable.id, invite.id));
    res.status(500).json({ error: "Failed to send invitation email" });
    return;
  }

  res.status(201).json({
    type: "invite",
    id: invite.id,
    email: invite.email,
    createdAt: invite.createdAt.toISOString(),
  });
});

router.delete("/teams/:id/members/:userId", async (req, res) => {
  const teamId = Number(req.params.id);
  const memberUserId = Number(req.params.userId);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  if (memberUserId === access.team.ownerId) {
    res.status(400).json({ error: "Cannot remove team owner" });
    return;
  }

  const [removed] = await db
    .delete(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, memberUserId)))
    .returning();

  if (!removed) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.status(204).send();
});

router.delete("/teams/:id/invites/:inviteId", async (req, res) => {
  const teamId = Number(req.params.id);
  const inviteId = Number(req.params.inviteId);
  const userId = req.session.userId!;
  const access = await getTeamAccess(teamId, userId);

  if (!access || !access.canManage) {
    res.status(access ? 403 : 404).json({ error: access ? "Forbidden" : "Team not found" });
    return;
  }

  const [removed] = await db
    .delete(teamInvitesTable)
    .where(and(eq(teamInvitesTable.id, inviteId), eq(teamInvitesTable.teamId, teamId)))
    .returning();

  if (!removed) {
    res.status(404).json({ error: "Invite not found" });
    return;
  }

  res.status(204).send();
});

router.get("/boards/:boardId/team", async (req, res) => {
  const boardId = Number(req.params.boardId);
  const userId = req.session.userId!;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.boardId, boardId));
  if (!team) {
    res.json(null);
    return;
  }

  const access = await getTeamAccess(team.id, userId);
  if (!access) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const members = await db
    .select({ user: usersTable })
    .from(teamMembersTable)
    .innerJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, team.id));

  res.json({
    id: team.id,
    name: team.name,
    members: members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      isOwner: m.user.id === team.ownerId,
    })),
  });
});

export default router;
