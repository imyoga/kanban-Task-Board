import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListNotifications,
  useMarkAllNotificationsRead,
  useUpdateNotificationReadStatus,
  getListNotificationsQueryKey,
  getGetUnreadNotificationsCountQueryKey,
} from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/dateUtils";
import { userInitials } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Bell,
  CheckCheck,
  Check,
  Layout,
  ExternalLink,
  MessageSquare,
  FileText,
  Inbox,
  Loader2,
} from "lucide-react";

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Highlights @mention tokens in comment/description text snippet.
 */
function renderSnippetWithMentions(snippet: string) {
  if (!snippet) return null;
  // Match @[Name](id) or @Name
  const parts = snippet.split(/(@\[[^\]]+\]\(\d+\)|@[a-zA-Z0-9._-]+(?:@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)?)/g);

  return parts.map((part, i) => {
    const mdMatch = part.match(/^@\[([^\]]+)\]\(\d+\)$/);
    if (mdMatch) {
      return (
        <span
          key={i}
          className="inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1 py-0.2 rounded text-[11px] select-none mx-0.5"
        >
          @{mdMatch[1]}
        </span>
      );
    }
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span
          key={i}
          className="inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1 py-0.2 rounded text-[11px] select-none mx-0.5"
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function NotificationsModal({
  open,
  onOpenChange,
}: NotificationsModalProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useListNotifications(undefined, {
    query: {
      enabled: open,
      queryKey: getListNotificationsQueryKey(),
      refetchInterval: open ? 10_000 : false,
    },
  });

  const markAllRead = useMarkAllNotificationsRead();
  const updateReadStatus = useUpdateNotificationReadStatus();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetUnreadNotificationsCountQueryKey() });
  }

  function handleMarkAllAsRead() {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        invalidate();
      },
    });
  }

  function handleToggleRead(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    updateReadStatus.mutate(
      { id: n.id, data: { isRead: !n.isRead } },
      {
        onSuccess: () => {
          invalidate();
        },
      },
    );
  }

  function handleNotificationClick(n: Notification) {
    if (!n.isRead) {
      updateReadStatus.mutate({ id: n.id, data: { isRead: true } }, { onSuccess: invalidate });
    }
    onOpenChange(false);
    // Navigate directly to board and specific task key
    setLocation(`/boards/${n.boardId}/${n.taskKey}`);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl w-full max-w-[calc(100vw-2rem)] max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border/70 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <Badge variant="default" className="text-[11px] px-1.5 py-0 h-5 font-bold">
                    {unreadCount} new
                  </Badge>
                )}
              </DialogTitle>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={markAllRead.isPending}
                className="h-8 text-xs font-medium gap-1.5 text-muted-foreground hover:text-foreground"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Tabs Filter Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-border/40 bg-muted/20 flex items-center justify-between">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as "all" | "unread")}
            className="w-full"
          >
            <TabsList className="grid grid-cols-2 w-[180px] h-8 p-0.5">
              <TabsTrigger value="all" className="text-xs py-1">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="text-xs py-1">
                Unread ({unreadCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notifications List Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[260px] max-h-[58vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span>Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                <Inbox className="w-6 h-6 opacity-60" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {activeTab === "unread" ? "All caught up!" : "No notifications yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {activeTab === "unread"
                  ? "You have no unread notifications right now."
                  : "When your team members tag you with @ in task descriptions or comments, you will see them here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const actor = n.actor;
              const actorName =
                [actor?.firstName, actor?.lastName].filter(Boolean).join(" ").trim() ||
                actor?.email ||
                "Teammate";
              const initials = actor ? userInitials(actor) : "T";
              const isComment = n.type === "mention_comment";

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }
                  }}
                  className={cn(
                    "group relative p-3.5 rounded-xl border transition-all text-left cursor-pointer flex gap-3",
                    n.isRead
                      ? "border-border/60 bg-card hover:bg-muted/40 text-muted-foreground"
                      : "border-primary/40 bg-primary/[0.04] dark:bg-primary/[0.08] shadow-xs hover:bg-primary/[0.07] text-foreground border-l-4 border-l-primary",
                  )}
                >
                  {/* Unread indicator dot */}
                  {!n.isRead && (
                    <span
                      className="absolute right-3 top-3 w-2 h-2 rounded-full bg-primary"
                      title="Unread"
                    />
                  )}

                  {/* Actor Avatar */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border mt-0.5",
                      !n.isRead
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-foreground border-border/80",
                    )}
                  >
                    {initials}
                  </div>

                  {/* Content Body */}
                  <div className="flex-1 min-w-0 pr-4 space-y-1">
                    {/* Header line: Actor name + context + timestamp */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="font-semibold text-foreground">
                        {actorName}
                      </span>
                      <span className="text-muted-foreground">tagged you in</span>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4.5 gap-1 font-medium bg-background/80"
                      >
                        {isComment ? (
                          <MessageSquare className="w-2.5 h-2.5 text-primary" />
                        ) : (
                          <FileText className="w-2.5 h-2.5 text-primary" />
                        )}
                        <span>{isComment ? "comment" : "description"}</span>
                      </Badge>
                      <span className="text-muted-foreground/60 text-[11px] ml-auto">
                        {formatRelativeTime(n.createdAt)}
                      </span>
                    </div>

                    {/* Board & Task context pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span className="text-[11px] font-semibold text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Layout className="w-3 h-3" />
                        {n.boardName}
                      </span>
                      <span className="text-[11px] font-semibold text-foreground/80 bg-muted px-1.5 py-0.5 rounded truncate max-w-[280px]">
                        {n.taskKey}: {n.taskTitle}
                      </span>
                    </div>

                    {/* Snippet / preview */}
                    <div className="text-xs text-foreground/90 bg-background/60 dark:bg-background/40 p-2 rounded-lg border border-border/40 mt-1.5 break-words line-clamp-2">
                      {renderSnippetWithMentions(n.content)}
                    </div>

                    {/* Footer / Actions */}
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-primary font-medium flex items-center gap-1 group-hover:underline">
                        <span>Open task</span>
                        <ExternalLink className="w-3 h-3" />
                      </span>

                      <button
                        type="button"
                        onClick={(e) => handleToggleRead(e, n)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                        title={n.isRead ? "Mark as unread" : "Mark as read"}
                      >
                        <Check className="w-3 h-3" />
                        <span>{n.isRead ? "Mark unread" : "Mark read"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
