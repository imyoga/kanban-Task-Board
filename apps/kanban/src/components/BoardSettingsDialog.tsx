import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateBoard,
  useDeleteBoard,
  getListBoardsQueryKey,
} from "@workspace/api-client-react";
import type { Board } from "@workspace/api-client-react";
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

interface Props {
  board: Board;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}

export default function BoardSettingsDialog({ board, open, onOpenChange, onDeleted }: Props) {
  const [name, setName] = useState(board.name);
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();

  useEffect(() => {
    if (open) {
      setName(board.name);
    }
  }, [open, board.name]);

  function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === board.name) return;
    updateBoard.mutate(
      { id: board.id, data: { name: name.trim() } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
          toast({ title: "Board renamed" });
        },
        onError: () => toast({ title: "Failed to rename board", variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    if (!confirm(`Delete board "${board.name}"? All columns and tasks on this board will be permanently removed.`)) {
      return;
    }
    deleteBoard.mutate(
      { id: board.id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
          onOpenChange(false);
          toast({ title: "Board deleted" });
          onDeleted?.();
        },
        onError: () => toast({ title: "Failed to delete board", variant: "destructive" }),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Board settings</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleRename} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-rename">Board name</Label>
            <Input
              id="board-rename"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!name.trim() || name.trim() === board.name || updateBoard.isPending}>
            {updateBoard.isPending ? "Saving..." : "Save name"}
          </Button>
        </form>

        {board.isOwner && (
          <p className="text-sm text-muted-foreground pt-2 border-t border-border">
            To share this board with others, link it to a team on the Teams page and invite members
            there.
          </p>
        )}

        {board.isOwner && (
          <div className="pt-4 border-t border-border">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteBoard.isPending}
              className="w-full"
            >
              {deleteBoard.isPending ? "Deleting..." : "Delete board"}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
