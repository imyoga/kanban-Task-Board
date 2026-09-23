import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragCancelEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBoards,
  useListColumns,
  useListTasks,
  useUpdateTask,
  useUpdateColumn,
  useDeleteTask,
  useGetBoardTeam,
  getListColumnsQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
  getGetBoardTeamQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import KanbanColumn from "@/components/KanbanColumn";
import TaskCard, { TaskCardPreview } from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import AddColumnDialog from "@/components/AddColumnDialog";
import BoardSettingsDialog from "@/components/BoardSettingsDialog";
import AccessDeniedModal from "@/components/AccessDeniedModal";
import NotificationBell from "@/components/NotificationBell";
import {
  Plus,
  Loader2,
  Settings,
  Search,
  Users,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getTaskFromDndActive,
  getColumnFromDndActive,
  columnDndId,
  buildReorderedTasks,
} from "@/lib/dnd";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";
import { useBoardEvents } from "@/hooks/useBoardEvents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe, userDisplayName, userInitials } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function BoardPage() {
  const boardId = useBoardIdFromRoute()!;
  const [, setLocation] = useLocation();
  const { data: boards = [], isLoading: boardsLoading } = useListBoards();
  const board = boards.find((b) => b.id === boardId);
  const { data: columns = [], isLoading: colsLoading, error: colsError } = useListColumns({ boardId });
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useListTasks({ boardId });
  const { data: boardTeam } = useGetBoardTeam(boardId, {
    query: { queryKey: getGetBoardTeamQueryKey(boardId) },
  });

  const isAccessDenied = useMemo(() => {
    if (!boardsLoading && !board) {
      return true;
    }
    const colsStatus = (colsError as any)?.status || (colsError as any)?.response?.status;
    const tasksStatus = (tasksError as any)?.status || (tasksError as any)?.response?.status;
    if (colsStatus === 403 || tasksStatus === 403 || colsStatus === 404 || tasksStatus === 404) {
      return true;
    }
    return false;
  }, [boardsLoading, board, colsError, tasksError]);

  const { data: me } = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const updateColumn = useUpdateColumn();
  const deleteTask = useDeleteTask();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<number | undefined>();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const lastOverId = useRef<string | number | null>(null);

  // Real-time synchronization via WebSocket
  // Incoming remote updates are buffered while the user is actively dragging
  const isInteracting = activeTask !== null;
  const { isConnected, activeUsers } = useBoardEvents({
    boardId,
    isInteracting,
    enabled: !isAccessDenied,
  });

  // Calculate users currently active/live on this board UI
  const liveMembers = useMemo(() => {
    return activeUsers.map((u) => {
      const teamMember = boardTeam?.members.find((m) => m.userId === u.id);
      const memberObj = {
        id: u.id,
        firstName: u.firstName || teamMember?.firstName || "",
        lastName: u.lastName || teamMember?.lastName || "",
        email: u.email || teamMember?.email || "",
      };
      return {
        ...memberObj,
        displayName: userDisplayName(memberObj),
      };
    });
  }, [activeUsers, boardTeam?.members]);

  // Sort live members so current user is first, then alphabetical by display name
  const sortedLiveMembers = useMemo(() => {
    return [...liveMembers].sort((a, b) => {
      if (a.id === me?.id) return -1;
      if (b.id === me?.id) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [liveMembers, me?.id]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const displayColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns]
  );

  // Apply filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && task.priority !== priorityFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter === "unassigned" && task.assigneeId != null) {
        return false;
      }
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        task.assigneeId !== Number(assigneeFilter)
      ) {
        return false;
      }

      return true;
    });
  }, [tasks, searchQuery, priorityFilter, assigneeFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || priorityFilter !== "all" || assigneeFilter !== "all";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    // 1. Column drag reordering mode
    if (getColumnFromDndActive(args.active.data.current)) {
      return closestCorners({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) =>
          String(c.id).startsWith("column-")
        ),
      });
    }

    // 2. Task card drag mode
    // Exclude active draggable container from collisions to prevent self-collision noise
    const validContainers = args.droppableContainers.filter(
      (c) => c.id !== args.active.id
    );

    // First priority: direct pointer overlap (pointerWithin)
    const pointerCollisions = pointerWithin({
      ...args,
      droppableContainers: validContainers,
    });

    if (pointerCollisions.length > 0) {
      // Find if pointer is inside a column or task
      const taskCollision = pointerCollisions.find((c) =>
        String(c.id).startsWith("task-")
      );
      const columnCollision = pointerCollisions.find((c) =>
        String(c.id).startsWith("column-")
      );

      // If pointer is inside a task, prioritize that task
      if (taskCollision) {
        lastOverId.current = taskCollision.id;
        return [taskCollision];
      }

      // If pointer is inside an empty column (or column area outside cards), return column
      if (columnCollision) {
        lastOverId.current = columnCollision.id;
        return [columnCollision];
      }

      lastOverId.current = pointerCollisions[0].id;
      return [{ id: pointerCollisions[0].id }];
    }

    // Fall back to rectIntersection when dragging across gaps between columns
    const rectCollisions = rectIntersection({
      ...args,
      droppableContainers: validContainers,
    });
    const overId = getFirstCollision(rectCollisions, "id");

    if (overId != null) {
      lastOverId.current = overId;
      return [{ id: overId }];
    }

    // Fallback to closestCorners
    const closestCollisions = closestCorners({
      ...args,
      droppableContainers: validContainers,
    });
    const closestId = getFirstCollision(closestCollisions, "id");
    if (closestId != null) {
      lastOverId.current = closestId;
      return [{ id: closestId }];
    }

    if (lastOverId.current) {
      return [{ id: lastOverId.current }];
    }

    return [];
  }, []);

  // Pre-build a stable map of columnId → sorted Task[] so each KanbanColumn
  // receives the same array reference when its tasks haven't changed.
  const tasksByColumn = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const task of filteredTasks) {
      const col = map.get(task.columnId);
      if (col) {
        col.push(task);
      } else {
        map.set(task.columnId, [task]);
      }
    }
    // Sort each column's task list by position then id
    for (const [colId, colTasks] of map) {
      map.set(colId, colTasks.slice().sort((a, b) => a.position - b.position || a.id - b.id));
    }
    return map;
  }, [filteredTasks]);

  const getTasksForColumn = useCallback(
    (colId: number) => tasksByColumn.get(colId) ?? [],
    [tasksByColumn]
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    lastOverId.current = null;
    const task = getTaskFromDndActive(active.data.current);
    if (task) {
      setActiveTask(task);
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    // No state mutation during drag-over!
    // Eliminating setLocalTasks in onDragOver prevents any concurrent React 19
    // render cascading or component unmounting mid-drag, completely eliminating
    // React Error #185 ("Maximum update depth exceeded").
  }

  function handleDragCancel(_event: DragCancelEvent) {
    lastOverId.current = null;
    setActiveTask(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    lastOverId.current = null;
    setActiveTask(null);

    if (!over) {
      return;
    }

    // Column reordering
    const activeColumn = getColumnFromDndActive(active.data.current);
    if (activeColumn) {
      const overColumn = getColumnFromDndActive(over.data.current);
      const sorted = [...displayColumns];
      const oldIndex = sorted.findIndex((c) => c.id === activeColumn.id);
      const newIndex = overColumn ? sorted.findIndex((c) => c.id === overColumn.id) : oldIndex;

      if (oldIndex === newIndex || newIndex < 0) {
        return;
      }

      const reordered = arrayMove(sorted, oldIndex, newIndex).map((c, i) => ({
        ...c,
        position: i,
      }));

      const changed = reordered.filter((c) => {
        const orig = columns.find((o) => o.id === c.id);
        return orig && orig.position !== c.position;
      });

      if (changed.length === 0) {
        return;
      }

      qc.setQueryData(getListColumnsQueryKey({ boardId }), reordered);

      for (const col of changed) {
        updateColumn.mutate(
          { id: col.id, data: { position: col.position } },
          {
            onError: () => {
              qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
              toast({ title: "Failed to reorder columns", variant: "destructive" });
            },
          }
        );
      }
      return;
    }

    // Task reordering
    const activeTaskId = Number(String(active.id).replace("task-", ""));
    if (!activeTaskId || isNaN(activeTaskId)) {
      return;
    }

    const currentMovingTask = tasks.find((t) => t.id === activeTaskId);
    if (!currentMovingTask) {
      return;
    }

    const overId = String(over.id);
    let targetColumnId = currentMovingTask.columnId;
    let targetIndex = 0;

    if (overId.startsWith("column-")) {
      targetColumnId = Number(overId.replace("column-", ""));
      if (targetColumnId === currentMovingTask.columnId) {
        // Dropped back on the same column's droppable area — keep original position
        targetIndex = currentMovingTask.position;
      } else {
        // Cross-column drop onto the column container — append to end
        const colTasks = tasks.filter(
          (t) => t.columnId === targetColumnId && t.id !== activeTaskId
        );
        targetIndex = colTasks.length;
      }
    } else if (overId.startsWith("task-")) {
      const overTaskId = Number(overId.replace("task-", ""));
      const overTask = tasks.find((t) => t.id === overTaskId);
      if (overTask) {
        targetColumnId = overTask.columnId;
        const colTasks = tasks
          .filter((t) => t.columnId === targetColumnId)
          .sort((a, b) => a.position - b.position || a.id - b.id);

        const oldPos = colTasks.findIndex((t) => t.id === activeTaskId);
        const overPos = colTasks.findIndex((t) => t.id === overTaskId);

        if (oldPos >= 0 && overPos >= 0) {
          targetIndex = overPos;
        } else {
          const withoutActive = colTasks.filter((t) => t.id !== activeTaskId);
          const idx = withoutActive.findIndex((t) => t.id === overTaskId);
          targetIndex = idx >= 0 ? idx : withoutActive.length;
        }
      }
    }

    // If task didn't change column or position, do nothing
    if (
      currentMovingTask.columnId === targetColumnId &&
      currentMovingTask.position === targetIndex
    ) {
      return;
    }

    const nextTasks = buildReorderedTasks(
      tasks,
      activeTaskId,
      targetColumnId,
      targetIndex
    );

    // Optimistically update React Query cache for instant visual feedback
    qc.setQueryData(getListTasksQueryKey({ boardId }), nextTasks);

    updateTask.mutate(
      { id: activeTaskId, data: { columnId: targetColumnId, position: targetIndex } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
        },
        onError: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
          toast({ title: "Failed to move task", variant: "destructive" });
        },
      }
    );
  }

  const handleAddTask = useCallback((columnId: number) => {
    setDefaultColumnId(columnId);
    setEditTask(null);
    setTaskDialogOpen(true);
  }, []);

  const handleEditTask = useCallback((task: Task) => {
    setEditTask(task);
    setTaskDialogOpen(true);
  }, []);

  const handleTaskDialogOpenChange = useCallback((open: boolean) => {
    setTaskDialogOpen(open);
    if (!open) {
      setEditTask(null);
    }
  }, []);

  const handleDeleteTask = useCallback(
    (id: number) => {
      if (!confirm("Delete this task?")) return;
      deleteTask.mutate(
        { id },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
            qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
            toast({ title: "Task deleted" });
          },
          onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
        }
      );
    },
    [deleteTask, qc, toast, boardId]
  );

  if (isAccessDenied) {
    const fallbackBoard = boards.find((b) => b.id !== boardId);
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <AccessDeniedModal open={true} fallbackBoardId={fallbackBoard?.id} />
      </div>
    );
  }

  if (colsLoading || tasksLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Board Header Bar */}
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-sm px-3 sm:px-4 py-2 space-y-1.5 shrink-0">
        {/* ── Top row: title + actions ── */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          {/* Board Title & Team Info */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight truncate">
                  {board?.name ?? "Board"}
                </h2>
                {boardTeam ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 text-[11px] font-semibold px-1.5 py-0.2 bg-primary/10 text-primary border-primary/20"
                  >
                    <Users className="w-3 h-3" />
                    {boardTeam.name}
                  </Badge>
                ) : board?.isShared ? (
                  <Badge variant="secondary" className="text-[11px] font-medium px-1.5 py-0.2">
                    Shared
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] text-muted-foreground px-1.5 py-0.2">
                    Personal
                  </Badge>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[10px] font-medium transition-colors select-none",
                        isConnected
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          isConnected ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        )}
                      />
                      <span className="hidden xs:inline">{isConnected ? "Live" : "Connecting..."}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isConnected
                      ? "Real-time sync active. Board updates automatically when teammates make changes."
                      : "Connecting to real-time sync stream..."}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
                {hasActiveFilters && ` (filtered from ${tasks.length})`} across{" "}
                {displayColumns.length} columns
              </p>
            </div>

            {/* Live Active Members Avatar Stack — hidden on mobile */}
            {sortedLiveMembers.length > 0 && (
              <div
                className="hidden sm:flex items-center -space-x-1.5 ml-1.5 pl-2.5 border-l border-border/60"
                aria-label="Active users on this board"
              >
                {sortedLiveMembers.slice(0, 5).map((m) => {
                  const isMe = m.id === me?.id;
                  return (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="relative group cursor-pointer"
                          data-testid={`presence-avatar-${m.id}`}
                        >
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold shadow-2xs hover:scale-110 hover:z-20 transition-transform select-none",
                              isMe
                                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                            )}
                          >
                            {userInitials(m)}
                          </div>
                          {/* Live presence indicator dot */}
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-background rounded-full ring-1 ring-emerald-600/30"
                            title="Active now"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>{m.displayName}</span>
                          {isMe && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Active now on this board</span>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
                {sortedLiveMembers.length > 5 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-bold text-muted-foreground shadow-2xs cursor-default">
                        +{sortedLiveMembers.length - 5}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      <p className="font-medium">
                        +{sortedLiveMembers.length - 5} more active teammates
                      </p>
                      <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                        {sortedLiveMembers.slice(5).map((m) => (
                          <li key={m.id}>{m.displayName}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Mobile filter toggle */}
            <button
              type="button"
              onClick={() => setFiltersVisible(v => !v)}
              className={cn(
                "sm:hidden flex items-center gap-1 px-2 h-7 border rounded-lg text-xs font-medium transition-colors shadow-2xs",
                filtersVisible || hasActiveFilters
                  ? "border-primary/50 text-primary bg-primary/5"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>

            {board?.isOwner && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 px-2 sm:px-2.5 h-7 border border-border text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors shadow-2xs"
                aria-label="Board settings"
                title="Board settings & team linking"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}

            <NotificationBell className="hidden sm:flex h-7 w-7 p-1" />
          </div>
        </div>

        {/* Filter / Search Bar — always visible on sm+, toggleable on mobile */}
        <div className={cn(
          "flex items-center gap-2 flex-wrap pt-0.5",
          !filtersVisible && "hidden sm:flex"
        )}>
          {/* Search box */}
          <div className="relative flex-1 min-w-[140px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-7 h-7 text-xs bg-muted/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Priority filter tabs */}
          <Tabs
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as "all" | "high" | "medium" | "low")}
          >
            <TabsList className="h-7 bg-muted/70 p-0.5 border border-border/60">
              <TabsTrigger
                value="all"
                className="h-5 px-2 text-[11px] font-medium capitalize"
              >
                All
              </TabsTrigger>
              <TabsTrigger
                value="high"
                className="h-5 px-2 text-[11px] font-medium capitalize flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>High</span>
              </TabsTrigger>
              <TabsTrigger
                value="medium"
                className="h-5 px-2 text-[11px] font-medium capitalize flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span>Medium</span>
              </TabsTrigger>
              <TabsTrigger
                value="low"
                className="h-5 px-2 text-[11px] font-medium capitalize flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span>Low</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Assignee filter if team members exist */}
          {boardTeam && boardTeam.members.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-7 px-2 rounded-lg border border-border bg-background text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {boardTeam.members.map((m) => (
                <option key={m.userId} value={String(m.userId)}>
                  {userDisplayName(m)}
                </option>
              ))}
            </select>
          )}

          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPriorityFilter("all");
                setAssigneeFilter("all");
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board Drag-and-Drop Area */}
      <DndContext
        collisionDetection={collisionDetectionStrategy}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 overflow-x-auto px-3 sm:px-4 py-3">
          <div className="flex gap-2 sm:gap-2.5 h-full items-start">
            <SortableContext
              items={displayColumns.map((c) => columnDndId(c.id))}
              strategy={horizontalListSortingStrategy}
            >
              {displayColumns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  boardId={boardId}
                  tasks={getTasksForColumn(col.id)}
                  onAddTask={handleAddTask}
                  onEditTask={handleEditTask}
                  onDeleteTask={handleDeleteTask}
                />
              ))}
            </SortableContext>

            {/* Quick new column button */}
            <button
              onClick={() => setAddColumnOpen(true)}
              className="shrink-0 w-32 sm:w-40 h-20 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-6 h-6 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-[11px]">Add Column</span>
            </button>
          </div>
        </div>

        {/* Drag Overlay for smooth dragging preview */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <TaskCardPreview task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={handleTaskDialogOpenChange}
        boardId={boardId}
        columns={displayColumns}
        defaultColumnId={defaultColumnId}
        editTask={editTask}
      />
      <AddColumnDialog open={addColumnOpen} onOpenChange={setAddColumnOpen} boardId={boardId} />
      {board && (
        <BoardSettingsDialog
          board={board}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onDeleted={() => {
            const remaining = boards.filter((b) => b.id !== boardId);
            setLocation(remaining[0] ? `/boards/${remaining[0].id}` : "/");
          }}
        />
      )}
    </>
  );
}
