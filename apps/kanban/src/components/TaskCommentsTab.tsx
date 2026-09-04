import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTaskComments,
  useCreateTaskComment,
  useUpdateTaskComment,
  useDeleteTaskComment,
  getListTaskCommentsQueryKey,
  getListTaskActivitiesQueryKey,
} from "@workspace/api-client-react";
import type { TaskComment } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useMe, userDisplayName, userInitials } from "@/hooks/useAuth";
import { formatRelativeTime, formatExactDateTime } from "@/lib/dateUtils";
import { MessageSquare, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import type { MentionMember } from "./MentionSuggestionList";
import CommentEditor from "./CommentEditor";

interface Props {
  taskId: number;
  boardId: number;
  activeTab?: string;
  members?: MentionMember[];
}

function renderCommentContent(content: string) {
  if (!content) return null;

  // If HTML format (e.g. from TipTap CommentEditor)
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5 [&_p]:leading-relaxed text-sm text-foreground/90 break-words"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  // Legacy markdown or plain text with mentions: @[Name](userId) or @Name
  const parts = content.split(/(@\[[^\]]+\]\(\d+\)|@[a-zA-Z0-9._-]+(?:@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)?)/g);

  return (
    <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
      {parts.map((part, i) => {
        const mdMatch = part.match(/^@\[([^\]]+)\]\(\d+\)$/);
        if (mdMatch) {
          return (
            <span
              key={i}
              className="mention-badge inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md text-xs select-none mx-0.5"
            >
              @{mdMatch[1]}
            </span>
          );
        }
        if (part.startsWith("@") && part.length > 1) {
          return (
            <span
              key={i}
              className="mention-badge inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md text-xs select-none mx-0.5"
            >
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

export default function TaskCommentsTab({ taskId, boardId, activeTab, members = [] }: Props) {
  const { data: currentUser } = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

  const {
    data: comments = [],
    isLoading,
    refetch,
  } = useListTaskComments(taskId, {
    query: {
      enabled: activeTab === "comments",
      queryKey: getListTaskCommentsQueryKey(taskId),
    },
  });

  useEffect(() => {
    if (activeTab === "comments") {
      refetch();
    }
  }, [activeTab, taskId, refetch]);

  const createComment = useCreateTaskComment();
  const updateComment = useUpdateTaskComment();
  const deleteComment = useDeleteTaskComment();

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListTaskCommentsQueryKey(taskId) });
    qc.invalidateQueries({ queryKey: getListTaskActivitiesQueryKey(taskId) });
  }

  function handleCreateComment(html: string) {
    createComment.mutate(
      { id: taskId, data: { content: html } },
      {
        onSuccess: () => {
          setIsEditorExpanded(false);
          invalidate();
          toast({ title: "Comment added" });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to post comment",
            description: err?.message || "Please try again",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleSaveEdit(commentId: number, html: string) {
    updateComment.mutate(
      { id: taskId, commentId, data: { content: html } },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          invalidate();
          toast({ title: "Comment updated" });
        },
        onError: (err: any) => {
          toast({
            title: "Failed to update comment",
            description: err?.message || "Please try again",
            variant: "destructive",
          });
        },
      }
    );
  }

  function handleDeleteComment(commentId: number) {
    deleteComment.mutate(
      { id: taskId, commentId },
      {
        onSuccess: () => {
          setDeletingCommentId(null);
          invalidate();
          toast({ title: "Comment deleted" });
        },
        onError: (err: any) => {
          setDeletingCommentId(null);
          toast({
            title: "Failed to delete comment",
            description: err?.message || "Please try again",
            variant: "destructive",
          });
        },
      }
    );
  }

  const currentInitials = currentUser ? userInitials(currentUser) : "U";

  return (
    <div className="space-y-4 pt-1">
      {/* Modern Comment Input Box */}
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
          {currentInitials}
        </div>
        <div className="flex-1 min-w-0">
          {!isEditorExpanded ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsEditorExpanded(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setIsEditorExpanded(true);
                }
              }}
              className="w-full min-h-[38px] px-3 py-2 rounded-md border border-input bg-background/50 hover:bg-background text-sm text-muted-foreground cursor-pointer flex items-center transition-colors"
            >
              Add a comment... (Ctrl+Enter to send)
            </div>
          ) : (
            <div className="animate-in fade-in-50 duration-150">
              <CommentEditor
                placeholder="Add a comment... (Ctrl+Enter to send)"
                members={members}
                onSubmit={handleCreateComment}
                onCancel={() => setIsEditorExpanded(false)}
                isSubmitting={createComment.isPending}
                submitLabel="Save Comment"
                autoFocus
              />
            </div>
          )}
        </div>
      </div>

      {/* Comment Thread List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading comments...</span>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-border/60 rounded-lg bg-muted/10">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-2">
            <MessageSquare className="w-5 h-5 opacity-60" />
          </div>
          <p className="text-sm font-medium text-foreground">No comments yet</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Be the first to leave a comment on this task.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isAuthor = currentUser?.id === comment.userId;
            const isEditing = editingCommentId === comment.id;
            const isDeleting = deletingCommentId === comment.id;
            const authorObj = comment.author ?? { email: "", firstName: "", lastName: "" };
            const initials = userInitials(authorObj);
            const displayName = userDisplayName(authorObj);
            const wasEdited = Boolean(comment.updatedAt && comment.updatedAt !== comment.createdAt);

            return (
              <div
                key={comment.id}
                className="group flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3.5 transition-colors hover:border-border"
              >
                {/* User Avatar Initials */}
                <div
                  className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                  title={displayName}
                >
                  {initials}
                </div>

                {/* Comment Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="text-xs font-semibold text-foreground">
                        {displayName}
                      </span>
                      <span
                        className="text-[11px] text-muted-foreground"
                        title={formatExactDateTime(comment.createdAt)}
                      >
                        {formatRelativeTime(comment.createdAt)}
                      </span>
                      {wasEdited && (
                        <span
                          className="text-[10px] text-muted-foreground/75 italic"
                          title={`Edited at ${formatExactDateTime(comment.updatedAt)}`}
                        >
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Actions for author */}
                    {isAuthor && !isEditing && (
                      <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(comment.id);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit comment"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isDeleting ? (
                          <div className="flex items-center gap-1 bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/30 animate-in fade-in">
                            <span className="text-[10px] text-destructive font-medium">Delete?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              disabled={deleteComment.isPending}
                              className="text-destructive hover:font-bold p-0.5"
                              title="Confirm delete"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCommentId(null)}
                              className="text-muted-foreground hover:text-foreground p-0.5"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeletingCommentId(comment.id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Comment Content or Edit Box */}
                  {isEditing ? (
                    <div className="mt-2 animate-in fade-in-50 duration-150">
                      <CommentEditor
                        initialContent={comment.content}
                        members={members}
                        onSubmit={(html) => handleSaveEdit(comment.id, html)}
                        onCancel={() => setEditingCommentId(null)}
                        isSubmitting={updateComment.isPending}
                        submitLabel="Save"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="mt-1">
                      {renderCommentContent(comment.content)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
