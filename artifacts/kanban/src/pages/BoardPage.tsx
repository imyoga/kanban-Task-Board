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
import { arrayMove } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListColumns,
  useListTasks,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import KanbanColumn from "@/components/KanbanColumn";
import TaskCard from "@/components/TaskCard";
import TaskDialog from "@/components/TaskDialog";
import AddColumnDialog from "@/components/AddColumnDialog";
import { Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BoardPage() {
  const { data: columns = [], isLoading: colsLoading } = useListColumns();
  const { data: tasks = [], isLoading: tasksLoading } = useListTasks();
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [localTasks, setLocalTasks] = useState<Task[] | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultColumnId, setDefaultColumnId] = useState<number | undefined>();

  const displayTasks = localTasks ?? tasks;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function getTasksForColumn(columnId: number) {
    return displayTasks
      .filter(t => t.columnId === columnId)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = displayTasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = displayTasks.find(t => t.id === active.id);
    if (!activeTask) return;

    const overIsColumn = over.data.current?.type === "column";
    const overTask = displayTasks.find(t => t.id === over.id);

    const targetColumnId = overIsColumn
      ? (over.data.current?.column as Column).id
      : overTask?.columnId;

    if (targetColumnId === undefined || targetColumnId === activeTask.columnId) return;

    setLocalTasks(prev => {
      const base = prev ?? tasks;
      return base.map(t => t.id === activeTask.id ? { ...t, columnId: targetColumnId } : t);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setLocalTasks(null);
      return;
    }

    const current = localTasks ?? tasks;
    const movedTask = current.find(t => t.id === active.id);
    if (!movedTask) { setLocalTasks(null); return; }

    const overTask = current.find(t => t.id === over.id);
    const overIsColumn = over.data.current?.type === "column";

    const targetColumnId = overIsColumn
      ? (over.data.current?.column as Column).id
      : (overTask?.columnId ?? movedTask.columnId);

    // Reorder within same column
    let reordered = [...current];
    if (!overIsColumn && overTask && overTask.columnId === movedTask.columnId) {
      const colTasks = reordered
        .filter(t => t.columnId === movedTask.columnId)
        .sort((a, b) => a.position - b.position);
      const oldIndex = colTasks.findIndex(t => t.id === movedTask.id);
      const newIndex = colTasks.findIndex(t => t.id === overTask.id);
      if (oldIndex !== newIndex) {
        const sorted = arrayMove(colTasks, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }));
        reordered = reordered.map(t => sorted.find(s => s.id === t.id) ?? t);
      }
    }

    // Apply column change
    reordered = reordered.map(t => t.id === movedTask.id ? { ...t, columnId: targetColumnId } : t);
    setLocalTasks(reordered);

    const finalTask = reordered.find(t => t.id === movedTask.id)!;

    updateTask.mutate(
      { id: movedTask.id, data: { columnId: finalTask.columnId, position: finalTask.position } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
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
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
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
          <h2 className="text-base font-semibold text-foreground">Board</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{tasks.length} task{tasks.length !== 1 ? "s" : ""} across {columns.length} column{columns.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setEditTask(null); setDefaultColumnId(columns[0]?.id); setTaskDialogOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add task
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto px-6 py-5">
          <div className="flex gap-4 h-full items-start">
            {columns.sort((a, b) => a.position - b.position).map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={getTasksForColumn(col.id)}
                onAddTask={handleAddTask}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
              />
            ))}

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
        columns={columns}
        defaultColumnId={defaultColumnId}
        editTask={editTask}
      />
      <AddColumnDialog open={addColumnOpen} onOpenChange={setAddColumnOpen} />
    </>
  );
}
