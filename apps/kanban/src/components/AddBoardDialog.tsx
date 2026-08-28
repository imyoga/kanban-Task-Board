import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateBoard, getListBoardsQueryKey, getListColumnsQueryKey } from "@workspace/api-client-react";
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
import { useLocation } from "wouter";
import { LayoutDashboard } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function AddBoardDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const createBoard = useCreateBoard();
  const [, setLocation] = useLocation();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createBoard.mutate(
      { data: { name: name.trim() || "Untitled board" } },
      {
        onSuccess: (board) => {
          qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
          qc.invalidateQueries({ queryKey: getListColumnsQueryKey({ boardId: board.id }) });
          toast({ title: "Board created" });
          setName("");
          onOpenChange(false);
          setLocation(`/boards/${board.id}`);
        },
        onError: () => toast({ title: "Failed to create board", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-6">
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-primary" />
            New Board
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="board-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Board Name
            </Label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Product Roadmap, Sprint 24..."
              className="h-10 text-sm font-medium"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBoard.isPending}>
              {createBoard.isPending ? "Creating..." : "Create Board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
