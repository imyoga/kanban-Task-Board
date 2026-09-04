import { useState, useRef, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTaskAttachments,
  useUploadTaskAttachment,
  useDeleteTaskAttachment,
  useGetAttachmentConfig,
  getListTaskAttachmentsQueryKey,
} from "@workspace/api-client-react";
import type { TaskAttachment } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  FileImage,
  FileArchive,
  FileCode,
  File as FileIcon,
  Loader2,
  Info,
} from "lucide-react";

interface Props {
  taskId?: number;
  isEdit: boolean;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function getFileIcon(mimeType: string, filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (
    mimeType.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(ext)
  ) {
    return {
      icon: FileImage,
      color: "text-indigo-500 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    };
  }

  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)
  ) {
    return {
      icon: FileText,
      color: "text-rose-500 dark:text-rose-400",
      bg: "bg-rose-500/10 dark:bg-rose-500/20",
    };
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("tar") ||
    ["zip", "tar", "gz", "rar", "7z"].includes(ext)
  ) {
    return {
      icon: FileArchive,
      color: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
    };
  }

  if (
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("xml") ||
    ["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "sql", "sh"].includes(ext)
  ) {
    return {
      icon: FileCode,
      color: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    };
  }

  return {
    icon: FileIcon,
    color: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-500/10 dark:bg-slate-500/20",
  };
}

export default function TaskAttachments({ taskId, isEdit }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Load configurable max file size from server API (with env / 100MB fallback)
  const { data: configData } = useGetAttachmentConfig();
  const envMaxMb = Number(import.meta.env.VITE_MAX_FILE_SIZE_MB || 100);
  const maxFileSizeMb = configData?.maxFileSizeMb ?? envMaxMb;
  const maxFileSizeBytes = configData?.maxFileSizeBytes ?? maxFileSizeMb * 1024 * 1024;

  // Query attachments when in edit mode
  const { data: attachments = [], isLoading: isLoadingAttachments } = useListTaskAttachments(
    taskId ?? 0,
    {
      query: {
        enabled: isEdit && !!taskId,
        queryKey: getListTaskAttachmentsQueryKey(taskId ?? 0),
      },
    },
  );

  const uploadMutation = useUploadTaskAttachment();
  const deleteMutation = useDeleteTaskAttachment();

  if (!isEdit || !taskId) {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Attachments
        </Label>
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-dashed border-border/80 bg-muted/20 text-xs text-muted-foreground">
          <Info className="w-4 h-4 text-muted-foreground/70 shrink-0" />
          <span>Save task to attach files (max {maxFileSizeMb}MB each).</span>
        </div>
      </div>
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !taskId) return;

    const fileList = Array.from(files);

    // Validate size for each file
    for (const file of fileList) {
      if (file.size > maxFileSizeBytes) {
        toast({
          title: "File too large",
          description: `"${file.name}" (${formatBytes(file.size)}) exceeds the max allowed size of ${maxFileSizeMb}MB.`,
          variant: "destructive",
        });
        return;
      }
    }

    setIsUploading(true);

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setUploadProgress(
          fileList.length > 1 ? `Uploading ${i + 1}/${fileList.length}...` : `Uploading ${file.name}...`,
        );

        await uploadMutation.mutateAsync({
          id: taskId,
          data: { file },
        });
      }

      qc.invalidateQueries({ queryKey: getListTaskAttachmentsQueryKey(taskId) });
      toast({
        title: "File attached",
        description: fileList.length === 1 ? `"${fileList[0].name}" uploaded.` : `${fileList.length} files uploaded.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload file";
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDelete(attachment: TaskAttachment) {
    if (!taskId) return;
    try {
      await deleteMutation.mutateAsync({ id: taskId, attachmentId: attachment.id });
      qc.invalidateQueries({ queryKey: getListTaskAttachmentsQueryKey(taskId) });
      toast({
        title: "Attachment deleted",
        description: `"${attachment.originalName}" was removed.`,
      });
    } catch {
      toast({
        title: "Delete failed",
        description: "Failed to delete attachment",
        variant: "destructive",
      });
    }
  }

  function handleDownload(attachment: TaskAttachment) {
    if (!taskId) return;
    const downloadUrl = `/api/tasks/${taskId}/attachments/${attachment.id}/download`;
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = attachment.originalName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  return (
    <div className="space-y-2">
      {/* Header with Title and Limit Badge */}
      <div className="flex items-center justify-between">
        <Label
          htmlFor={inputId}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
        >
          <Paperclip className="w-3.5 h-3.5 text-primary" />
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </Label>
        <span className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
          Max {maxFileSizeMb}MB
        </span>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={isUploading}
      />

      {/* Dropzone & Upload Button Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "group relative flex flex-col items-center justify-center p-3.5 rounded-xl border border-dashed transition-all cursor-pointer select-none",
          isDragging
            ? "border-primary bg-primary/10 ring-2 ring-primary/30"
            : "border-border/80 hover:border-primary/50 hover:bg-muted/30 bg-muted/15",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span>{uploadProgress || "Uploading file..."}</span>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
                <span className="text-foreground font-semibold">Click to upload</span>
                <span className="text-muted-foreground">or drag and drop files</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Attachments List */}
      {isLoadingAttachments ? (
        <div className="flex items-center justify-center py-3 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Loading attachments...
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {attachments.map((att) => {
            const iconConfig = getFileIcon(att.mimeType, att.originalName);
            const Icon = iconConfig.icon;
            const isDeleting =
              deleteMutation.isPending && deleteMutation.variables?.attachmentId === att.id;

            return (
              <div
                key={att.id}
                className="group/item flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border border-border/70 bg-card hover:bg-muted/40 transition-colors"
              >
                {/* File Icon & Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      iconConfig.bg,
                      iconConfig.color,
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-medium text-foreground truncate leading-tight"
                      title={att.originalName}
                    >
                      {att.originalName}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{formatBytes(att.size)}</span>
                      <span>•</span>
                      <span>{formatRelativeTime(att.createdAt)}</span>
                      {att.uploaderName && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[100px]">{att.uploaderName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(att);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(att);
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete attachment"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-destructive" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
