import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateBoard,
  useListBoardMembers,
  useAddBoardMember,
  useRemoveBoardMember,
  useListUsers,
  getListBoardsQueryKey,
  getListBoardMembersQueryKey,
  getListUsersQueryKey,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";

interface Props {
  board: Board;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function BoardSettingsDialog({ board, open, onOpenChange }: Props) {
  const [name, setName] = useState(board.name);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateBoard = useUpdateBoard();
  const { data: members = [] } = useListBoardMembers(board.id, {
    query: {
      enabled: open && board.isOwner,
      queryKey: getListBoardMembersQueryKey(board.id),
    },
  });
  const { data: users = [] } = useListUsers({
    query: {
      enabled: open && board.isOwner,
      queryKey: getListUsersQueryKey(),
    },
  });
  const addMember = useAddBoardMember();
  const removeMember = useRemoveBoardMember();

  useEffect(() => {
    if (open) setName(board.name);
  }, [open, board.name]);

  const memberUserIds = new Set(members.map(m => m.userId));
  const availableUsers = users.filter(u => !memberUserIds.has(u.id));

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

  function handleAddMember() {
    const userId = Number(selectedUserId);
    if (!userId) return;
    addMember.mutate(
      { id: board.id, data: { userId } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListBoardMembersQueryKey(board.id) });
          setSelectedUserId("");
          toast({ title: "User added to board" });
        },
        onError: () => toast({ title: "Failed to share board", variant: "destructive" }),
      }
    );
  }

  function handleRemoveMember(userId: number) {
    removeMember.mutate(
      { id: board.id, userId },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListBoardMembersQueryKey(board.id) });
          toast({ title: "Member removed" });
        },
        onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
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
          <div className="space-y-3 pt-2 border-t border-border">
            <Label>Share with</Label>
            <div className="flex gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddMember}
                disabled={!selectedUserId || addMember.isPending}
              >
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {members.map(member => (
                <div key={member.userId} className="flex items-center justify-between text-sm py-1.5 px-2 rounded-md bg-muted/50">
                  <div>
                    <span className="font-medium">{member.email}</span>
                    {member.isOwner && (
                      <span className="text-xs text-muted-foreground ml-2">Owner</span>
                    )}
                  </div>
                  {!member.isOwner && (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Remove member"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
