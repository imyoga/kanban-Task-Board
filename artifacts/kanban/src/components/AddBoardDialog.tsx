import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateBoard, getListBoardsQueryKey } from "@workspace/api-client-react";
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New board</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-name">Name</Label>
            <Input
              id="board-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Untitled board"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createBoard.isPending}>
              {createBoard.isPending ? "Creating..." : "Create board"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
