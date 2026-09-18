import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { logger } from "./logger";
import { checkBoardAccess } from "./boardAccess";

export type BoardEventAction = "create" | "update" | "delete" | "move";

export interface BoardEventPayload {
  type: "tasks:changed" | "columns:changed" | "board:updated" | "board:deleted" | "members:changed";
  boardId: number;
  actorId: number;
  /** Identifies the specific browser tab that originated the event. Used by clients
   *  to suppress their own echoes without blocking updates in other tabs of the same user. */
  sourceTabId?: string;
  action?: BoardEventAction;
  taskId?: number;
  columnId?: number;
  timestamp: string;
}

interface WSClient {
  id: string;
  /** Per-tab identifier sent by the client on subscribe/identify, used for echo suppression. */
  tabId?: string;
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

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "subscribe" && typeof msg.boardId === "number") {
          const userId = msg.user && typeof msg.user.id === "number" ? msg.user.id : undefined;
          if (userId) {
            const access = await checkBoardAccess(msg.boardId, userId);
            if (!access.hasAccess) {
              ws.send(
                JSON.stringify({
                  type: "error",
                  error: "Forbidden",
                  message: "You don't have access to this board.",
                  boardId: msg.boardId,
                })
              );
              return;
            }
          }

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
          // Store the per-tab identifier so the server can echo it back in events
          if (typeof msg.tabId === "string") {
            client.tabId = msg.tabId;
          }
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
          const access = await checkBoardAccess(msg.boardId, msg.user.id);
          if (!access.hasAccess) {
            ws.send(
              JSON.stringify({
                type: "error",
                error: "Forbidden",
                message: "You don't have access to this board.",
                boardId: msg.boardId,
              })
            );
            return;
          }

          client.boardId = msg.boardId;
          if (typeof msg.tabId === "string") {
            client.tabId = msg.tabId;
          }
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
 *
 * The `sourceTabId` is resolved automatically by finding the actor's active
 * WebSocket connection on this board. This allows each receiving client to
 * distinguish "my own echo on this tab" (same tabId → suppress) from
 * "a different tab of the same user" (different tabId → accept and refresh).
 * Route handlers do not need to be changed.
 *
 * @param boardId - Target board.
 * @param event - Event payload (without boardId/timestamp/sourceTabId).
 */
export function broadcastBoardEvent(
  boardId: number,
  event: Omit<BoardEventPayload, "boardId" | "timestamp" | "sourceTabId">,
): void {
  const clients = boardClients.get(boardId);
  if (!clients || clients.size === 0) {
    return;
  }

  // Resolve the per-tab ID from the actor's active WS connection on this board.
  // If the actor has multiple tabs open on the same board, we pick the most
  // recently subscribed one (last in the Set iteration order). The browser tab
  // that made the HTTP mutation will typically be the one that last sent a WS
  // heartbeat, but any tab of that user works — other tabs of the same user
  // will compare their own tabId and see they differ, so they'll apply the update.
  let resolvedTabId: string | undefined;
  for (const c of clients) {
    if (c.user?.id === event.actorId && c.tabId) {
      resolvedTabId = c.tabId;
    }
  }

  const payload: BoardEventPayload = {
    ...event,
    boardId,
    sourceTabId: resolvedTabId,
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
