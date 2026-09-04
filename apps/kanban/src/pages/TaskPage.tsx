import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBoards,
  useListColumns,
  useListTasks,
  useUpdateTask,
  useDeleteTask,
  useGetBoardTeam,
  useListBoardMembers,
  getListTasksQueryKey,
  getListColumnsQueryKey,
  getGetTaskStatsQueryKey,
  getGetBoardTeamQueryKey,
  getListBoardMembersQueryKey,
} from "@workspace/api-client-react";
import type { Task, Column } from "@workspace/api-client-react";
import { useBoardIdFromRoute, useTaskKeyFromRoute } from "@/hooks/useBoardId";
import { useToast } from "@/hooks/use-toast";
import { userDisplayName, userInitials } from "@/hooks/useAuth";
import type { MentionMember } from "@/components/MentionSuggestionList";
import RichTextEditor from "@/components/RichTextEditor";
import TaskAttachments from "@/components/TaskAttachments";
import TaskCommentsTab from "@/components/TaskCommentsTab";
import TaskHistoryTab from "@/components/TaskHistoryTab";
import NotificationBell from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Check,
  Trash2,
  AlertCircle,
  MessageSquare,
  History,
  Loader2,
  Save,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExactDateTime, formatRelativeTime } from "@/lib/dateUtils";

const PRIORITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
    dot: "bg-emerald-500",
  },
  {
    value: "medium",
    label: "Medium",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
    dot: "bg-amber-500",
  },
  {
    value: "high",
    label: "High",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
    dot: "bg-rose-500",
  },
] as const;

export default function TaskPage() {
  const boardId = useBoardIdFromRoute();
  const routeTaskKey = useTaskKeyFromRoute();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<"comments" | "history">("comments");

  // Local draft states for title and description
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [hasDescChanged, setHasDescChanged] = useState(false);

  // Queries
  const { data: boards = [], isLoading: isBoardsLoading } = useListBoards();
  const { data: columns = [], isLoading: isColumnsLoading } = useListColumns(
    { boardId: boardId ?? 0 },
    {
      query: {
        enabled: !!boardId,
        queryKey: getListColumnsQueryKey({ boardId: boardId ?? 0 }),
      },
    }
  );
  const { data: tasks = [], isLoading: isTasksLoading } = useListTasks(
    { boardId: boardId ?? 0 },
    {
      query: {
        enabled: !!boardId,
        queryKey: getListTasksQueryKey({ boardId: boardId ?? 0 }),
      },
    }
  );
  const { data: boardTeam } = useGetBoardTeam(boardId ?? 0, {
    query: {
      enabled: !!boardId,
      queryKey: getGetBoardTeamQueryKey(boardId ?? 0),
    },
  });
  const { data: boardMembers = [] } = useListBoardMembers(boardId ?? 0, {
    query: {
      enabled: !!boardId,
      queryKey: getListBoardMembersQueryKey(boardId ?? 0),
    },
  });

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isLoading = isBoardsLoading || isColumnsLoading || isTasksLoading;

  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === boardId);
  }, [boards, boardId]);

  // Find task matching routeTaskKey
  const currentTask = useMemo(() => {
    if (!routeTaskKey || tasks.length === 0) return null;
    const normalized = routeTaskKey.trim().toUpperCase();

    return tasks.find((t) => {
      if (t.taskKey && t.taskKey.toUpperCase() === normalized) return true;
      const parts = normalized.split("-");
      const numStr = parts[parts.length - 1];
      const num = Number(numStr);
      if (!isNaN(num) && (t.taskNumber === num || t.id === num)) return true;
      return false;
    });
  }, [routeTaskKey, tasks]);

  // Synchronize title and description when task loads or changes
  useEffect(() => {
    if (currentTask) {
      setTitle(currentTask.title);
      setDescription(currentTask.description ?? "");
      setHasDescChanged(false);
    }
  }, [currentTask?.id, currentTask?.title, currentTask?.description]);

  const displayTaskKey = useMemo(() => {
    if (currentTask?.taskKey) return currentTask.taskKey;
    if (currentBoard?.key && currentTask) {
      return `${currentBoard.key}-${currentTask.taskNumber ?? currentTask.id}`;
    }
    return routeTaskKey ?? "";
  }, [currentTask, currentBoard?.key, routeTaskKey]);

  // Set browser tab title: [<board key>-<task number>] title ...
  useEffect(() => {
    if (currentTask) {
      const pageTitle = displayTaskKey
        ? `[${displayTaskKey}] ${currentTask.title}`
        : currentTask.title;
      document.title = pageTitle;

      // Update client DOM meta tags for client-side navigation
      const setMeta = (attr: "name" | "property", key: string, content: string) => {
        let el = document.querySelector(`meta[${attr}="${key}"]`);
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, key);
          document.head.appendChild(el);
        }
        el.setAttribute("content", content);
      };

      setMeta("property", "og:title", pageTitle);
      setMeta("name", "twitter:title", pageTitle);

      const rawDesc = currentTask.description
        ? currentTask.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        : "";
      const cleanDesc = rawDesc.length > 160 ? `${rawDesc.slice(0, 157)}...` : rawDesc;
      if (cleanDesc) {
        setMeta("name", "description", cleanDesc);
        setMeta("property", "og:description", cleanDesc);
        setMeta("name", "twitter:description", cleanDesc);
      }
    } else if (routeTaskKey && isLoading) {
      document.title = `[${routeTaskKey}] Loading task...`;
    } else if (routeTaskKey && !isLoading && !currentTask) {
      document.title = "Task Not Found | Kanban Board";
    }

    return () => {
      document.title = "Kanban Board";
    };
  }, [currentTask, displayTaskKey, routeTaskKey, isLoading]);

  // Prepare mention members for description editor
  const teamMembers = useMemo(() => {
    return (boardTeam?.members ?? []).filter(
      (m, idx, list) => list.findIndex((c) => c.userId === m.userId) === idx
    );
  }, [boardTeam?.members]);

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

  function invalidate() {
    if (boardId) {
      qc.invalidateQueries({ queryKey: getListTasksQueryKey({ boardId }) });
      qc.invalidateQueries({ queryKey: getGetTaskStatsQueryKey({ boardId }) });
    }
  }

  function handleSaveTitle() {
    if (!currentTask || !title.trim() || title.trim() === currentTask.title) {
      setIsEditingTitle(false);
      return;
    }

    updateTask.mutate(
      { id: currentTask.id, data: { title: title.trim() } },
      {
        onSuccess: () => {
          invalidate();
          setIsEditingTitle(false);
          toast({ title: "Task title updated" });
        },
        onError: () => {
          toast({ title: "Failed to update title", variant: "destructive" });
        },
      }
    );
  }

  function handleSaveDescription() {
    if (!currentTask) return;

    updateTask.mutate(
      { id: currentTask.id, data: { description: description.trim() || undefined } },
      {
        onSuccess: () => {
          invalidate();
          setHasDescChanged(false);
          toast({ title: "Description saved" });
        },
        onError: () => {
          toast({ title: "Failed to save description", variant: "destructive" });
        },
      }
    );
  }

  function handleColumnChange(newColumnId: number) {
    if (!currentTask || currentTask.columnId === newColumnId) return;

    updateTask.mutate(
      { id: currentTask.id, data: { columnId: newColumnId } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Status updated" });
        },
        onError: () => toast({ title: "Failed to update column", variant: "destructive" }),
      }
    );
  }

  function handlePriorityChange(newPriority: "low" | "medium" | "high") {
    if (!currentTask || currentTask.priority === newPriority) return;

    updateTask.mutate(
      { id: currentTask.id, data: { priority: newPriority } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Priority updated" });
        },
        onError: () => toast({ title: "Failed to update priority", variant: "destructive" }),
      }
    );
  }

  function handleAssigneeChange(val: string) {
    if (!currentTask) return;
    const newAssigneeId = val === "none" ? null : Number(val);

    updateTask.mutate(
      { id: currentTask.id, data: { assigneeId: newAssigneeId } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Assignee updated" });
        },
        onError: () => toast({ title: "Failed to update assignee", variant: "destructive" }),
      }
    );
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!currentTask) return;
    const newDueDate = e.target.value ? e.target.value : null;

    updateTask.mutate(
      { id: currentTask.id, data: { dueDate: newDueDate ?? undefined } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Due date updated" });
        },
        onError: () => toast({ title: "Failed to update due date", variant: "destructive" }),
      }
    );
  }

  function handleDeleteTask() {
    if (!currentTask) return;
    if (!confirm(`Delete task "${currentTask.title}"?`)) return;

    deleteTask.mutate(
      { id: currentTask.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Task deleted" });
          setLocation(`/boards/${boardId}`);
        },
        onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
      }
    );
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ title: "Task link copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
        <p className="text-sm text-muted-foreground">Loading task details...</p>
      </div>
    );
  }

  if (!boardId || (!currentTask && !isLoading)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Task Not Found</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          We couldn't find task <span className="font-mono font-semibold text-foreground">{routeTaskKey}</span> on this board. It may have been deleted or moved.
        </p>
        <Button asChild className="mt-5" variant="default">
          <Link href={boardId ? `/boards/${boardId}` : "/"}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Board
          </Link>
        </Button>
      </div>
    );
  }

  const taskColumn = columns.find((c) => c.id === currentTask?.columnId);
  const currentPriorityConfig =
    PRIORITY_OPTIONS.find((p) => p.value === currentTask?.priority) ?? PRIORITY_OPTIONS[1];

  return (
    <div className="flex-1 overflow-y-auto flex flex-col bg-background">
      {/* Top Header Bar */}
      <div className="border-b border-border/80 bg-background/95 backdrop-blur-sm px-6 py-3.5 shrink-0 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Merged Back to Board link */}
          <Link href={`/boards/${boardId}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground shadow-2xs cursor-pointer max-w-[220px]"
              title={`Back to ${currentBoard?.name ?? "Board"}`}
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{currentBoard?.name ?? "Board"}</span>
            </Button>
          </Link>

          <span className="text-muted-foreground/40 font-light select-none">/</span>

          {/* Task Key Pill */}
          <Badge
            variant="secondary"
            className="font-mono text-xs font-bold px-2 py-0.5 tracking-wider uppercase bg-muted text-foreground border-border/70"
          >
            {currentTask?.taskKey || routeTaskKey}
          </Badge>
        </div>

        {/* Action buttons on the right */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground shadow-2xs"
            title="Copy link to task"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteTask}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 shadow-2xs"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </Button>

          <NotificationBell />
        </div>
      </div>

      {/* Main Task Page Canvas */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Left Content Area (Columns 1-8) */}
          <div className="lg:col-span-8 space-y-6 min-w-0">
            {/* Title Section */}
            <div className="space-y-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") {
                        setTitle(currentTask?.title ?? "");
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    className="text-xl font-bold h-11"
                  />
                  <Button size="sm" onClick={handleSaveTitle} disabled={updateTask.isPending}>
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setTitle(currentTask?.title ?? "");
                      setIsEditingTitle(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight hover:text-primary transition-colors cursor-pointer group py-1 rounded-md"
                  title="Click to edit title"
                >
                  {currentTask?.title}
                </h1>
              )}
            </div>

            {/* Description & Notes Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description &amp; Notes
                </Label>
                {hasDescChanged && (
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={updateTask.isPending}
                    className="h-7 text-xs gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>Save Changes</span>
                  </Button>
                )}
              </div>
              <RichTextEditor
                id="task-page-desc"
                value={description}
                onChange={(val) => {
                  setDescription(val);
                  setHasDescChanged(true);
                }}
                placeholder="Write description, format with toolbar, or paste screenshots (Ctrl+V)..."
                members={mentionMembers}
                className="min-h-[160px]"
              />
              {hasDescChanged && (
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveDescription}
                    disabled={updateTask.isPending}
                    className="gap-1.5 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Description</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Attachments Section */}
            <div className="pt-2">
              <TaskAttachments taskId={currentTask?.id} isEdit={true} />
            </div>

            {/* Collaboration & History Section */}
            <div className="pt-4 border-t border-border/60">
              <Tabs
                value={activeBottomTab}
                onValueChange={(val) => setActiveBottomTab(val as "comments" | "history")}
                className="w-full"
              >
                <TabsList className="grid grid-cols-2 w-full max-w-xs mb-4">
                  <TabsTrigger value="comments" className="text-xs gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Comments</span>
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>History</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-0">
                  {currentTask && (
                    <TaskCommentsTab
                      taskId={currentTask.id}
                      boardId={boardId}
                      activeTab={activeBottomTab}
                      members={mentionMembers}
                    />
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-0">
                  {currentTask && (
                    <TaskHistoryTab
                      taskId={currentTask.id}
                      boardId={boardId}
                      activeTab={activeBottomTab}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          {/* Right Sidebar: Meta Properties Card (Columns 9-12) */}
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-card rounded-xl border border-border/80 p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
                Task Properties
              </h3>

              {/* Status / Column */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Status / Column</Label>
                <Select
                  value={String(currentTask?.columnId)}
                  onValueChange={(v) => handleColumnChange(Number(v))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((col) => (
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

              {/* Priority */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Priority</Label>
                <Select
                  value={currentTask?.priority ?? "medium"}
                  onValueChange={(v) => handlePriorityChange(v as "low" | "medium" | "high")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", opt.dot)} />
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Assignee</Label>
                <Select
                  value={currentTask?.assigneeId ? String(currentTask.assigneeId) : "none"}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.userId} value={String(member.userId)}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                            {userInitials(member)}
                          </div>
                          <span>{userDisplayName(member)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Due Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={currentTask?.dueDate ? currentTask.dueDate.slice(0, 10) : ""}
                    onChange={handleDueDateChange}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {/* Metadata Details */}
              <div className="pt-3 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Task Key</span>
                  <span className="font-mono font-bold text-foreground">
                    {currentTask?.taskKey || `#${currentTask?.id}`}
                  </span>
                </div>
                {currentTask?.createdAt && (
                  <div className="flex items-center justify-between">
                    <span>Created</span>
                    <span title={formatExactDateTime(currentTask.createdAt)}>
                      {formatRelativeTime(currentTask.createdAt)}
                    </span>
                  </div>
                )}
                {currentTask?.updatedAt && (
                  <div className="flex items-center justify-between">
                    <span>Updated</span>
                    <span title={formatExactDateTime(currentTask.updatedAt)}>
                      {formatRelativeTime(currentTask.updatedAt)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
