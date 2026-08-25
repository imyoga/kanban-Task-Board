import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { columnDndId, taskDndId } from "@/lib/dnd";

interface Props {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
}

export default function KanbanColumn({ column, tasks, onAddTask, onEditTask, onDeleteTask }: Props) {
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
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey() });
          qc.invalidateQueries({ queryKey: getListTasksQueryKey() });
          qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey() });
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
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey() });
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

  const accentColor = column.color ?? "#6366f1";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col w-72 flex-shrink-0 rounded-xl border border-border bg-muted/50 transition-colors",
        isOver && "bg-primary/5 border-primary/30",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/30"
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          aria-label="Drag column"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />

        {editingTitle ? (
          <Input
            className="h-6 text-sm font-semibold py-0 px-1 border-none shadow-none bg-transparent focus-visible:ring-0"
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={e => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") { setEditingTitle(false); setTitleValue(column.title); } }}
            autoFocus
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-foreground cursor-pointer"
            onDoubleClick={() => setEditingTitle(true)}
          >
            {column.title}
          </span>
        )}

        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tasks.length}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-border transition-colors">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditingTitle(true)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tasks */}
      <div className="flex-1 px-2 pb-2 overflow-y-auto max-h-[calc(100vh-180px)]">
        <SortableContext items={tasks.map(t => taskDndId(t.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
              />
            ))}
          </div>
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60 border-2 border-dashed border-border rounded-lg mt-1">
            Drop tasks here
          </div>
        )}
      </div>

      {/* Add task button */}
      <div className="px-2 pb-2">
        <button
          onClick={() => onAddTask(column.id)}
          className="w-full flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-border rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add task
        </button>
      </div>
    </div>
  );
}
