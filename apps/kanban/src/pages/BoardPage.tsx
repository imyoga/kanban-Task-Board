import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
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
  getListColumnsQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import KanbanColumn from "@/components/KanbanColumn";
import TaskCard from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import AddColumnDialog from "@/components/AddColumnDialog";
import BoardSettingsDialog from "@/components/BoardSettingsDialog";
import { Plus, Loader2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTaskFromDndActive, getColumnFromDndActive, columnDndId, resolveTargetColumnId, computeTaskInsertIndex } from "@/lib/dnd";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

function normalizeTasks(tasks: Task[]) {
  const seen = new Set<number>();
  const unique = tasks.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });

  return unique
    .map((task) => ({ ...task }))
    .sort((left, right) =>
      left.columnId === right.columnId
        ? left.position - right.position || left.id - right.id
        : left.columnId - right.columnId || left.position - right.position || left.id - right.id,
    );
}

function sameTaskLayout(left: Task[], right: Task[]) {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (
      left[index].id !== right[index].id ||
      left[index].columnId !== right[index].columnId ||
      left[index].position !== right[index].position
    ) {
      return false;
    }
  }

  return true;
}

function projectTaskMove(
  taskList: Task[],
  activeTaskId: number,
  targetColumnId: number,
  insertIndex?: number,
) {
  const sourceTask = taskList.find((task) => task.id === activeTaskId);
  if (!sourceTask) return taskList;

  const remaining = taskList.filter((task) => task.id !== activeTaskId);
  const targetTasks = remaining
    .filter((task) => task.columnId === targetColumnId)
    .sort((left, right) => left.position - right.position || left.id - right.id);

  const nextInsertIndex =
    insertIndex == null
      ? targetTasks.length
      : Math.max(0, Math.min(insertIndex, targetTasks.length));

  const movedTask = { ...sourceTask, columnId: targetColumnId };
  const nextTargetTasks = [...targetTasks];
  nextTargetTasks.splice(nextInsertIndex, 0, movedTask);
  const reindexedTargetTasks = nextTargetTasks.map((task, index) => ({
    ...task,
    position: index,
  }));

  if (sourceTask.columnId === targetColumnId) {
    const otherTasks = remaining.filter((task) => task.columnId !== targetColumnId);
    return normalizeTasks([...otherTasks, ...reindexedTargetTasks]);
  }

  const sourceTasks = remaining
    .filter((task) => task.columnId === sourceTask.columnId)
    .sort((left, right) => left.position - right.position || left.id - right.id);
  const nextSourceTasks = sourceTasks.map((task, index) => ({ ...task, position: index }));
  const untouchedTasks = remaining.filter(
    (task) => task.columnId !== sourceTask.columnId && task.columnId !== targetColumnId,
  );

  return normalizeTasks([...untouchedTasks, ...nextSourceTasks, ...reindexedTargetTasks]);
}

export default function BoardPage() {
  const boardId = useBoardIdFromRoute()!;
  const [, setLocation] = useLocation();
  const { data: boards = [] } = useListBoards();
  const board = boards.find(b => b.id === boardId);
  const { data: columns = [], isLoading: colsLoading } = useListColumns({ boardId });
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks({ boardId });
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

  const displayTasks = localTasks ?? tasks;
  const displayColumns = [...(localColumns ?? columns)].sort((a, b) => a.position - b.position);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getTasksForColumn = useCallback((columnId: number) => {
    return displayTasks
      .filter((task) => task.columnId === columnId)
      .sort((left, right) => left.position - right.position || left.id - right.id);
  }, [displayTasks]);

  function projectTaskDrop(
    event: DragOverEvent | DragEndEvent,
    taskList: Task[],
    activeTaskId: number,
    targetColumnId: number,
  ) {
    const columnTasks = taskList.filter((task) => task.columnId === targetColumnId);
    const insertIndex = computeTaskInsertIndex(event, columnTasks, activeTaskId);
    if (insertIndex === undefined) return taskList;
    return projectTaskMove(taskList, activeTaskId, targetColumnId, insertIndex);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = getTaskFromDndActive(event.active.data.current);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    if (getColumnFromDndActive(active.data.current)) return;

    const activeTask = getTaskFromDndActive(active.data.current);
    if (!activeTask) return;

    const targetColumnId = resolveTargetColumnId(over);
    if (targetColumnId === undefined) return;

    setLocalTasks((prev) => {
      const base = prev ?? tasks;
      const currentTask = base.find((task) => task.id === activeTask.id);
      if (!currentTask) return prev;

      const projected = projectTaskDrop(event, base, activeTask.id, targetColumnId);
      return sameTaskLayout(base, projected) ? prev : projected;
    });
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveTask(null);
    setLocalTasks(null);
    setLocalColumns(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setLocalTasks(null);
      setLocalColumns(null);
      return;
    }

    const activeColumn = getColumnFromDndActive(active.data.current);
    if (activeColumn) {
      const overColumn = getColumnFromDndActive(over.data.current);
      const sorted = [...displayColumns];
      const oldIndex = sorted.findIndex(c => c.id === activeColumn.id);
      const newIndex = overColumn ? sorted.findIndex(c => c.id === overColumn.id) : oldIndex;
      if (oldIndex === newIndex || newIndex < 0) {
        setLocalColumns(null);
        return;
      }
      const reordered = arrayMove(sorted, oldIndex, newIndex).map((c, i) => ({ ...c, position: i }));
      setLocalColumns(reordered);

      const changed = reordered.filter(c => {
        const orig = columns.find(o => o.id === c.id);
        return orig && orig.position !== c.position;
      });

      if (changed.length === 0) {
        setLocalColumns(null);
        return;
      }

      let completed = 0;
      let failed = false;
      for (const col of changed) {
        updateColumn.mutate(
          { id: col.id, data: { position: col.position } },
          {
            onSuccess: () => {
              completed += 1;
              if (completed === changed.length && !failed) {
                qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
                setLocalColumns(null);
              }
            },
            onError: () => {
              failed = true;
              setLocalColumns(null);
              toast({ title: "Failed to reorder columns", variant: "destructive" });
            },
          }
        );
      }
      return;
    }

    const activeTaskItem = getTaskFromDndActive(active.data.current);
    if (!activeTaskItem) {
      setLocalTasks(null);
      return;
    }

    const current = localTasks ?? tasks;
    const targetColumnId = resolveTargetColumnId(over) ?? activeTaskItem.columnId;
    const reordered = projectTaskDrop(event, current, activeTaskItem.id, targetColumnId);

    const finalTask = reordered.find((task) => task.id === activeTaskItem.id);
    if (!finalTask) {
      setLocalTasks(null);
      return;
    }

    const originalTask = tasks.find((task) => task.id === activeTaskItem.id);
    if (
      originalTask &&
      originalTask.columnId === finalTask.columnId &&
      originalTask.position === finalTask.position
    ) {
      setLocalTasks(null);
      return;
    }

    setLocalTasks(reordered);

    updateTask.mutate(
      { id: activeTaskItem.id, data: { columnId: finalTask.columnId, position: finalTask.position } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
          setLocalTasks(null);
        },
        onError: () => {
          setLocalTasks(null);
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

  const handleDeleteTask = useCallback((id: number) => {
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
  }, [deleteTask, qc, toast]);

  if (colsLoading || tasksLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{board?.name ?? "Board"}</h2>
            {board?.isShared && (
              <Badge variant="secondary" className="text-[10px]">Shared</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{tasks.length} task{tasks.length !== 1 ? "s" : ""} across {displayColumns.length} column{displayColumns.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {board?.isOwner && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-sm font-medium rounded-lg hover:bg-muted transition-colors"
              aria-label="Board settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => { setEditTask(null); setDefaultColumnId(displayColumns[0]?.id); setTaskDialogOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
        </div>
      </div>

      <DndContext collisionDetection={closestCorners} sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="flex-1 overflow-x-auto px-6 py-5">
          <div className="flex gap-4 h-full items-start">
            <SortableContext items={displayColumns.map(c => columnDndId(c.id))} strategy={horizontalListSortingStrategy}>
              {displayColumns.map(col => (
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

            <button
              onClick={() => setAddColumnOpen(true)}
              className="flex-shrink-0 w-72 flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New column
            </button>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="rotate-1 opacity-90 shadow-xl">
              <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
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
            const remaining = boards.filter(b => b.id !== boardId);
            setLocation(remaining[0] ? `/boards/${remaining[0].id}` : "/");
          }}
        />
      )}
    </>
  );
}
