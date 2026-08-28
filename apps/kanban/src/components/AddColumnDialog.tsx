import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateColumn, getListColumnsQueryKey } from "@workspace/api-client-react";
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
import { useToast } from "@/hooks/use-toast";
import { Columns3 } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boardId: number;
}

export default function AddColumnDialog({ open, onOpenChange, boardId }: Props) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createColumn = useCreateColumn();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createColumn.mutate(
      { data: { title: title.trim(), color, boardId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId }) });
          toast({ title: "Column added" });
          setTitle("");
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to add column", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-6">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Columns3 className="w-5 h-5 text-primary" />
            New Column
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="col-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Column Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="col-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. In Review, QA, Blocked..."
              className="h-10 text-sm font-medium"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Accent Color
            </Label>
            <div className="flex gap-2.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#fff" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                  }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createColumn.isPending}>
              {createColumn.isPending ? "Adding..." : "Add Column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
