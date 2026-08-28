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
import { userDisplayName } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: number;
  columns: Column[];
  defaultColumnId?: number;
  editTask?: Task | null;
}

export default function TaskDialog({ open, onOpenChange, boardId, columns, defaultColumnId, editTask }: Props) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Column</Label>
              <Select value={String(columnId)} onValueChange={v => setColumnId(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {uniqueColumns.map(col => (
                    <SelectItem key={col.id} value={String(col.id)}>
                      {col.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={v => setPriority(v as "low" | "medium" | "high")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {teamMembers.map(member => (
                    <SelectItem key={member.userId} value={String(member.userId)}>
                      {userDisplayName(member)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isPending}>
              {isPending ? "Saving..." : isEdit ? "Save changes" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
