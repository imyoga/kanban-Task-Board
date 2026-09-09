import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateTask,
  useUpdateTask,
  useGetBoardTeam,
  useListBoardMembers,
  getListTasksQueryKey,
  getGetTaskStatsQueryKey,
  getGetBoardTeamQueryKey,
  getListBoardMembersQueryKey,
  getListTaskCommentsQueryKey,
  getListTaskActivitiesQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import type { MentionMember } from "@/components/MentionSuggestionList";
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
import RichTextEditor, { optimizeDescriptionImages } from "@/components/RichTextEditor";
import TaskAttachments from "@/components/TaskAttachments";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TaskCommentsTab from "@/components/TaskCommentsTab";
import TaskHistoryTab from "@/components/TaskHistoryTab";
import { Calendar, User, Flag, Layout, X, MessageSquare, History, ExternalLink, Check, Loader2, AlertCircle } from "lucide-react";

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
  const [activeBottomTab, setActiveBottomTab] = useState<string>("comments");
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const pendingTitleRef = useRef<string | null>(null);
  const pendingDescriptionRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: boardTeam } = useGetBoardTeam(boardId, {
    query: { enabled: open, queryKey: getGetBoardTeamQueryKey(boardId) },
  });
  const { data: boardMembers = [] } = useListBoardMembers(boardId, {
    query: { enabled: open, queryKey: getListBoardMembersQueryKey(boardId) },
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

  const mentionMembers = useMemo(() => {
    const list: MentionMember[] = [];
    const seen = new Set<number>();

    for (const m of boardMembers) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        list.push({
          userId: m.userId,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
        });
      }
    }

    for (const tm of teamMembers) {
      if (!seen.has(tm.userId)) {
        seen.add(tm.userId);
        list.push({
          userId: tm.userId,
          email: tm.email,
          firstName: tm.firstName,
          lastName: tm.lastName,
        });
      }
    }

    return list;
  }, [boardMembers, teamMembers]);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
    qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
  }, [qc, boardId]);

  // Execute auto-save mutation for editing existing tasks
  const saveTaskFields = useCallback(
    async (overrides: {
      title?: string;
      description?: string;
      columnId?: number;
      priority?: "low" | "medium" | "high";
      dueDate?: string | null;
      assigneeId?: number | null;
    } = {}) => {
      if (!isEdit || !editTask) return;

      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = null;
      }
      setAutoSaveStatus("saving");

      const titleToSave = overrides.title !== undefined ? overrides.title : (pendingTitleRef.current ?? title);
      const rawDescToSave = overrides.description !== undefined ? overrides.description : (pendingDescriptionRef.current ?? description);

      pendingTitleRef.current = null;
      pendingDescriptionRef.current = null;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const cleanedDesc = rawDescToSave ? await optimizeDescriptionImages(rawDescToSave.trim()) : undefined;

      const updatePayload = {
        title: titleToSave.trim() || editTask.title,
        description: cleanedDesc || undefined,
        columnId: overrides.columnId !== undefined ? overrides.columnId : columnId,
        priority: overrides.priority !== undefined ? overrides.priority : priority,
        dueDate: overrides.dueDate !== undefined ? (overrides.dueDate || undefined) : (dueDate || undefined),
        assigneeId: overrides.assigneeId !== undefined
          ? overrides.assigneeId
          : (teamMembers.length > 0 ? (assigneeId === "none" ? null : Number(assigneeId)) : undefined),
      };

      updateTask.mutate(
        { id: editTask.id, data: updatePayload },
        {
          onSuccess: () => {
            invalidate();
            setAutoSaveStatus("saved");
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
            savedTimerRef.current = setTimeout(() => {
              setAutoSaveStatus("idle");
            }, 2000);
          },
          onError: () => {
            setAutoSaveStatus("error");
            toast({ title: "Failed to auto-save task", variant: "destructive" });
          },
        }
      );
    },
    [isEdit, editTask, title, description, columnId, priority, dueDate, assigneeId, teamMembers.length, updateTask, invalidate, toast]
  );

  const scheduleDebouncedSave = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setAutoSaveStatus("saving");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveTaskFields();
    }, 600);
  }, [saveTaskFields]);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current || pendingTitleRef.current !== null || pendingDescriptionRef.current !== null) {
      saveTaskFields();
    }
  }, [saveTaskFields]);

  const handleOpenChange = useCallback((v: boolean) => {
    if (!v && isEdit) {
      flushPendingSave();
    }
    onOpenChange(v);
  }, [isEdit, flushPendingSave, onOpenChange]);

  // Field change handlers
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (isEdit && editTask) {
      pendingTitleRef.current = newTitle;
      scheduleDebouncedSave();
    }
  };

  const handleDescriptionChange = (newDesc: string) => {
    setDescription(newDesc);
    if (isEdit && editTask) {
      pendingDescriptionRef.current = newDesc;
      scheduleDebouncedSave();
    }
  };

  const handleColumnChange = (newColId: number) => {
    setColumnId(newColId);
    if (isEdit && editTask) {
      saveTaskFields({ columnId: newColId });
    }
  };

  const handlePriorityChange = (newPriority: "low" | "medium" | "high") => {
    setPriority(newPriority);
    if (isEdit && editTask) {
      saveTaskFields({ priority: newPriority });
    }
  };

  const handleAssigneeChange = (newAssigneeId: string) => {
    setAssigneeId(newAssigneeId);
    if (isEdit && editTask) {
      saveTaskFields({
        assigneeId: teamMembers.length > 0
          ? newAssigneeId === "none"
            ? null
            : Number(newAssigneeId)
          : undefined,
      });
    }
  };

  const handleDueDateChange = (newDueDate: string) => {
    setDueDate(newDueDate);
    if (isEdit && editTask) {
      saveTaskFields({ dueDate: newDueDate || null });
    }
  };

  // Initialize form fields only when dialog opens or the target task changes
  useEffect(() => {
    if (!open) return;

    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description ?? "");
      setColumnId(editTask.columnId);
      setPriority((editTask.priority as "low" | "medium" | "high") || "medium");
      setDueDate(editTask.dueDate ?? "");
      setAssigneeId(editTask.assigneeId ? String(editTask.assigneeId) : "none");
      setActiveBottomTab("comments");
      setAutoSaveStatus("idle");
      pendingTitleRef.current = null;
      pendingDescriptionRef.current = null;
      // Refetch comments and history for fresh data
      qc.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(editTask.id) });
      qc.invalidateQueries({ queryKey: getListTaskActivitiesQueryKey(editTask.id) });
    } else {
      setTitle("");
      setDescription("");
      setColumnId(defaultColumnId ?? uniqueColumns[0]?.id ?? 0);
      setPriority("medium");
      setDueDate("");
      setAssigneeId("none");
      setActiveBottomTab("comments");
      setAutoSaveStatus("idle");
      pendingTitleRef.current = null;
      pendingDescriptionRef.current = null;
    }
  }, [open, editTask?.id]);

  // Set fallback columnId for a new task when columns load asynchronously, without resetting user input
  useEffect(() => {
    if (open && !editTask && columnId === 0 && uniqueColumns.length > 0) {
      setColumnId(defaultColumnId ?? uniqueColumns[0]?.id ?? 0);
    }
  }, [open, editTask, columnId, defaultColumnId, uniqueColumns]);

  function handleBottomTabChange(val: string) {
    setActiveBottomTab(val);
    if (!editTask) return;
    if (val === "comments") {
      qc.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(editTask.id) });
    } else if (val === "history") {
      qc.invalidateQueries({ queryKey: getListTaskActivitiesQueryKey(editTask.id) });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEdit && editTask) {
      // Manual submit flushes auto-save if triggered via Enter
      flushPendingSave();
      return;
    }

    const cleanedDescription = await optimizeDescriptionImages(description.trim());

    const payload = {
      title: title.trim(),
      description: cleanedDescription || undefined,
      columnId,
      priority,
      dueDate: dueDate || undefined,
      assigneeId:
        teamMembers.length > 0 && assigneeId !== "none" ? Number(assigneeId) : undefined,
    };

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

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full max-w-[calc(100vw-2rem)] max-h-[92vh] overflow-y-auto overflow-x-hidden p-6 pt-0">
        <DialogHeader className="sticky top-0 z-20 pt-6 pb-3 -mx-6 px-6 bg-background/95 backdrop-blur-md border-b border-border/50 flex flex-row items-center justify-between gap-4">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            {isEdit ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          
          <div className="flex items-center gap-3">
            {isEdit && autoSaveStatus !== "idle" && (
              <div className="flex items-center gap-1.5 text-xs font-medium transition-opacity">
                {autoSaveStatus === "saving" && (
                  <span className="flex items-center gap-1 text-muted-foreground animate-in fade-in duration-150">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    <span>Saving...</span>
                  </span>
                )}
                {autoSaveStatus === "saved" && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-150 font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved</span>
                  </span>
                )}
                {autoSaveStatus === "error" && (
                  <button
                    type="button"
                    onClick={() => saveTaskFields()}
                    className="flex items-center gap-1 text-rose-600 dark:text-rose-400 hover:underline animate-in fade-in duration-150"
                    title="Click to retry saving"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Failed to save (retry)</span>
                  </button>
                )}
              </div>
            )}

            {isEdit && editTask?.taskKey && (
              <div className="flex items-center gap-2">
                <a
                  href={`/boards/${boardId}/${editTask.taskKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/key inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/60 transition-colors shadow-2xs select-none"
                  title="Open task in dedicated tab"
                >
                  <span>{editTask.taskKey}</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover/key:text-foreground transition-colors" />
                </a>
              </div>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 w-full max-w-full min-w-0">
          {/* Title */}
          <div className="space-y-1.5 w-full max-w-full min-w-0">
            <Label htmlFor="task-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Task Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={() => {
                if (isEdit) flushPendingSave();
              }}
              placeholder="What needs to be done?"
              className="text-sm font-medium h-10 w-full min-w-0"
              autoFocus
              required
            />
          </div>

          {/* Description - MS Word style WYSIWYG Editor */}
          <div className="space-y-1.5 w-full max-w-full min-w-0">
            <Label htmlFor="task-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description &amp; Notes
            </Label>
            <RichTextEditor
              id="task-desc"
              value={description}
              onChange={handleDescriptionChange}
              onBlur={() => {
                if (isEdit) flushPendingSave();
              }}
              placeholder="Write description, format with toolbar, or paste screenshots (Ctrl+V)..."
              className="w-full max-w-full min-w-0"
              members={mentionMembers}
            />
          </div>

          {/* Attachments Section */}
          <div className="w-full max-w-full min-w-0">
            <TaskAttachments taskId={editTask?.id} isEdit={isEdit} />
          </div>

          {/* Column & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
            {/* Column selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Column
              </Label>
              <Select value={String(columnId)} onValueChange={(v) => handleColumnChange(Number(v))}>
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
                      onClick={() => handlePriorityChange(opt.value)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
            {/* Assignee selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assignee
              </Label>
              {teamMembers.length > 0 ? (
                <Select value={assigneeId} onValueChange={handleAssigneeChange}>
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
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="h-10 text-sm"
                />
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => handleDueDateChange("")}
                    className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    title="Clear date"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Comments & History Tabs at bottom of Task Modal */}
          {isEdit && editTask && (
            <div className="pt-4 border-t border-border/60 w-full max-w-full min-w-0">
              <Tabs value={activeBottomTab} onValueChange={handleBottomTabChange} className="w-full">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <TabsList className="grid grid-cols-2 w-full max-w-[260px] h-8">
                    <TabsTrigger value="comments" className="flex items-center gap-1.5 text-xs py-1">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" />
                      <span>Comments</span>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs py-1">
                      <History className="w-3.5 h-3.5 text-primary" />
                      <span>History</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="comments" className="mt-3 focus-visible:outline-none">
                  <TaskCommentsTab
                    taskId={editTask.id}
                    boardId={boardId}
                    activeTab={activeBottomTab}
                    members={mentionMembers}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-3 focus-visible:outline-none">
                  <TaskHistoryTab taskId={editTask.id} boardId={boardId} activeTab={activeBottomTab} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {!isEdit && (
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
                {isPending ? "Saving..." : "Create Task"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
