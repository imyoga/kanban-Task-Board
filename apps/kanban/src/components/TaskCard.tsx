import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, Trash2, Pencil, AlertCircle, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@workspace/api-client-react";
import { taskDndId } from "@/lib/dnd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { userDisplayName, userInitials } from "@/hooks/useAuth";
import { stripHtmlPreview } from "@/components/RichTextEditor";

interface Props {
  task: Task;
  boardId?: number;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}

const PRIORITY_CONFIG = {
  high: {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
    dot: "bg-rose-500",
    border: "border-l-rose-500",
    label: "High",
  },
  medium: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
    label: "Medium",
  },
  low: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
    dot: "bg-emerald-500",
    border: "border-l-emerald-500",
    label: "Low",
  },
} as const;

function getDueDateStatus(dueDateStr: string | null | undefined): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  isSoon: boolean;
} | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffTime = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const formatted = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      label: overdueDays === 1 ? "Overdue (yesterday)" : `Overdue (${overdueDays}d ago)`,
      isOverdue: true,
      isToday: false,
      isSoon: false,
    };
  }
  if (diffDays === 0) {
    return { label: "Due today", isOverdue: false, isToday: true, isSoon: true };
  }
  if (diffDays === 1) {
    return { label: "Due tomorrow", isOverdue: false, isToday: false, isSoon: true };
  }
  return { label: formatted, isOverdue: false, isToday: false, isSoon: false };
}

function TaskCard({ task, boardId, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: taskDndId(task.id),
    data: { type: "task", task },
  });

  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  const priorityStyle = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const dueStatus = getDueDateStatus(task.dueDate);
  const assignee = task.assignee;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
      className={cn(
        "group relative bg-card rounded-xl p-3.5 border border-border/80 shadow-xs cursor-pointer select-none",
        "border-l-4 transition-all duration-150 hover:shadow-md hover:border-primary/40",
        priorityStyle.border,
        isDragging && "opacity-20 shadow-2xl scale-[0.98] ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div
            className="p-1 -ml-1 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors rounded"
            aria-label="Drag handle"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-snug break-words">
              {task.title}
            </h4>
          </div>
        </div>

        {/* Hover action buttons */}
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            title="Edit task"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 pl-3">
          {stripHtmlPreview(task.description)}
        </p>
      )}

      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 min-w-0">
        {/* Left: Task Key & Priority */}
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {task.taskKey && (
            <a
              href={`/boards/${boardId}/${task.taskKey}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="group/key inline-flex items-center gap-1 text-[10px] font-mono font-bold text-muted-foreground/80 hover:text-foreground bg-muted/70 hover:bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider transition-colors cursor-pointer border border-transparent hover:border-border/60 shrink-0"
              title="Open task in new tab"
            >
              <span>{task.taskKey}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-40 group-hover/key:opacity-100 transition-opacity" />
            </a>
          )}

          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
              priorityStyle.badge
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", priorityStyle.dot)} />
            {priorityStyle.label}
          </span>
        </div>

        {/* Right: Due Date & Assignee */}
        <div className="flex items-center gap-1.5 shrink-0">
          {dueStatus && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                dueStatus.isOverdue
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-semibold"
                  : dueStatus.isToday
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-semibold"
                    : "text-muted-foreground"
              )}
            >
              {dueStatus.isOverdue ? (
                <AlertCircle className="w-3 h-3 text-red-500" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              <span>{dueStatus.label}</span>
            </span>
          )}

          {assignee && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="w-5 h-5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[9px] font-bold tracking-tight shrink-0 shadow-2xs hover:scale-105 transition-transform"
                  aria-label={userDisplayName(assignee)}
                >
                  {userInitials(assignee)}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-medium">{userDisplayName(assignee)}</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskCardPreview({ task }: { task: Task }) {
  const priorityStyle = PRIORITY_CONFIG[task.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const dueStatus = getDueDateStatus(task.dueDate);
  const assignee = task.assignee;

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl p-3.5 border border-border/80 shadow-2xl select-none w-72 pointer-events-none",
        "border-l-4 rotate-2 scale-105 ring-2 ring-primary/40",
        priorityStyle.border
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="p-1 -ml-1 text-muted-foreground/40 rounded">
            <GripVertical className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-snug break-words">
              {task.title}
            </h4>
          </div>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2 pl-3">
          {stripHtmlPreview(task.description)}
        </p>
      )}

      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 min-w-0">
        {/* Left: Task Key & Priority */}
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {task.taskKey && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-muted-foreground/80 bg-muted/70 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
              {task.taskKey}
            </span>
          )}

          <span
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
              priorityStyle.badge
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", priorityStyle.dot)} />
            {priorityStyle.label}
          </span>
        </div>

        {/* Right: Due Date & Assignee */}
        <div className="flex items-center gap-1.5 shrink-0">
          {dueStatus && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                dueStatus.isOverdue
                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-semibold"
                  : dueStatus.isToday
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 font-semibold"
                    : "text-muted-foreground"
              )}
            >
              {dueStatus.isOverdue ? (
                <AlertCircle className="w-3 h-3 text-red-500" />
              ) : (
                <Calendar className="w-3 h-3" />
              )}
              <span>{dueStatus.label}</span>
            </span>
          )}

          {assignee && (
            <div className="w-5 h-5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[9px] font-bold tracking-tight shrink-0 shadow-2xs">
              {userInitials(assignee)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function areTasksEqual(prev: Task, next: Task) {
  return (
    prev.id === next.id &&
    prev.taskKey === next.taskKey &&
    prev.taskNumber === next.taskNumber &&
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
