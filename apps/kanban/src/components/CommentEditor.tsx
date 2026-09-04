import React, { useRef, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import MentionSuggestionList, { type MentionMember } from "./MentionSuggestionList";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommentEditorProps {
  initialContent?: string;
  placeholder?: string;
  members?: MentionMember[];
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  autoFocus?: boolean;
  className?: string;
}

interface MentionState {
  isOpen: boolean;
  command?: (item: { id: string; label: string }) => void;
  pos?: { top: number; left: number };
  items: MentionMember[];
  selectedIndex: number;
}

export default function CommentEditor({
  initialContent = "",
  placeholder = "Add a comment...",
  members = [],
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save Comment",
  autoFocus = false,
  className,
}: CommentEditorProps) {
  const [mentionState, setMentionState] = useState<MentionState | null>(null);
  const editorRef = useRef<any>(null);
  const membersRef = useRef<MentionMember[]>(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Mention.configure({
        HTMLAttributes: {
          class:
            "mention-badge inline-flex items-center font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md text-xs select-none mx-0.5",
        },
        suggestion: {
          char: "@",
          allowSpaces: true,
          allowedPrefixes: null,
          items: ({ query }: { query: string }) => {
            const list = membersRef.current || [];
            const q = query.toLowerCase().trim();
            if (!q) return list.slice(0, 8);
            return list
              .filter((m) => {
                const name = `${m.firstName || ""} ${m.lastName || ""}`.toLowerCase().trim();
                return name.includes(q) || m.email.toLowerCase().includes(q);
              })
              .slice(0, 8);
          },
          render: () => {
            const getCoords = (props: any) => {
              let rect: DOMRect | null | undefined = null;
              try {
                if (typeof props.clientRect === "function") {
                  rect = props.clientRect();
                }
              } catch (e) {}

              if (rect && rect.top > 0 && rect.bottom > 0) {
                return { top: rect.bottom, left: rect.left };
              }

              try {
                const view = editorRef.current?.view;
                if (view) {
                  const from = view.state.selection.from;
                  const coords = view.coordsAtPos(from);
                  if (coords && coords.top > 0) {
                    return { top: coords.bottom, left: coords.left };
                  }
                }
              } catch (e) {}

              return undefined;
            };

            return {
              onStart: (props: any) => {
                const pos = getCoords(props);
                const currentItems =
                  props.items && props.items.length > 0
                    ? props.items
                    : membersRef.current?.slice(0, 8) || [];
                setMentionState({
                  isOpen: true,
                  command: props.command,
                  pos,
                  items: currentItems,
                  selectedIndex: 0,
                });
              },
              onUpdate: (props: any) => {
                const pos = getCoords(props);
                const currentItems =
                  props.items && props.items.length > 0
                    ? props.items
                    : membersRef.current?.slice(0, 8) || [];
                setMentionState((prev) =>
                  prev
                    ? {
                        ...prev,
                        command: props.command,
                        pos: pos || prev.pos,
                        items: currentItems,
                        selectedIndex: 0,
                      }
                    : null,
                );
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "ArrowUp") {
                  setMentionState((prev) => {
                    if (!prev || prev.items.length === 0) return prev;
                    return {
                      ...prev,
                      selectedIndex:
                        (prev.selectedIndex + prev.items.length - 1) % prev.items.length,
                    };
                  });
                  return true;
                }
                if (props.event.key === "ArrowDown") {
                  setMentionState((prev) => {
                    if (!prev || prev.items.length === 0) return prev;
                    return {
                      ...prev,
                      selectedIndex: (prev.selectedIndex + 1) % prev.items.length,
                    };
                  });
                  return true;
                }
                if (props.event.key === "Enter" || props.event.key === "Tab") {
                  let handled = false;
                  setMentionState((prev) => {
                    if (prev && prev.items.length > 0) {
                      const selected = prev.items[prev.selectedIndex];
                      if (selected) {
                        const fullName =
                          [selected.firstName, selected.lastName].filter(Boolean).join(" ").trim() ||
                          selected.email;
                        prev.command?.({ id: String(selected.userId), label: fullName });
                        handled = true;
                      }
                    }
                    return null;
                  });
                  return handled;
                }
                if (props.event.key === "Escape") {
                  setMentionState(null);
                  return true;
                }
                return false;
              },
              onExit: () => {
                setMentionState(null);
              },
            };
          },
        },
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[64px] max-h-[220px] overflow-y-auto px-3 py-2 text-sm text-foreground [overflow-wrap:anywhere] [word-break:break-word] w-full",
      },
      handleKeyDown: (view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          handleSubmit();
          return true;
        }
        if (event.key === "Escape" && onCancel) {
          event.preventDefault();
          onCancel();
          return true;
        }
        return false;
      },
    },
    autofocus: autoFocus,
  });

  editorRef.current = editor;

  // Sync content when initialContent changes (e.g. starting edit)
  useEffect(() => {
    if (editor && initialContent !== editor.getHTML()) {
      editor.commands.setContent(initialContent || "", { emitUpdate: false });
    }
  }, [initialContent, editor]);

  const handleSubmit = useCallback(() => {
    if (!editor || isSubmitting) return;
    const text = editor.getText().trim();
    if (!text) return;
    const html = editor.getHTML();
    onSubmit(html);
  }, [editor, isSubmitting, onSubmit]);

  const isEmpty = !editor || !editor.getText().trim();

  return (
    <div
      className={cn(
        "rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent transition-all shadow-2xs overflow-hidden",
        className,
      )}
    >
      <div className="relative min-w-0">
        <EditorContent editor={editor} className="cursor-text" />

        {mentionState?.isOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: mentionState.pos?.top
                  ? Math.min(window.innerHeight - 250, Math.max(10, mentionState.pos.top + 6))
                  : 220,
                left: mentionState.pos?.left
                  ? Math.min(window.innerWidth - 270, Math.max(16, mentionState.pos.left))
                  : 240,
                zIndex: 999999,
              }}
              className="pointer-events-auto shadow-2xl"
            >
              <MentionSuggestionList
                members={mentionState.items}
                selectedIndex={mentionState.selectedIndex}
                onSelect={(member) => {
                  const fullName =
                    [member.firstName, member.lastName].filter(Boolean).join(" ").trim() ||
                    member.email;
                  mentionState.command?.({ id: String(member.userId), label: fullName });
                  setMentionState(null);
                  editor?.commands.focus();
                }}
              />
            </div>,
            document.body,
          )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-end gap-2 px-3 py-2 bg-muted/20 border-t border-border/40">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-8 text-xs"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={isEmpty || isSubmitting}
          className="h-8 text-xs font-medium gap-1.5"
        >
          {isSubmitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
