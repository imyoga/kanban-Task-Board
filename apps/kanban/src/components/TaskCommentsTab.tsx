import { useState, useRef, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMe, userDisplayName, userInitials } from "@/hooks/useAuth";
import { formatRelativeTime, formatExactDateTime } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  CornerDownRight,
} from "lucide-react";

interface Props {
  taskId: number;
  boardId: number;
  activeTab?: string;
}

export default function TaskCommentsTab({ taskId, boardId, activeTab }: Props) {
  const { data: currentUser } = useMe();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState("");
  const [isEditorExpanded, setIsEditorExpanded] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: comments = [], isLoading, refetch } = useListTaskComments(taskId, {
    query: {
      queryKey: getListTaskCommentsQueryKey(taskId),
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  // Re-fetch latest from database whenever tab is toggled active
  useEffect(() => {
    if (activeTab === "comments" || !activeTab) {
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

  function handleCreateComment() {
    const content = newComment.trim();
    if (!content) return;

    createComment.mutate(
      { id: taskId, data: { content } },
      {
        onSuccess: () => {
          setNewComment("");
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

  function handleStartEdit(c: TaskComment) {
    setEditingCommentId(c.id);
    setEditContent(c.content);
  }

  function handleCancelEdit() {
    setEditingCommentId(null);
    setEditContent("");
  }

  function handleSaveEdit(commentId: number) {
    const content = editContent.trim();
    if (!content) return;

    updateComment.mutate(
      { id: taskId, commentId, data: { content } },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          setEditContent("");
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
      {/* Jira-style Comment Input Box */}
      <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
          {currentInitials}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          {!isEditorExpanded ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setIsEditorExpanded(true);
                setTimeout(() => textareaRef.current?.focus(), 50);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setIsEditorExpanded(true);
                  setTimeout(() => textareaRef.current?.focus(), 50);
                }
              }}
              className="w-full min-h-[38px] px-3 py-2 rounded-md border border-input bg-background/50 hover:bg-background text-sm text-muted-foreground cursor-pointer flex items-center transition-colors"
            >
              Add a comment... (Ctrl+Enter to send)
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in-50 duration-150">
              <Textarea
                ref={textareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleCreateComment();
                  }
                }}
                placeholder="Write your comment here..."
                rows={3}
                className="resize-y min-h-[75px] text-sm bg-background w-full"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Ctrl+Enter</kbd> to save
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditorExpanded(false);
                      setNewComment("");
                    }}
                    disabled={createComment.isPending}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateComment}
                    disabled={!newComment.trim() || createComment.isPending}
                    className="h-8 text-xs font-medium gap-1.5"
                  >
                    {createComment.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Save Comment
                  </Button>
                </div>
              </div>
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
            Be the first to share notes or collaborate with your team on this task.
          </p>
        </div>
      ) : (
        <div className="space-y-3 divide-y divide-border/40">
          {comments.map((comment) => {
            const author = comment.author;
            const authorName = author ? userDisplayName(author) || author.email : "Unknown User";
            const initials = author ? userInitials(author) : "U";
            const isAuthor = currentUser?.id === comment.userId;
            const isEditing = editingCommentId === comment.id;
            const isDeleting = deletingCommentId === comment.id;
            const wasEdited =
              new Date(comment.updatedAt).getTime() - new Date(comment.createdAt).getTime() > 2000;

            return (
              <div key={comment.id} className="pt-3 first:pt-0">
                <div className="flex items-start gap-3">
                  {/* Author Avatar */}
                  <div className="w-7 h-7 rounded-full bg-secondary text-secondary-foreground border border-border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                    {initials}
                  </div>

                  {/* Comment Bubble & Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">
                          {authorName}
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
                            onClick={() => handleStartEdit(comment)}
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
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit(comment.id);
                            }
                            if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          rows={3}
                          className="text-sm bg-background w-full"
                          autoFocus
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updateComment.isPending}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveEdit(comment.id)}
                            disabled={!editContent.trim() || updateComment.isPending}
                            className="h-7 text-xs font-medium"
                          >
                            {updateComment.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                        {comment.content}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
