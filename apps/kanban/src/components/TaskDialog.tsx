import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateTask,
  useUpdateTask,
  useGetBoardTeam,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
  getGetBoardTeamQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { userDisplayName, userInitials } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Calendar, User, Flag, Layout, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: number;
  columns: Column[];
  defaultColumnId?: number;
  editTask?: Task | null;
}

const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    color: "text-emerald-600 dark:text-emerald-400",
    bgActive: "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold",
    dot: "bg-emerald-500",
  },
  {
    value: "medium",
    label: "Medium",
    color: "text-amber-600 dark:text-amber-400",
    bgActive: "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 font-semibold",
    dot: "bg-amber-500",
  },
  {
    value: "high",
    label: "High",
    color: "text-rose-600 dark:text-rose-400",
    bgActive: "bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-semibold",
    dot: "bg-rose-500",
  },
] as const;

export default function TaskDialog({
  open,
  onOpenChange,
  boardId,
  columns,
  defaultColumnId,
  editTask,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState<number>(defaultColumnId ?? columns[0]?.id ?? 0);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("none");

  const { data: boardTeam } = useGetBoardTeam(boardId, {
    query: { enabled: open, queryKey: getGetBoardTeamQueryKey(boardId) },
  });
  const qc = useQueryClient();
  const { toast } = useToast();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const isEdit = !!editTask;
  const uniqueColumns = useMemo(
    () =>
      columns.filter(
        (column, index, list) =>
          list.findIndex((candidate) => candidate.id === column.id) === index,
      ),
    [columns],
  );
  const teamMembers = useMemo(
    () =>
      (boardTeam?.members ?? []).filter(
        (member, index, list) =>
          list.findIndex((candidate) => candidate.userId === member.userId) === index,
      ),
    [boardTeam?.members],
  );

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setColumnId(editTask.columnId);
      setPriority(editTask.priority as "low" | "medium" | "high");
      setDueDate(editTask.dueDate ?? "");
      setAssigneeId(editTask.assigneeId ? String(editTask.assigneeId) : "none");
    } else {
      setTitle("");
      setDescription("");
      setColumnId(defaultColumnId ?? uniqueColumns[0]?.id ?? 0);
      setPriority("medium");
      setDueDate("");
      setAssigneeId("none");
    }
  }, [editTask?.id, open, defaultColumnId, uniqueColumns]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
    qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      columnId,
      priority,
      dueDate: dueDate || undefined,
      assigneeId:
        teamMembers.length > 0 && assigneeId !== "none" ? Number(assigneeId) : undefined,
    };

    if (isEdit && editTask) {
      const updatePayload = {
        ...payload,
        assigneeId: teamMembers.length > 0
          ? assigneeId === "none"
            ? null
            : Number(assigneeId)
          : undefined,
      };
      updateTask.mutate(
        { id: editTask.id, data: updatePayload },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Task updated" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
        }
      );
    } else {
      createTask.mutate(
        { data: { ...payload, boardId } },
        {
          onSuccess: () => {
            invalidate();
            toast({ title: "Task added" });
            onOpenChange(false);
          },
          onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
        }
      );
    }
  }

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            {isEdit ? "Edit Task" : "Create New Task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="text-sm font-medium h-10"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more details or acceptance criteria..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Column & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Column selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Column
              </Label>
              <Select value={String(columnId)} onValueChange={(v) => setColumnId(Number(v))}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueColumns.map((col) => (
                    <SelectItem key={col.id} value={String(col.id)}>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: col.color ?? "#6366f1" }}
                        />
                        <span>{col.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Priority
              </Label>
              <div className="grid grid-cols-3 gap-1.5 h-10">
                {PRIORITY_OPTIONS.map((opt) => {
                  const isActive = priority === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-all",
                        isActive
                          ? opt.bgActive
                          : "border-border hover:bg-muted/60 text-muted-foreground"
                      )}
                    >
                      <span className={cn("w-1.5 h-1.5 rounded-full", opt.dot)} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Assignee & Due Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignee selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignee
              </Label>
              {teamMembers.length > 0 ? (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                        <span>Unassigned</span>
                      </div>
                    </SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.userId} value={String(member.userId)}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[9px] font-bold">
                            {userInitials(member)}
                          </div>
                          <span>{userDisplayName(member)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-10 flex items-center px-3 rounded-md border border-dashed border-border text-xs text-muted-foreground bg-muted/30">
                  <span>Link board to team to assign</span>
                </div>
              )}
            </div>

            {/* Due date */}
            <div className="space-y-1.5">
              <Label htmlFor="task-due" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Due Date
              </Label>
              <div className="relative">
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 text-sm"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate("")}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title="Clear date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isPending}
              className="font-medium"
            >
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
