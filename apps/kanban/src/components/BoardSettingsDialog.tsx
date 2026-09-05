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
import { Switch } from "@/components/ui/switch";
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
  const [key, setKey] = useState(board.key || "BOARD");
  const [allowLinkPreview, setAllowLinkPreview] = useState(board.allowLinkPreview ?? false);
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
      setKey(board.key || "BOARD");
      setAllowLinkPreview(board.allowLinkPreview ?? false);
    }
  }, [open, board.name, board.key, board.allowLinkPreview]);

  function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanKey = key.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanName || cleanKey.length < 2) return;
    const isDirty =
      cleanName !== board.name ||
      cleanKey !== (board.key || "BOARD") ||
      allowLinkPreview !== (board.allowLinkPreview ?? false);
    if (!isDirty) return;

    updateBoard.mutate(
      { id: board.id, data: { name: cleanName, key: cleanKey, allowLinkPreview } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(board.id) });
          toast({ title: "Board details updated" });
        },
        onError: () => toast({ title: "Failed to update board details", variant: "destructive" }),
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
        className="w-[95vw] sm:max-w-md p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="pb-2 border-b border-border/50 shrink-0">
          <DialogTitle className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary shrink-0" />
            Board Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-3 overflow-y-auto pr-1 flex-1">
          {/* Board Details form */}
          <form onSubmit={handleSaveDetails} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="board-rename" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Board Name
              </Label>
              <Input
                id="board-rename"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-sm font-medium"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <Label htmlFor="board-key" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Board Key / ID
                </Label>
                <span className="text-[11px] text-muted-foreground font-mono font-medium">
                  Prefix: {key || "BOARD"}-1
                </span>
              </div>
              <Input
                id="board-key"
                value={key}
                maxLength={10}
                onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
                placeholder="PRDED"
                className="h-10 text-sm font-mono uppercase font-bold tracking-wider"
                required
              />
              <p className="text-[11px] text-muted-foreground leading-tight">
                Used in task URLs like <span className="font-mono text-foreground font-semibold break-all">/boards/{board.id}/{key || "BOARD"}-5945</span>.
              </p>
            </div>

            {/* Public Link Previews Toggle */}
            <div className="pt-3 pb-1 border-t border-border/50 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <Label
                      htmlFor="allow-link-preview"
                      className="text-xs font-semibold uppercase tracking-wider text-foreground cursor-pointer"
                    >
                      Allow Link Previews
                    </Label>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        allowLinkPreview
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {allowLinkPreview ? "Public Preview" : "Protected"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    When enabled, sharing task links in WhatsApp, Slack, etc. unfurls a rich preview with the task title, status, and notes. When disabled, links remain private and unauthenticated bots cannot read ticket contents.
                  </p>
                </div>
                <Switch
                  id="allow-link-preview"
                  checked={allowLinkPreview}
                  onCheckedChange={setAllowLinkPreview}
                  className="mt-0.5 shrink-0"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={
                  !name.trim() ||
                  key.trim().length < 2 ||
                  (name.trim() === board.name &&
                    key.trim() === (board.key || "BOARD") &&
                    allowLinkPreview === (board.allowLinkPreview ?? false)) ||
                  updateBoard.isPending
                }
                className="w-full sm:w-auto h-9 px-4 font-medium"
              >
                {updateBoard.isPending ? "Saving..." : "Save Details"}
              </Button>
            </div>
          </form>

          {/* Team association */}
          {board.isOwner && (
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Associated Team
                </Label>
              </div>

              <Select
                value={boardTeam?.id ? String(boardTeam.id) : "none"}
                onValueChange={handleTeamChange}
                disabled={updateTeam.isPending}
              >
                <SelectTrigger className="h-10 w-full">
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
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/60 text-xs font-medium text-foreground shadow-2xs max-w-full truncate"
                      >
                        <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                          {userInitials(member)}
                        </div>
                        <span className="truncate">{userDisplayName(member)}</span>
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
                  <Trash2 className="w-4 h-4 shrink-0" />
                  {deleteBoard.isPending ? "Deleting..." : "Delete Board"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 shrink-0">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
