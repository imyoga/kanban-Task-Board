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

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useBoardEvents({
  boardId,
  isInteracting = false,
  onRemoteEvent,
}: UseBoardEventsOptions) {
  const { data: me } = useMe();
  const qc = useQueryClient();

  const [status, setStatus] = useState<BoardConnectionStatus>("connecting");
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);

  const hasBufferedEventRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInteractingRef = useRef(isInteracting);
  isInteractingRef.current = isInteracting;

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

  useEffect(() => {
    if (!boardId || typeof EventSource === "undefined") {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    const url = `${BASE}/api/boards/${boardId}/events`;
    const es = new EventSource(url, { withCredentials: true });

    es.onopen = () => {
      setStatus("connected");
    };

    es.addEventListener("connected", () => {
      setStatus("connected");
    });

    es.addEventListener("message", (e: MessageEvent) => {
      try {
        const payload: BoardEvent = JSON.parse(e.data);

        // Echo suppression: Ignore events triggered by the current user
        // (the current user already has optimistic updates and mutation callbacks)
        if (me?.id && payload.actorId === me.id) {
          return;
        }

        setLastEventTime(new Date());
        onRemoteEvent?.(payload);

        // If the user is currently dragging or interacting, buffer the event
        if (isInteractingRef.current) {
          hasBufferedEventRef.current = true;
          return;
        }

        triggerInvalidation(boardId, payload.type);
      } catch {
        // Ignore unparseable frames (such as keepalives)
      }
    });

    es.onerror = () => {
      setStatus("disconnected");
    };

    return () => {
      es.close();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [boardId, me?.id, triggerInvalidation, onRemoteEvent]);

  return {
    status,
    lastEventTime,
    isConnected: status === "connected",
  };
}
