import type { Response } from "express";
import { logger } from "./logger";

export type BoardEventAction = "create" | "update" | "delete" | "move";

export interface BoardEventPayload {
  type: "tasks:changed" | "columns:changed" | "board:updated" | "board:deleted" | "members:changed";
  boardId: number;
  actorId: number;
  action?: BoardEventAction;
  taskId?: number;
  columnId?: number;
  timestamp: string;
}

interface SSEClient {
  id: string;
  userId: number;
  res: Response;
}

/**
 * In-memory map of boardId -> Set of active SSE client connections
 */
const boardClients = new Map<number, Set<SSEClient>>();

/**
 * Periodically sends a keepalive comment to prevent proxy or browser timeouts.
 */
const keepaliveInterval = setInterval(() => {
  for (const [boardId, clients] of boardClients.entries()) {
    for (const client of clients) {
      try {
        client.res.write(":keepalive\n\n");
      } catch (err) {
        logger.warn({ err, boardId, clientId: client.id }, "Failed to write keepalive to SSE client");
        clients.delete(client);
      }
    }
    if (clients.size === 0) {
      boardClients.delete(boardId);
    }
  }
}, 25_000);

// Prevent the interval from holding the Node.js process open on shutdown
if (keepaliveInterval.unref) {
  keepaliveInterval.unref();
}

/**
 * Register a new SSE client for a board.
 */
export function addBoardClient(boardId: number, userId: number, res: Response): () => void {
  const clientId = `${boardId}-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Set required SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  res.flushHeaders?.();

  // Send initial handshake
  const initialPayload = JSON.stringify({
    type: "connected",
    boardId,
    timestamp: new Date().toISOString(),
  });
  res.write(`event: connected\ndata: ${initialPayload}\n\n`);

  const client: SSEClient = { id: clientId, userId, res };

  let clients = boardClients.get(boardId);
  if (!clients) {
    clients = new Set<SSEClient>();
    boardClients.set(boardId, clients);
  }
  clients.add(client);

  logger.debug({ boardId, userId, activeClients: clients.size }, "SSE client connected to board");

  const cleanup = () => {
    const existing = boardClients.get(boardId);
    if (existing) {
      existing.delete(client);
      if (existing.size === 0) {
        boardClients.delete(boardId);
      }
    }
    logger.debug({ boardId, userId }, "SSE client disconnected from board");
  };

  return cleanup;
}

/**
 * Broadcast an event to all connected clients on a given board.
 */
export function broadcastBoardEvent(
  boardId: number,
  event: Omit<BoardEventPayload, "boardId" | "timestamp">,
): void {
  const clients = boardClients.get(boardId);
  if (!clients || clients.size === 0) {
    return;
  }

  const payload: BoardEventPayload = {
    ...event,
    boardId,
    timestamp: new Date().toISOString(),
  };

  const message = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(message);
    } catch (err) {
      logger.warn({ err, boardId, clientId: client.id }, "Failed to deliver event to SSE client");
      clients.delete(client);
    }
  }

  if (clients.size === 0) {
    boardClients.delete(boardId);
  }
}
