import { useEffect } from "react";
import { useListTaskActivities, getListTaskActivitiesQueryKey } from "@workspace/api-client-react";
import type { TaskActivity } from "@workspace/api-client-react";
import { formatRelativeTime, formatExactDateTime } from "@/lib/dateUtils";
import { userDisplayName, userInitials } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  History,
  FileText,
  Paperclip,
  MessageSquare,
  User,
  Calendar,
  Flag,
  ArrowRightLeft,
  PlusCircle,
  Activity,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface Props {
  taskId: number;
  boardId: number;
  activeTab?: string;
}

function getActivityIcon(activity: TaskActivity) {
  const { action, field } = activity;

  if (action === "task_created") {
    return <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />;
  }
  if (field === "description") {
    return <FileText className="w-3.5 h-3.5 text-blue-500" />;
  }
  if (field === "attachment" || action.startsWith("attachment_")) {
    return <Paperclip className="w-3.5 h-3.5 text-teal-500" />;
  }
  if (field === "comment" || action.startsWith("comment_")) {
    return <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />;
  }
  if (field === "assignee") {
    return <User className="w-3.5 h-3.5 text-amber-500" />;
  }
  if (field === "dueDate") {
    return <Calendar className="w-3.5 h-3.5 text-purple-500" />;
  }
  if (field === "priority") {
    return <Flag className="w-3.5 h-3.5 text-rose-500" />;
  }
  if (field === "column" || action === "task_moved") {
    return <ArrowRightLeft className="w-3.5 h-3.5 text-sky-500" />;
  }
  return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function TaskHistoryTab({ taskId, boardId, activeTab }: Props) {
  const { data: activities = [], isLoading, refetch } = useListTaskActivities(taskId, {
    query: {
      queryKey: getListTaskActivitiesQueryKey(taskId),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  // Re-fetch latest from database whenever tab is toggled active
  useEffect(() => {
    if (activeTab === "history" || !activeTab) {
      refetch();
    }
  }, [activeTab, taskId, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-border/60 rounded-lg bg-muted/10">
        <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
          <History className="w-5 h-5 opacity-60" />
        </div>
        <p className="text-sm font-medium text-foreground">No history yet</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Changes to this task, files, comments, and status will be recorded here.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-4 pt-1 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border/70">
      {activities.map((item) => {
        const user = item.user;
        const userName = user ? userDisplayName(user) || user.email : "Unknown User";
        const initials = user ? userInitials(user) : "U";

        return (
          <div key={item.id} className="relative group">
            {/* Timeline node icon */}
            <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center shadow-xs">
              {getActivityIcon(item)}
            </div>

            <div className="text-xs text-foreground/90 leading-relaxed">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* User badge */}
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-bold">
                    {initials}
                  </div>
                  <span className="font-semibold text-foreground">{userName}</span>
                </div>

                {/* Action message */}
                <span className="text-muted-foreground font-normal">{item.message}</span>

                {/* Relative timestamp */}
                <span
                  className="text-[11px] text-muted-foreground/80 ml-auto"
                  title={formatExactDateTime(item.createdAt)}
                >
                  {formatRelativeTime(item.createdAt)}
                </span>
              </div>

              {/* Value diff pill if oldValue and newValue exist */}
              {item.oldValue && item.newValue && item.field !== "comment" && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground line-through decoration-muted-foreground/50 max-w-[200px] truncate">
                    {item.oldValue}
                  </span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20 max-w-[200px] truncate">
                    {item.newValue}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
