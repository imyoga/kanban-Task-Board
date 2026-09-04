import { memo, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useDeleteColumn,
  useUpdateColumn,
  getListColumnsQueryKey,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
} from "@workspace/api-client-react";
import type { Column, Task } from "@workspace/api-client-react";
import TaskCard from "@/components/TaskCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { columnDndId, taskDndId } from "@/lib/dnd";

interface Props {
  column: Column;
  boardId: number;
  tasks: Task[];
  onAddTask: (columnId: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
}

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
];

function KanbanColumn({ column, boardId, tasks, onAddTask, onEditTask, onDeleteTask }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: columnDndId(column.id),
    data: { type: "column", column },
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(column.title);

  const qc = useQueryClient();
  const { toast } = useToast();
  const deleteColumn = useDeleteColumn();
  const updateColumn = useUpdateColumn();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleDelete() {
    if (!confirm(`Delete column "${column.title}"? All tasks in this column will be removed.`)) return;
    deleteColumn.mutate(
      { id: column.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
          qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
          toast({ title: "Column deleted" });
        },
        onError: () => toast({ title: "Failed to delete column", variant: "destructive" }),
      }
    );
  }

  function handleRenameSubmit() {
    if (!titleValue.trim() || titleValue === column.title) {
      setEditingTitle(false);
      setTitleValue(column.title);
      return;
    }
    updateColumn.mutate(
      { id: column.id, data: { title: titleValue.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
          setEditingTitle(false);
        },
        onError: () => {
          toast({ title: "Failed to rename column", variant: "destructive" });
          setTitleValue(column.title);
          setEditingTitle(false);
        },
      }
    );
  }

  function handleChangeColor(color: string) {
    updateColumn.mutate(
      { id: column.id, data: { color } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
        },
      }
    );
  }

  const accentColor = column.color ?? "#6366f1";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col w-80 flex-shrink-0 rounded-2xl border border-border/80 bg-muted/40 backdrop-blur-xs transition-all",
        isOver && "bg-primary/10 border-primary/40 ring-2 ring-primary/20",
        isDragging && "opacity-40 shadow-2xl scale-[0.98] ring-2 ring-primary/40"
      )}
    >
      {/* Column top color bar */}
      <div
        className="h-1.5 w-full rounded-t-2xl transition-colors"
        style={{ backgroundColor: accentColor }}
      />

      {/* Column header */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-1 -ml-1 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing rounded transition-colors"
            aria-label="Drag column"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {editingTitle ? (
            <Input
              className="h-7 text-sm font-semibold py-0 px-1.5 border-primary shadow-xs bg-background focus-visible:ring-1"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameSubmit();
                if (e.key === "Escape") {
                  setEditingTitle(false);
                  setTitleValue(column.title);
                }
              }}
              autoFocus
            />
          ) : (
            <h3
              className="font-semibold text-sm text-foreground truncate cursor-pointer hover:text-primary transition-colors flex-1"
              onDoubleClick={() => setEditingTitle(true)}
              title="Double click to rename"
            >
              {column.title}
            </h3>
          )}

          <span className="text-xs font-semibold text-muted-foreground bg-background/80 border border-border/60 rounded-full px-2 py-0.5 shadow-2xs">
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
            title="Add task to column"
          >
            <Plus className="w-4 h-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setEditingTitle(true)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Rename column
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <div className="p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Change color
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleChangeColor(c)}
                      className="w-5 h-5 rounded-full border transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: accentColor === c ? "#fff" : "transparent",
                        boxShadow: accentColor === c ? `0 0 0 2px ${c}` : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tasks container */}
      <div className="flex-1 px-2.5 pb-2.5 overflow-y-auto max-h-[calc(100vh-210px)] min-h-[140px] space-y-2">
        <SortableContext items={tasks.map((t) => taskDndId(t.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                boardId={boardId}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="w-full flex flex-col items-center justify-center h-28 text-xs text-muted-foreground/60 hover:text-foreground border-2 border-dashed border-border/80 hover:border-primary/40 rounded-xl transition-all group"
          >
            <Plus className="w-4 h-4 mb-1 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            <span>Drop tasks or click to add</span>
          </button>
        )}
      </div>

      {/* Add task footer */}
      {tasks.length > 0 && (
        <div className="px-2.5 pb-2.5">
          <button
            type="button"
            onClick={() => onAddTask(column.id)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-background/80 border border-transparent hover:border-border/60 rounded-xl transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add task</span>
          </button>
        </div>
      )}
    </div>
  );
}

function areTaskListsEqual(prevTasks: Task[], nextTasks: Task[]) {
  if (prevTasks.length !== nextTasks.length) return false;

  for (let index = 0; index < prevTasks.length; index += 1) {
    const prevTask = prevTasks[index];
    const nextTask = nextTasks[index];

    if (
      prevTask.id !== nextTask.id ||
      prevTask.title !== nextTask.title ||
      prevTask.description !== nextTask.description ||
      prevTask.columnId !== nextTask.columnId ||
      prevTask.priority !== nextTask.priority ||
      prevTask.position !== nextTask.position ||
      prevTask.dueDate !== nextTask.dueDate ||
      prevTask.assigneeId !== nextTask.assigneeId ||
      prevTask.assignee?.id !== nextTask.assignee?.id ||
      prevTask.assignee?.firstName !== nextTask.assignee?.firstName ||
      prevTask.assignee?.lastName !== nextTask.assignee?.lastName
    ) {
      return false;
    }
  }

  return true;
}

export default memo(KanbanColumn, (prev, next) => {
  return (
    prev.boardId === next.boardId &&
    prev.onAddTask === next.onAddTask &&
    prev.onEditTask === next.onEditTask &&
    prev.onDeleteTask === next.onDeleteTask &&
    prev.column.id === next.column.id &&
    prev.column.title === next.column.title &&
    prev.column.color === next.column.color &&
    prev.column.position === next.column.position &&
    areTaskListsEqual(prev.tasks, next.tasks)
  );
});
