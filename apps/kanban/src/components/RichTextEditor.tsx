import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import UnderlineExtension from "@tiptap/extension-underline";
import TaskListExtension from "@tiptap/extension-task-list";
import TaskItemExtension from "@tiptap/extension-task-item";
import Mention from "@tiptap/extension-mention";
import MentionSuggestionList, { type MentionMember } from "./MentionSuggestionList";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  FileCode,
  Link as LinkIcon,
  Image as ImageIcon,
  AtSign,
  Undo,
  Redo,
  Maximize2,
  Trash2,
  X,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ImageSize = "S" | "M" | "L";

// Compress and convert image file to optimized base64 data URL
async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const isPng = file.type === "image/png";
        const dataUrl = canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.85);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Custom TipTap Image Node View with interactive S / M / L size switcher
function ResizableImageNodeView(props: any) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const size: ImageSize = node.attrs.size || "M";
  const src = node.attrs.src;
  const alt = node.attrs.alt || "screenshot";
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const sizeClasses = {
    S: "max-w-[220px] max-h-[220px]",
    M: "max-w-[460px] max-h-[460px]",
    L: "max-w-full w-full",
  }[size];

  return (
    <NodeViewWrapper className="image-node-view my-2 inline-block relative group/img">
      <div
        className={cn(
          "relative inline-block rounded-lg border border-border/80 bg-muted/20 overflow-hidden shadow-xs transition-all",
          selected && "ring-2 ring-primary border-primary",
          "hover:border-primary/60 hover:shadow-md"
        )}
      >
        <img
          src={src}
          alt={alt}
          className={cn("rounded-lg object-contain cursor-pointer block", sizeClasses)}
          onClick={() => setIsLightboxOpen(true)}
          loading="lazy"
        />

        {/* Floating Size Toolbar (S, M, L, Zoom, Delete) */}
        <div
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1 bg-background/95 backdrop-blur-md border border-border/90 rounded-md shadow-lg p-1 z-20 select-none transition-opacity duration-150",
            selected ? "opacity-100" : "opacity-0 group-hover/img:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wider">
            Size
          </span>
          {(["S", "M", "L"] as ImageSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateAttributes({ size: s })}
              className={cn(
                "px-2 py-0.5 text-xs font-bold rounded transition-colors",
                size === s
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted hover:bg-muted/80 text-foreground"
              )}
              title={`${s === "S" ? "Small (220px)" : s === "M" ? "Medium (460px)" : "Large (Full width)"}`}
            >
              {s}
            </button>
          ))}

          <span className="w-px h-3.5 bg-border mx-0.5" />

          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Zoom full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={deleteNode}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Remove image"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {alt && alt !== "screenshot" && alt !== "image" && (
          <div className="text-[11px] text-muted-foreground px-2 py-1 bg-background/60 border-t border-border/40 truncate">
            {alt}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={alt}
              className="max-h-[82vh] max-w-full rounded-lg object-contain shadow-2xl border border-white/10"
            />
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute -top-3 -right-3 p-1.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white shadow-lg transition-transform hover:scale-110"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// Custom Image Extension with S/M/L attribute & base64 support
const CustomImage = ImageExtension.extend({
  parseHTML() {
    return [
      {
        tag: "img[src]",
      },
    ];
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      size: {
        default: "M",
        renderHTML: (attributes) => ({
          "data-size": attributes.size || "M",
        }),
        parseHTML: (element) => element.getAttribute("data-size") || "M",
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageNodeView);
  },
});

// Strip HTML tags and base64 images for clean card snippet previews
export function stripHtmlPreview(htmlOrText: string | null | undefined): string {
  if (!htmlOrText) return "";
  return htmlOrText
    // Remove img tags and base64
    .replace(/<img[^>]*>/gi, "[Image] ")
    // Remove all HTML tags
    .replace(/<[^>]+>/g, " ")
    // Remove markdown image syntax if legacy
    .replace(/!\[.*?\]\(.*?\)/g, "[Image] ")
    // Remove common markdown tokens if legacy text was stored
    .replace(/[#*`_~]/g, "")
    // Collapse spaces
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  members?: MentionMember[];
}

interface MentionState {
  isOpen: boolean;
  command?: (item: { id: string; label: string }) => void;
  pos?: { top: number; left: number };
  items: MentionMember[];
  selectedIndex: number;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write description, notes, or paste screenshots (Ctrl+V)...",
  className,
  members,
}: RichTextEditorProps) {
  const editorRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [mentionState, setMentionState] = useState<MentionState | null>(null);

  const membersRef = useRef<MentionMember[]>(members ?? []);
  useEffect(() => {
    membersRef.current = members ?? [];
  }, [members]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-lg bg-zinc-950 text-zinc-100 p-3 my-2 font-mono text-xs overflow-x-auto",
          },
        },
      }),
      UnderlineExtension,
      TaskListExtension,
      TaskItemExtension.configure({
        nested: true,
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 hover:text-primary/80 font-medium",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CustomImage.configure({
        allowBase64: true,
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
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[160px] p-3 text-sm text-foreground [overflow-wrap:anywhere] [word-break:break-word] w-full max-w-full min-w-0 overflow-x-hidden",
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              event.preventDefault();
              setIsUploadingImage(true);
              processImageFile(file)
                .then((dataUrl) => {
                  editor?.commands.setImage({
                    src: dataUrl,
                    alt: "screenshot",
                    // @ts-ignore
                    size: "M",
                  });
                })
                .catch((err) => console.error("Error inserting pasted image:", err))
                .finally(() => setIsUploadingImage(false));
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
          if (imageFile) {
            event.preventDefault();
            setIsUploadingImage(true);
            processImageFile(imageFile)
              .then((dataUrl) => {
                editor?.commands.setImage({
                  src: dataUrl,
                  alt: imageFile.name || "uploaded image",
                  // @ts-ignore
                  size: "M",
                });
              })
              .catch((err) => console.error("Error inserting dropped image:", err))
              .finally(() => setIsUploadingImage(false));
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  editorRef.current = editor;

  // Sync external value changes when switching tasks
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Avoid resetting cursor if editor is actively focused
      if (!editor.isFocused) {
        editor.commands.setContent(value || "", { emitUpdate: false });
      }
    }
  }, [value, editor]);

  // Insert image via manual file upload button
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !editor) return;

      setIsUploadingImage(true);
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file.type.startsWith("image/")) {
            const dataUrl = await processImageFile(file);
            editor.commands.setImage({
              src: dataUrl,
              alt: file.name || "image",
              // @ts-ignore
              size: "M",
            });
          }
        }
      } catch (err) {
        console.error("Failed to upload image:", err);
      } finally {
        setIsUploadingImage(false);
        e.target.value = "";
      }
    },
    [editor]
  );

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const safeUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: safeUrl }).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "rich-text-editor flex flex-col rounded-lg border border-input bg-card shadow-xs transition-all focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/40 w-full max-w-full min-w-0 overflow-hidden",
        className
      )}
    >
      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Single MS Word-Style Top Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-border/60 bg-muted/40 rounded-t-lg select-none">
        {/* Bold */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("bold")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-bold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Bold (Ctrl+B)</TooltipContent>
        </Tooltip>

        {/* Italic */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("italic")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        {/* Underline */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("underline")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
            >
              <Underline className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Underline (Ctrl+U)</TooltipContent>
        </Tooltip>

        {/* Strikethrough */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("strike")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Strikethrough</TooltipContent>
        </Tooltip>

        <span className="w-px h-4 bg-border/80 mx-1" />

        {/* Heading 1 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("heading", { level: 1 })
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Heading 1</TooltipContent>
        </Tooltip>

        {/* Heading 2 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("heading", { level: 2 })
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Heading 2</TooltipContent>
        </Tooltip>

        {/* Heading 3 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("heading", { level: 3 })
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Heading 3</TooltipContent>
        </Tooltip>

        <span className="w-px h-4 bg-border/80 mx-1" />

        {/* Bullet List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("bulletList")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Bullet List</TooltipContent>
        </Tooltip>

        {/* Numbered List */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("orderedList")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Numbered List</TooltipContent>
        </Tooltip>

        {/* Task Checklist */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("taskList")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            >
              <ListTodo className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Checklist</TooltipContent>
        </Tooltip>

        <span className="w-px h-4 bg-border/80 mx-1" />

        {/* Blockquote */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("blockquote")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Quote className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Blockquote</TooltipContent>
        </Tooltip>

        {/* Inline Code */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("code")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Code className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Inline Code</TooltipContent>
        </Tooltip>

        {/* Code Block */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("codeBlock")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            >
              <FileCode className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Code Block</TooltipContent>
        </Tooltip>

        {/* Link */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 transition-colors",
                editor.isActive("link")
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={setLink}
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Link</TooltipContent>
        </Tooltip>

        <span className="w-px h-4 bg-border/80 mx-1" />

        {/* Upload Image Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
            >
              <ImageIcon className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Upload Image / Paste Screenshot</TooltipContent>
        </Tooltip>

        {/* Tag Teammate Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={() => {
                editor?.chain().focus().insertContent("@").run();
              }}
            >
              <AtSign className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Tag Teammate (@)</TooltipContent>
        </Tooltip>

        <span className="w-px h-4 bg-border/80 mx-1" />

        {/* Undo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            >
              <Undo className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        {/* Redo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            >
              <Redo className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </div>

      {/* Editor Content Area (Corner expandable, vertical scroll, no horizontal overflow) */}
      <div className="relative min-h-[190px] max-h-[500px] overflow-y-auto overflow-x-hidden resize-y rounded-b-lg w-full max-w-full min-w-0 [overflow-wrap:anywhere] [word-break:break-word]">
        <EditorContent editor={editor} className="cursor-text min-h-full w-full max-w-full min-w-0" />

        {isUploadingImage && (
          <div className="absolute inset-0 bg-background/70 backdrop-blur-2xs flex items-center justify-center gap-2 text-xs font-medium text-primary animate-in fade-in">
            <Upload className="w-4 h-4 animate-bounce" />
            <span>Processing image...</span>
          </div>
        )}

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

      {/* Bottom status bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-3 py-1 bg-muted/20 border-t border-border/40 text-[11px] text-muted-foreground rounded-b-lg select-none min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span>WYSIWYG Editor</span>
          <span className="text-border hidden sm:inline">•</span>
          <span className="hidden sm:inline">Paste screenshot (Ctrl+V)</span>
          <span className="text-border hidden md:inline">•</span>
          <span className="hidden md:inline">Click image for S / M / L</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/50">
            Expandable ↘
          </span>
        </div>
      </div>
    </div>
  );
}
