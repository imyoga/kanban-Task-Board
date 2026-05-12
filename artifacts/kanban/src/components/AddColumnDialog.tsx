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

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f59e0b", "#10b981", "#06b6d4", "#3b82f6",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function AddColumnDialog({ open, onOpenChange }: Props) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createColumn = useCreateColumn();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createColumn.mutate(
      { data: { title: title.trim(), color } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey() });
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New column</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="col-title">Title</Label>
            <Input
              id="col-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Review"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#fff" : "transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createColumn.isPending}>
              {createColumn.isPending ? "Adding..." : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
