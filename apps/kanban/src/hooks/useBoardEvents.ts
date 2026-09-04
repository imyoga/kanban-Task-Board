import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListTasksQueryKey,
  getListColumnsQueryKey,
  getGetTaskStatsQueryKey,
  getGetBoardTeamQueryKey,
  getListBoardsQueryKey,
} from "@workspace/api-client-react";
import { useMe } from "./useAuth";

export type BoardConnectionStatus = "connecting" | "connected" | "disconnected";

export interface PresenceUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface BoardEvent {
  type: "tasks:changed" | "columns:changed" | "board:updated" | "board:deleted" | "members:changed";
  boardId: number;
  actorId: number;
  action?: "create" | "update" | "delete" | "move";
  taskId?: number;
  columnId?: number;
  timestamp: string;
}

interface UseBoardEventsOptions {
  boardId?: number;
  /**
   * If true (e.g. user is actively dragging a task or column), incoming remote updates
   * are buffered and deferred until interaction finishes, preventing UI jumping or drag cancellation.
   */
  isInteracting?: boolean;
  /**
   * Optional callback when a remote event is received from another user.
   */
  onRemoteEvent?: (event: BoardEvent) => void;
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${protocol}//${host}${base}/ws`;
}

export function useBoardEvents({
  boardId,
  isInteracting = false,
  onRemoteEvent,
}: UseBoardEventsOptions) {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [status, setStatus] = useState<BoardConnectionStatus>("connecting");
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const hasBufferedEventRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(isInteracting);
  isInteractingRef.current = isInteracting;

  const onRemoteEventRef = useRef(onRemoteEvent);
  onRemoteEventRef.current = onRemoteEvent;

  const meRef = useRef(me);
  meRef.current = me;

  const meIdRef = useRef(me?.id);
  meIdRef.current = me?.id;

  const triggerInvalidation = useCallback(
    (targetBoardId: number, eventType?: string) => {
      // Coalesce multiple rapid events into a single query invalidation batch
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        if (eventType === "board:updated" || eventType === "board:deleted") {
          qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
        }

        qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId: targetBoardId }) });
        qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId: targetBoardId }) });
        qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId: targetBoardId }) });
        qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(targetBoardId) });
      }, 350);
    },
    [qc],
  );

  // When user stops interacting (e.g. completes drag), flush buffered remote events immediately
  useEffect(() => {
    if (!isInteracting && hasBufferedEventRef.current && boardId) {
      hasBufferedEventRef.current = false;
      triggerInvalidation(boardId);
    }
  }, [isInteracting, boardId, triggerInvalidation]);

  // Identify with WebSocket if user session finishes loading while connected
  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN && me && boardId) {
      socketRef.current.send(
        JSON.stringify({
          type: "identify",
          boardId,
          user: {
            id: me.id,
            firstName: me.firstName,
            lastName: me.lastName,
            email: me.email,
          },
        }),
      );
    }
  }, [me, boardId]);

  useEffect(() => {
    if (!boardId || typeof WebSocket === "undefined") {
      setStatus("disconnected");
      setActiveUsers([]);
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isDisposed = false;

    function connect() {
      if (isDisposed) return;
      setStatus("connecting");

      try {
        const wsUrl = getWebSocketUrl();
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (isDisposed) return;
          const subscribePayload = {
            type: "subscribe",
            boardId,
            user: meRef.current
              ? {
                  id: meRef.current.id,
                  firstName: meRef.current.firstName,
                  lastName: meRef.current.lastName,
                  email: meRef.current.email,
                }
              : undefined,
          };
          socket?.send(JSON.stringify(subscribePayload));
          setStatus("connected");
        };

        socket.onmessage = (e: MessageEvent) => {
          if (isDisposed) return;
          try {
            const data = JSON.parse(e.data);

            if (data.type === "connected") {
              setStatus("connected");
              return;
            }

            if (data.type === "presence") {
              if (data.boardId === boardId && Array.isArray(data.users)) {
                setActiveUsers(data.users);
              }
              return;
            }

            const payload: BoardEvent = data;

            // Echo suppression: Ignore events triggered by the current user
            // (the current user already has optimistic updates and mutation callbacks)
            if (meIdRef.current && payload.actorId === meIdRef.current) {
              return;
            }

            setLastEventTime(new Date());
            onRemoteEventRef.current?.(payload);

            // If the user is currently dragging or interacting, buffer the event
            if (isInteractingRef.current) {
              hasBufferedEventRef.current = true;
              return;
            }

            if (boardId) {
              triggerInvalidation(boardId, payload.type);
            }
          } catch {
            // Ignore non-JSON or ping frames
          }
        };

        socket.onerror = () => {
          if (isDisposed) return;
          setStatus("disconnected");
        };

        socket.onclose = () => {
          if (isDisposed) return;
          setStatus("disconnected");
          reconnectTimeout = setTimeout(connect, 3000);
        };
      } catch {
        if (!isDisposed) {
          setStatus("disconnected");
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: "unsubscribe", boardId }));
          } catch {
            // Ignore if socket already closed
          }
        }
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
      socketRef.current = null;
      setActiveUsers([]);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [boardId]);

  return {
    status,
    lastEventTime,
    isConnected: status === "connected",
    activeUsers,
  };
}
