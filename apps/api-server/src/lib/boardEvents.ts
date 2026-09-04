import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
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

interface WSClient {
  id: string;
  boardId?: number;
  user?: PresenceUser;
  ws: WebSocket;
  isAlive: boolean;
}

export interface PresenceUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface PresencePayload {
  type: "presence";
  boardId: number;
  users: PresenceUser[];
  timestamp: string;
}

/**
 * In-memory map of boardId -> Set of active WebSocket client connections
 */
const boardClients = new Map<number, Set<WSClient>>();
const allClients = new Set<WSClient>();

let wss: WebSocketServer | null = null;

export function setupWebSocketServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  logger.info("WebSocket server initialized on /ws");

  // Periodically send ping frames to prevent proxy or network timeouts
  const pingInterval = setInterval(() => {
    for (const client of allClients) {
      if (!client.isAlive) {
        client.ws.terminate();
        removeClient(client);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {
        removeClient(client);
      }
    }
  }, 25_000);

  if (pingInterval.unref) {
    pingInterval.unref();
  }

  wss.on("connection", (ws, req) => {
    const clientId = Math.random().toString(36).slice(2, 9);
    const client: WSClient = { id: clientId, ws, isAlive: true };
    allClients.add(client);

    logger.debug({ clientId, ip: req.socket.remoteAddress }, "WebSocket client connected");

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "subscribe" && typeof msg.boardId === "number") {
          // If client switches boards on the same socket, remove from previous set
          if (client.boardId && client.boardId !== msg.boardId) {
            const oldBoardId = client.boardId;
            const oldSet = boardClients.get(oldBoardId);
            oldSet?.delete(client);
            if (oldSet && oldSet.size === 0) {
              boardClients.delete(oldBoardId);
            }
            broadcastPresence(oldBoardId);
          }

          client.boardId = msg.boardId;
          if (msg.user && typeof msg.user.id === "number") {
            client.user = {
              id: msg.user.id,
              firstName: typeof msg.user.firstName === "string" ? msg.user.firstName : "",
              lastName: typeof msg.user.lastName === "string" ? msg.user.lastName : "",
              email: typeof msg.user.email === "string" ? msg.user.email : "",
            };
          }

          let set = boardClients.get(msg.boardId);
          if (!set) {
            set = new Set<WSClient>();
            boardClients.set(msg.boardId, set);
          }
          set.add(client);

          // Send connected acknowledgment frame
          ws.send(
            JSON.stringify({
              type: "connected",
              boardId: msg.boardId,
              timestamp: new Date().toISOString(),
            })
          );
          logger.debug(
            { clientId, boardId: msg.boardId, userId: client.user?.id },
            "WebSocket subscribed to board",
          );

          // Broadcast updated presence list to all clients on this board
          broadcastPresence(msg.boardId);
        } else if (msg.type === "identify" && typeof msg.boardId === "number" && msg.user && typeof msg.user.id === "number") {
          client.boardId = msg.boardId;
          client.user = {
            id: msg.user.id,
            firstName: typeof msg.user.firstName === "string" ? msg.user.firstName : "",
            lastName: typeof msg.user.lastName === "string" ? msg.user.lastName : "",
            email: typeof msg.user.email === "string" ? msg.user.email : "",
          };

          let set = boardClients.get(msg.boardId);
          if (!set) {
            set = new Set<WSClient>();
            boardClients.set(msg.boardId, set);
          }
          set.add(client);

          broadcastPresence(msg.boardId);
        } else if (msg.type === "unsubscribe" && typeof msg.boardId === "number") {
          const set = boardClients.get(msg.boardId);
          if (set) {
            set.delete(client);
            if (set.size === 0) {
              boardClients.delete(msg.boardId);
            }
          }
          if (client.boardId === msg.boardId) {
            client.boardId = undefined;
          }
          broadcastPresence(msg.boardId);
        }
      } catch (err) {
        logger.warn({ err, clientId }, "Invalid WebSocket message received");
      }
    });

    ws.on("close", () => {
      removeClient(client);
    });

    ws.on("error", (err) => {
      logger.warn({ err, clientId }, "WebSocket error");
      removeClient(client);
    });
  });

  return wss;
}

export function getActiveBoardUsers(boardId: number): PresenceUser[] {
  const clients = boardClients.get(boardId);
  if (!clients) return [];
  const userMap = new Map<number, PresenceUser>();
  for (const client of clients) {
    if (client.user && client.ws.readyState === WebSocket.OPEN) {
      userMap.set(client.user.id, client.user);
    }
  }
  return Array.from(userMap.values());
}

export function broadcastPresence(boardId: number): void {
  const clients = boardClients.get(boardId);
  if (!clients || clients.size === 0) return;

  const users = getActiveBoardUsers(boardId);
  const payload: PresencePayload = {
    type: "presence",
    boardId,
    users,
    timestamp: new Date().toISOString(),
  };
  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (err) {
        logger.warn({ err, boardId, clientId: client.id }, "Failed to deliver presence message");
      }
    }
  }
}

function removeClient(client: WSClient) {
  allClients.delete(client);
  const boardId = client.boardId;
  if (boardId) {
    const set = boardClients.get(boardId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        boardClients.delete(boardId);
      }
    }
    broadcastPresence(boardId);
  }
}

/**
 * Broadcast an event to all connected WebSocket clients on a given board.
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

  const message = JSON.stringify(payload);

  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(message);
      } catch (err) {
        logger.warn({ err, boardId, clientId: client.id }, "Failed to deliver WS message");
        removeClient(client);
      }
    }
  }
}
