import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUpdateBoard,
  useDeleteBoard,
  useListTeams,
  useGetBoardTeam,
  useUpdateTeam,
  getListBoardsQueryKey,
  getListTeamsQueryKey,
  getGetBoardTeamQueryKey,
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
import { Users, Trash2, Settings, User } from "lucide-react";
import { userDisplayName, userInitials } from "@/hooks/useAuth";

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
  const updateTeam = useUpdateTeam();

  const { data: teams = [] } = useListTeams({
    query: { enabled: open, queryKey: getListTeamsQueryKey() },
  });
  const { data: boardTeam } = useGetBoardTeam(board.id, {
    query: { enabled: open, queryKey: getGetBoardTeamQueryKey(board.id) },
  });

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

  function handleTeamChange(selectedTeamValue: string) {
    const nextTeamId = selectedTeamValue === "none" ? null : Number(selectedTeamValue);
    const currentTeamId = boardTeam?.id;

    if (nextTeamId === currentTeamId) return;

    // If unlinking current team
    if (nextTeamId === null && currentTeamId) {
      updateTeam.mutate(
        { id: currentTeamId, data: { boardId: null } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
            qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(board.id) });
            toast({ title: "Team unlinked from board" });
          },
          onError: (err) =>
            toast({
              title: "Failed to unlink team",
              variant: "destructive",
            }),
        }
      );
      return;
    }

    // If linking a new team
    if (nextTeamId) {
      updateTeam.mutate(
        { id: nextTeamId, data: { boardId: board.id } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
            qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
            qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(board.id) });
            toast({ title: "Team linked to board" });
          },
          onError: (err) =>
            toast({
              title: "Failed to link team",
              variant: "destructive",
            }),
        }
      );
    }
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

  const ownedTeams = teams.filter((t) => t.isOwner);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md p-6"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-2 border-b border-border/50">
          <DialogTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Board Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Rename form */}
          <form onSubmit={handleRename} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="board-rename" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Board Name
              </Label>
              <div className="flex gap-2">
                <Input
                  id="board-rename"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10 text-sm font-medium"
                />
                <Button
                  type="submit"
                  disabled={!name.trim() || name.trim() === board.name || updateBoard.isPending}
                  className="shrink-0"
                >
                  {updateBoard.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </form>

          {/* Team association */}
          {board.isOwner && (
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Associated Team
                </Label>
              </div>

              <Select
                value={boardTeam?.id ? String(boardTeam.id) : "none"}
                onValueChange={handleTeamChange}
                disabled={updateTeam.isPending}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="No team associated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No team associated (Personal)</SelectItem>
                  {ownedTeams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {boardTeam ? (
                <div className="bg-muted/40 rounded-xl p-3 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      Team Members ({boardTeam.members.length})
                    </span>
                    <span className="text-[10px] text-muted-foreground">Collaborators</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {boardTeam.members.map((member) => (
                      <div
                        key={member.userId}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/60 text-xs font-medium text-foreground shadow-2xs"
                      >
                        <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold">
                          {userInitials(member)}
                        </div>
                        <span>{userDisplayName(member)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Linking a team shares this board with all team members and enables task assignment.
                </p>
              )}
            </div>
          )}

          {/* Delete Danger Zone */}
          {board.isOwner && (
            <div className="pt-4 border-t border-border/60">
              <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3.5 space-y-3">
                <div>
                  <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Danger Zone
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Deleting this board permanently deletes all its columns and tasks.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteBoard.isPending}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteBoard.isPending ? "Deleting..." : "Delete Board"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-border/50">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
