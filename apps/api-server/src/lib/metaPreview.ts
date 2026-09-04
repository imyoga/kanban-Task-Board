import { db, tasksTable, boardsTable, columnsTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";

export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function parseTaskKey(taskKeyStr: string): { boardKeyPrefix?: string; taskNumber: number | null } {
  const trimmed = taskKeyStr.trim();
  const lastHyphen = trimmed.lastIndexOf("-");
  if (lastHyphen !== -1) {
    const prefix = trimmed.slice(0, lastHyphen).toUpperCase();
    const num = parseInt(trimmed.slice(lastHyphen + 1), 10);
    return { boardKeyPrefix: prefix, taskNumber: Number.isFinite(num) ? num : null };
  }
  const num = parseInt(trimmed, 10);
  return { taskNumber: Number.isFinite(num) ? num : null };
}

export interface TaskPreviewMeta {
  title: string;
  description: string;
  taskKey: string;
  taskTitle: string;
  boardName: string;
  columnTitle?: string;
  priority?: string;
  imageUrl?: string;
}

export async function getTaskPreviewMeta(
  boardId: number,
  taskKeyInput: string
): Promise<TaskPreviewMeta | null> {
  if (!Number.isFinite(boardId) || !taskKeyInput) return null;

  const { taskNumber } = parseTaskKey(taskKeyInput);
  if (taskNumber === null) return null;

  try {
    const [row] = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        priority: tasksTable.priority,
        taskNumber: tasksTable.taskNumber,
        columnId: tasksTable.columnId,
        columnTitle: columnsTable.title,
        boardName: boardsTable.name,
        boardKey: boardsTable.key,
      })
      .from(tasksTable)
      .innerJoin(boardsTable, eq(tasksTable.boardId, boardsTable.id))
      .leftJoin(columnsTable, eq(tasksTable.columnId, columnsTable.id))
      .where(
        and(
          eq(tasksTable.boardId, boardId),
          or(eq(tasksTable.taskNumber, taskNumber), eq(tasksTable.id, taskNumber))
        )
      )
      .limit(1);

    if (!row) return null;

    const boardKey = (row.boardKey || "BOARD").toUpperCase();
    const assignedTaskNumber = row.taskNumber ?? row.id;
    const taskKey = `${boardKey}-${assignedTaskNumber}`;
    const pageTitle = `[${taskKey}] ${row.title}`;

    // Contextual description metadata
    const statusPart = row.columnTitle ? `Status: ${row.columnTitle}` : "";
    const priorityPart = row.priority
      ? `Priority: ${row.priority.charAt(0).toUpperCase() + row.priority.slice(1)}`
      : "";
    const metaParts = [statusPart, priorityPart].filter(Boolean).join(" • ");
    const boardPart = row.boardName ? `Board: ${row.boardName}` : "";

    const rawDesc = row.description ? stripHtml(row.description) : "";
    const truncatedDesc = rawDesc.length > 200 ? `${rawDesc.slice(0, 197)}...` : rawDesc;

    let finalDescription = "";
    if (truncatedDesc) {
      finalDescription = metaParts ? `${metaParts} | ${truncatedDesc}` : truncatedDesc;
    } else {
      finalDescription = [metaParts, boardPart].filter(Boolean).join(" • ") || "Kanban Task Board";
    }

    return {
      title: pageTitle,
      description: finalDescription,
      taskKey,
      taskTitle: row.title,
      boardName: row.boardName,
      columnTitle: row.columnTitle ?? undefined,
      priority: row.priority ?? undefined,
    };
  } catch {
    return null;
  }
}

export async function getBoardPreviewMeta(boardId: number) {
  if (!Number.isFinite(boardId)) return null;

  try {
    const [board] = await db
      .select({
        id: boardsTable.id,
        name: boardsTable.name,
        key: boardsTable.key,
      })
      .from(boardsTable)
      .where(eq(boardsTable.id, boardId))
      .limit(1);

    if (!board) return null;

    const title = `${board.name} | Kanban Task Board`;
    const description = `Kanban board: ${board.name}. Collaborative task tracking, swimlanes, and workflow management.`;

    return {
      title,
      description,
      boardName: board.name,
      boardKey: board.key,
    };
  } catch {
    return null;
  }
}

export interface HtmlMetaParams {
  title: string;
  description: string;
  url?: string;
  image?: string;
  siteName?: string;
}

export function injectHtmlMeta(html: string, meta: HtmlMetaParams): string {
  const titleEsc = escapeHtml(meta.title);
  const descEsc = escapeHtml(meta.description);
  const siteNameEsc = escapeHtml(meta.siteName || "Kanban Task Board");
  const urlEsc = meta.url ? escapeHtml(meta.url) : "";
  const imageEsc = meta.image ? escapeHtml(meta.image) : "";

  // Replace <title>
  if (/<title>.*?<\/title>/i.test(html)) {
    html = html.replace(/<title>.*?<\/title>/i, `<title>${titleEsc}</title>`);
  } else {
    html = html.replace("</head>", `  <title>${titleEsc}</title>\n</head>`);
  }

  // Helper to replace or insert meta tag
  function setMeta(tagAttr: string, attrVal: string, contentVal: string) {
    const pattern = new RegExp(`<meta\\s+[^>]*${tagAttr}=["']${attrVal}["'][^>]*>`, "i");
    const newTag = `<meta ${tagAttr}="${attrVal}" content="${contentVal}" />`;
    if (pattern.test(html)) {
      html = html.replace(pattern, newTag);
    } else {
      html = html.replace("</head>", `  ${newTag}\n</head>`);
    }
  }

  setMeta("name", "description", descEsc);
  setMeta("property", "og:title", titleEsc);
  setMeta("property", "og:description", descEsc);
  setMeta("property", "og:site_name", siteNameEsc);
  setMeta("property", "og:type", "website");
  setMeta("name", "twitter:title", titleEsc);
  setMeta("name", "twitter:description", descEsc);
  setMeta("name", "twitter:card", "summary_large_image");

  if (urlEsc) {
    setMeta("property", "og:url", urlEsc);
  }
  if (imageEsc) {
    setMeta("property", "og:image", imageEsc);
    setMeta("name", "twitter:image", imageEsc);
  }

  return html;
}
