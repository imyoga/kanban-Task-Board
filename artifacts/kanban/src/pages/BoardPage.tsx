import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
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
import { getTaskFromDndActive, getColumnFromDndActive, columnDndId } from "@/lib/dnd";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";
import { Badge } from "@/components/ui/badge";

export default function BoardPage() {
  const boardId = useBoardIdFromRoute()!;
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
  const displayColumns = (localColumns ?? columns).sort((a, b) => a.position - b.position);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function getTasksForColumn(columnId: number) {
    return displayTasks
      .filter(t => t.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  function resolveTargetColumnId(over: DragOverEvent["over"] | DragEndEvent["over"]): number | undefined {
    if (!over) return undefined;
    if (over.data.current?.type === "column") {
      return (over.data.current.column as Column).id;
    }
    if (over.data.current?.type === "task") {
      return (over.data.current.task as Task).columnId;
    }
    return undefined;
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
    if (targetColumnId === undefined || targetColumnId === activeTask.columnId) return;

    setLocalTasks(prev => {
      const base = prev ?? tasks;
      const targetTasks = base
        .filter(t => t.columnId === targetColumnId)
        .sort((a, b) => a.position - b.position);
      const insertIndex = over.data.current?.type === "task"
        ? targetTasks.findIndex(t => t.id === (over.data.current!.task as Task).id)
        : targetTasks.length;
      const moved = { ...activeTask, columnId: targetColumnId, position: insertIndex >= 0 ? insertIndex : targetTasks.length };
      const others = base.filter(t => t.id !== activeTask.id);
      const updatedTarget = [...targetTasks];
      updatedTarget.splice(insertIndex >= 0 ? insertIndex : updatedTarget.length, 0, moved);
      const reindexed = updatedTarget.map((t, i) => ({ ...t, position: i }));
      return [
        ...others.filter(t => t.columnId !== targetColumnId),
        ...reindexed,
      ];
    });
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
    const overIsTask = over.data.current?.type === "task";
    const overTask = overIsTask ? (over.data.current!.task as Task) : undefined;

    let reordered = [...current];
    const movedInCurrent = reordered.find(t => t.id === activeTaskItem.id);
    if (!movedInCurrent) {
      setLocalTasks(null);
      return;
    }

    if (overIsTask && overTask && overTask.columnId === movedInCurrent.columnId) {
      const colTasks = reordered
        .filter(t => t.columnId === movedInCurrent.columnId)
        .sort((a, b) => a.position - b.position);
      const oldIndex = colTasks.findIndex(t => t.id === movedInCurrent.id);
      const newIndex = colTasks.findIndex(t => t.id === overTask.id);
      if (oldIndex !== newIndex) {
        const sorted = arrayMove(colTasks, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }));
        reordered = reordered.map(t => sorted.find(s => s.id === t.id) ?? t);
      }
    } else if (targetColumnId !== movedInCurrent.columnId) {
      const sourceTasks = reordered
        .filter(t => t.columnId === movedInCurrent.columnId && t.id !== movedInCurrent.id)
        .sort((a, b) => a.position - b.position)
        .map((t, i) => ({ ...t, position: i }));
      const targetTasks = reordered
        .filter(t => t.columnId === targetColumnId && t.id !== movedInCurrent.id)
        .sort((a, b) => a.position - b.position);
      const insertIndex = overIsTask
        ? targetTasks.findIndex(t => t.id === overTask!.id)
        : targetTasks.length;
      const moved = { ...movedInCurrent, columnId: targetColumnId, position: insertIndex >= 0 ? insertIndex : targetTasks.length };
      const updatedTarget = [...targetTasks];
      updatedTarget.splice(insertIndex >= 0 ? insertIndex : updatedTarget.length, 0, moved);
      const reindexedTarget = updatedTarget.map((t, i) => ({ ...t, position: i }));
      reordered = [
        ...reordered.filter(t => t.columnId !== movedInCurrent.columnId && t.columnId !== targetColumnId),
        ...sourceTasks,
        ...reindexedTarget,
      ];
    }

    setLocalTasks(reordered);

    const finalTask = reordered.find(t => t.id === activeTaskItem.id)!;

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

  function handleAddTask(columnId: number) {
    setDefaultColumnId(columnId);
    setEditTask(null);
    setTaskDialogOpen(true);
  }

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

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
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
        />
      )}
    </>
  );
}
