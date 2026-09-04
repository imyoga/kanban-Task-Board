import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
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
import {
  Plus,
  Loader2,
  Settings,
  Search,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getTaskFromDndActive,
  getColumnFromDndActive,
  columnDndId,
  buildReorderedTasks,
} from "@/lib/dnd";
import { useBoardIdFromRoute, useTaskKeyFromRoute } from "@/hooks/useBoardId";
import { useBoardEvents } from "@/hooks/useBoardEvents";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { userDisplayName, userInitials } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function BoardPage() {
  const boardId = useBoardIdFromRoute()!;
  const routeTaskKey = useTaskKeyFromRoute();
  const [, setLocation] = useLocation();
  const { data: boards = [] } = useListBoards();
  const board = boards.find((b) => b.id === boardId);
  const { data: columns = [], isLoading: colsLoading } = useListColumns({ boardId });
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks({ boardId });
  const { data: boardTeam } = useGetBoardTeam(boardId, {
    query: { queryKey: getGetBoardTeamQueryKey(boardId) },
  });

  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const updateColumn = useUpdateColumn();
  const deleteTask = useDeleteTask();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);
  const [localColumns, setLocalColumns] = useState<Column[] | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<number | undefined>();
  const lastOverId = useRef<string | number | null>(null);

  // Deep-link routing: open task modal if taskKey exists in URL
  useEffect(() => {
    if (!routeTaskKey || tasks.length === 0) return;
    const normalized = routeTaskKey.trim().toUpperCase();
    const found = tasks.find((t) => {
      if (t.taskKey && t.taskKey.toUpperCase() === normalized) return true;
      const parts = normalized.split("-");
      const numStr = parts[parts.length - 1];
      const num = Number(numStr);
      if (!isNaN(num) && (t.taskNumber === num || t.id === num)) return true;
      return false;
    });

    if (found && (!editTask || editTask.id !== found.id)) {
      setEditTask(found);
      setTaskDialogOpen(true);
    }
  }, [routeTaskKey, tasks, editTask]);

  // Real-time synchronization via Server-Sent Events (SSE)
  // Incoming remote updates are buffered while the user is actively dragging or has modals open
  const isInteracting = activeTask !== null || taskDialogOpen || addColumnOpen || settingsOpen;
  const { isConnected } = useBoardEvents({
    boardId,
    isInteracting,
  });

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const baseTasks = localTasks ?? tasks;
  const displayColumns = useMemo(
    () => [...(localColumns ?? columns)].sort((a, b) => a.position - b.position),
    [localColumns, columns]
  );

  // Apply filters
  const filteredTasks = useMemo(() => {
    return baseTasks.filter((task) => {
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
  }, [baseTasks, searchQuery, priorityFilter, assigneeFilter]);

  const hasActiveFilters =
    searchQuery.trim() !== "" || priorityFilter !== "all" || assigneeFilter !== "all";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      // 1. First, check for pointer collisions directly under cursor
      const pointerCollisions = pointerWithin(args);

      if (pointerCollisions.length > 0) {
        // Prioritize task card under pointer over column container background
        const taskCollision = pointerCollisions.find((c) =>
          String(c.id).startsWith("task-")
        );
        if (taskCollision) {
          lastOverId.current = taskCollision.id;
          return [{ id: taskCollision.id }];
        }

        const columnCollision = pointerCollisions.find((c) =>
          String(c.id).startsWith("column-")
        );
        if (columnCollision) {
          lastOverId.current = columnCollision.id;
          return [{ id: columnCollision.id }];
        }

        lastOverId.current = pointerCollisions[0].id;
        return [{ id: pointerCollisions[0].id }];
      }

      // 2. Fall back to rectIntersection when dragging across gaps between columns
      const rectCollisions = rectIntersection(args);
      const overId = getFirstCollision(rectCollisions, "id");

      if (overId != null) {
        lastOverId.current = overId;
        return [{ id: overId }];
      }

      // 3. Fallback to last valid container ID to prevent thrashing/flickering
      if (lastOverId.current) {
        return [{ id: lastOverId.current }];
      }

      return [];
    },
    []
  );

  const getTasksForColumn = useCallback(
    (columnId: number) => {
      return filteredTasks
        .filter((task) => task.columnId === columnId)
        .sort((left, right) => left.position - right.position || left.id - right.id);
    },
    [filteredTasks]
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    lastOverId.current = null;
    const task = getTaskFromDndActive(active.data.current);
    if (task) {
      setActiveTask(task);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    if (getColumnFromDndActive(active.data.current)) return;

    const activeTaskId = Number(String(active.id).replace("task-", ""));
    if (!activeTaskId || isNaN(activeTaskId)) return;

    const currentList = localTasks ?? tasks;
    const activeTaskItem = currentList.find((t) => t.id === activeTaskId);
    if (!activeTaskItem) return;

    const overId = String(over.id);
    let targetColumnId: number | undefined;

    if (overId.startsWith("column-")) {
      targetColumnId = Number(overId.replace("column-", ""));
    } else if (overId.startsWith("task-")) {
      const overTaskId = Number(overId.replace("task-", ""));
      const overTask = currentList.find((t) => t.id === overTaskId);
      targetColumnId = overTask?.columnId;
    }

    if (targetColumnId === undefined) return;

    // ONLY update localTasks if moving across different columns!
    // (SortableContext handles intra-column animation smoothly without state thrashing)
    if (activeTaskItem.columnId !== targetColumnId) {
      setLocalTasks((prev) => {
        const base = prev ?? tasks;
        const moving = base.find((t) => t.id === activeTaskId);
        if (!moving || moving.columnId === targetColumnId) return prev;

        const targetColTasks = base.filter(
          (t) => t.columnId === targetColumnId && t.id !== activeTaskId
        );
        let insertIdx = targetColTasks.length;

        if (overId.startsWith("task-")) {
          const overTaskId = Number(overId.replace("task-", ""));
          const overIdx = targetColTasks.findIndex((t) => t.id === overTaskId);
          if (overIdx >= 0) insertIdx = overIdx;
        }

        return buildReorderedTasks(base, activeTaskId, targetColumnId, insertIdx);
      });
    }
  }

  function handleDragCancel(_event: DragCancelEvent) {
    lastOverId.current = null;
    setActiveTask(null);
    setLocalTasks(null);
    setLocalColumns(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    lastOverId.current = null;
    setActiveTask(null);

    if (!over) {
      setLocalTasks(null);
      setLocalColumns(null);
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
        setLocalColumns(null);
        return;
      }

      const reordered = arrayMove(sorted, oldIndex, newIndex).map((c, i) => ({
        ...c,
        position: i,
      }));
      setLocalColumns(reordered);

      const changed = reordered.filter((c) => {
        const orig = columns.find((o) => o.id === c.id);
        return orig && orig.position !== c.position;
      });

      if (changed.length === 0) {
        setLocalColumns(null);
        return;
      }

      qc.setQueryData(getListColumnsQueryKey({ boardId }), reordered);
      setLocalColumns(null);

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
      setLocalTasks(null);
      return;
    }

    const currentTasks = localTasks ?? tasks;
    const currentMovingTask = currentTasks.find((t) => t.id === activeTaskId);
    if (!currentMovingTask) {
      setLocalTasks(null);
      return;
    }

    const overId = String(over.id);
    let targetColumnId = currentMovingTask.columnId;
    let targetIndex = 0;

    if (overId.startsWith("column-")) {
      targetColumnId = Number(overId.replace("column-", ""));
      const colTasks = currentTasks.filter(
        (t) => t.columnId === targetColumnId && t.id !== activeTaskId
      );
      targetIndex = colTasks.length;
    } else if (overId.startsWith("task-")) {
      const overTaskId = Number(overId.replace("task-", ""));
      const overTask = currentTasks.find((t) => t.id === overTaskId);
      if (overTask) {
        targetColumnId = overTask.columnId;
        const colTasks = currentTasks
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

    const nextTasks = buildReorderedTasks(
      currentTasks,
      activeTaskId,
      targetColumnId,
      targetIndex
    );

    // Optimistically update React Query cache for instant visual feedback
    qc.setQueryData(getListTasksQueryKey({ boardId }), nextTasks);
    setLocalTasks(null);

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

  const handleEditTask = useCallback(
    (task: Task) => {
      setEditTask(task);
      setTaskDialogOpen(true);
      const key = task.taskKey || `${board?.key || "BOARD"}-${task.taskNumber || task.id}`;
      setLocation(`/boards/${boardId}/${key}`);
    },
    [board?.key, boardId, setLocation]
  );

  const handleTaskDialogOpenChange = useCallback(
    (open: boolean) => {
      setTaskDialogOpen(open);
      if (!open) {
        setEditTask(null);
        if (routeTaskKey) {
          setLocation(`/boards/${boardId}`);
        }
      }
    },
    [boardId, routeTaskKey, setLocation]
  );

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
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-sm px-6 py-3.5 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Board Title & Team Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-foreground tracking-tight truncate">
                  {board?.name ?? "Board"}
                </h2>
                {boardTeam ? (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary border-primary/20"
                  >
                    <Users className="w-3 h-3" />
                    {boardTeam.name}
                  </Badge>
                ) : board?.isShared ? (
                  <Badge variant="secondary" className="text-xs font-medium">
                    Shared
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Personal
                  </Badge>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors select-none",
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
                      <span>{isConnected ? "Live" : "Connecting..."}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {isConnected
                      ? "Real-time sync active. Board updates automatically when teammates make changes."
                      : "Connecting to real-time sync stream..."}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
                {hasActiveFilters && ` (filtered from ${tasks.length})`} across{" "}
                {displayColumns.length} columns
              </p>
            </div>

            {/* Team Members Avatar Stack */}
            {boardTeam && boardTeam.members.length > 0 && (
              <div className="hidden sm:flex items-center -space-x-2 ml-2 pl-3 border-l border-border/60">
                {boardTeam.members.slice(0, 5).map((m) => (
                  <Tooltip key={m.userId}>
                    <TooltipTrigger asChild>
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary border-2 border-background flex items-center justify-center text-[10px] font-bold shadow-2xs hover:scale-110 hover:z-10 transition-transform">
                        {userInitials(m)}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <span>{userDisplayName(m)}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {boardTeam.members.length > 5 && (
                  <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground shadow-2xs">
                    +{boardTeam.members.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {board?.isOwner && (
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80 transition-colors shadow-2xs"
                aria-label="Board settings"
                title="Board settings & team linking"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            )}

            <button
              onClick={() => setAddColumnOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-semibold text-foreground rounded-lg hover:bg-muted/80 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Column</span>
            </button>

            <button
              onClick={() => {
                setEditTask(null);
                setDefaultColumnId(displayColumns[0]?.id);
                setTaskDialogOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-sm hover:shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Task</span>
            </button>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex items-center gap-2.5 flex-wrap pt-1">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="pl-8 h-8 text-xs bg-muted/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Priority filter pills */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 text-xs">
            {(["all", "high", "medium", "low"] as const).map((p) => {
              const isActive = priorityFilter === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriorityFilter(p)}
                  className={cn(
                    "px-2.5 py-1 rounded-md capitalize font-medium transition-all text-xs",
                    isActive
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Assignee filter if team members exist */}
          {boardTeam && boardTeam.members.length > 0 && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
            >
              <X className="w-3 h-3" />
              Reset filters
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
        <div className="flex-1 overflow-x-auto px-6 py-5">
          <div className="flex gap-4 h-full items-start">
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
              className="shrink-0 w-80 h-32 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/50 text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group"
            >
              <div className="w-8 h-8 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span>Add New Column</span>
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
