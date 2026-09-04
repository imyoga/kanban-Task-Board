import {
  db,
  notificationsTable,
  usersTable,
  boardsTable,
  tasksTable,
  boardMembersTable,
  teamsTable,
  teamMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { broadcastBoardEvent } from "./boardEvents";
import { logger } from "./logger";

interface CreateMentionNotificationsOptions {
  boardId: number;
  taskId: number;
  commentId?: number | null;
  actorId: number;
  content: string;
  type: "mention_comment" | "mention_description";
}

/**
 * Strips HTML tags and normalizes whitespace for preview snippets.
 */
function cleanSnippet(raw: string, maxLength = 180): string {
  const stripped = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/@\[([^\]]+)\]\((\d+)\)/g, "@$1")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trimEnd() + "...";
}

/**
 * Parses user IDs from mentions in content and creates notifications.
 */
export async function createMentionNotifications(options: CreateMentionNotificationsOptions): Promise<number[]> {
  const { boardId, taskId, commentId, actorId, content, type } = options;

  if (!content || !content.trim()) return [];

  // Fetch board and task details
  const [board] = await db.select().from(boardsTable).where(eq(boardsTable.id, boardId));
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, taskId));
  const [actor] = await db.select().from(usersTable).where(eq(usersTable.id, actorId));

  if (!board || !task || !actor) return [];

  const taskKey = `${board.key || "BOARD"}-${task.taskNumber || task.id}`;
  const actorName = [actor.firstName, actor.lastName].filter(Boolean).join(" ").trim() || actor.email;

  // Retrieve all valid members of this board (owner, direct members, and linked team members)
  const accessibleUserIds = new Set<number>();
  accessibleUserIds.add(board.ownerId);

  const directMembers = await db
    .select({ userId: boardMembersTable.userId })
    .from(boardMembersTable)
    .where(eq(boardMembersTable.boardId, boardId));
  for (const m of directMembers) {
    accessibleUserIds.add(m.userId);
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.boardId, boardId));
  if (team) {
    const tMembers = await db
      .select({ userId: teamMembersTable.userId })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.teamId, team.id));
    for (const m of tMembers) {
      accessibleUserIds.add(m.userId);
    }
  }

  // Load all accessible users to enable matching by ID, email, or full name
  const memberUsers = await db.select().from(usersTable);
  const validMemberUsers = memberUsers.filter((u) => accessibleUserIds.has(u.id));

  const targetUserIds = new Set<number>();

  // 1. Markdown style: @[Name](userId)
  const markdownRegex = /@\[([^\]]+)\]\((\d+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownRegex.exec(content)) !== null) {
    const uid = Number(match[2]);
    if (!isNaN(uid) && accessibleUserIds.has(uid) && uid !== actorId) {
      targetUserIds.add(uid);
    }
  }

  // 2. TipTap mention HTML style: data-id="userId" or data-mention-id="userId"
  const htmlDataIdRegex = /data-(?:mention-)?id=["'](\d+)["']/g;
  while ((match = htmlDataIdRegex.exec(content)) !== null) {
    const uid = Number(match[1]);
    if (!isNaN(uid) && accessibleUserIds.has(uid) && uid !== actorId) {
      targetUserIds.add(uid);
    }
  }

  // 3. Fallback: match by email or name if formatted as @email or @FirstName LastName
  for (const member of validMemberUsers) {
    if (member.id === actorId) continue;
    if (targetUserIds.has(member.id)) continue;

    // Check @email
    if (content.includes(`@${member.email}`)) {
      targetUserIds.add(member.id);
      continue;
    }

    // Check @FirstName LastName
    const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ").trim();
    if (fullName && content.includes(`@${fullName}`)) {
      targetUserIds.add(member.id);
      continue;
    }
  }

  if (targetUserIds.size === 0) return [];

  const snippet = cleanSnippet(content);
  const contextLabel = type === "mention_comment" ? "a comment on" : "the description of";
  const notificationTitle = `${actorName} tagged you in ${contextLabel} ${taskKey}`;

  const createdIds: number[] = [];

  for (const recipientId of targetUserIds) {
    try {
      const [inserted] = await db
        .insert(notificationsTable)
        .values({
          userId: recipientId,
          actorId,
          boardId,
          taskId,
          commentId: commentId ?? null,
          type,
          title: notificationTitle,
          content: snippet,
          isRead: false,
        })
        .returning({ id: notificationsTable.id });

      if (inserted) {
        createdIds.push(inserted.id);
      }
    } catch (err) {
      logger.error({ err, recipientId, taskId }, "Failed to create mention notification");
    }
  }

  if (createdIds.length > 0) {
    // Broadcast board event so active clients can update notifications
    broadcastBoardEvent(boardId, {
      type: "tasks:changed",
      actorId,
      action: "update",
      taskId,
    });
  }

  return createdIds;
}
