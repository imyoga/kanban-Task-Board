import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@workspace/api-client-react";
import { taskDndId } from "@/lib/dnd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { userDisplayName, userInitials } from "@/hooks/useAuth";

interface Props {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700 border border-red-200",
  medium: "bg-amber-100 text-amber-700 border border-amber-200",
  low: "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TaskCard({ task, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(task.id),
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const overdue = isOverdue(task.dueDate);
  const assignee = task.assignee;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card border border-card-border rounded-lg p-3 shadow-sm group cursor-default",
        "transition-shadow hover:shadow-md",
        isDragging && "opacity-40 shadow-xl ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-0.5 text-muted-foreground/40 hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-sm font-medium text-foreground leading-snug break-words flex-1">
              {task.title}
            </p>
            {assignee && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                    aria-label={userDisplayName(assignee)}
                  >
                    {userInitials(assignee)}
                  </div>
                </TooltipTrigger>
                <TooltipContent>{userDisplayName(assignee)}</TooltipContent>
              </Tooltip>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className={cn("text-[11px] font-medium px-1.5 py-0.5 rounded", PRIORITY_STYLES[task.priority])}>
              {task.priority}
            </span>
            {task.dueDate && (
              <span className={cn(
                "flex items-center gap-1 text-[11px]",
                overdue ? "text-red-600 font-medium" : "text-muted-foreground"
              )}>
                <Calendar className="w-3 h-3" />
                {formatDate(task.dueDate)}
                {overdue && " (overdue)"}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function areTasksEqual(prev: Task, next: Task) {
  return (
    prev.id === next.id &&
    prev.title === next.title &&
    prev.description === next.description &&
    prev.columnId === next.columnId &&
    prev.priority === next.priority &&
    prev.position === next.position &&
    prev.dueDate === next.dueDate &&
    prev.assigneeId === next.assigneeId &&
    prev.assignee?.id === next.assignee?.id &&
    prev.assignee?.firstName === next.assignee?.firstName &&
    prev.assignee?.lastName === next.assignee?.lastName
  );
}

export default memo(TaskCard, (prev, next) => {
  return (
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    areTasksEqual(prev.task, next.task)
  );
});
