import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTeams,
  useListBoards,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useListTeamMembers,
  useListTeamInvites,
  useInviteTeamMember,
  useRemoveTeamMember,
  useCancelTeamInvite,
  getListTeamsQueryKey,
  getListTeamMembersQueryKey,
  getListTeamInvitesQueryKey,
  getListBoardsQueryKey,
  getGetBoardTeamQueryKey,
} from "@workspace/api-client-react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, X, Users } from "lucide-react";
import { userDisplayName } from "@/hooks/useAuth";

function TeamCard({ teamId }: { teamId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: teams = [] } = useListTeams();
  const { data: boards = [] } = useListBoards();
  const team = teams.find((t) => t.id === teamId);

  const { data: members = [] } = useListTeamMembers(teamId, {
    query: {
      enabled: !!team,
      queryKey: getListTeamMembersQueryKey(teamId),
    },
  });
  const { data: invites = [] } = useListTeamInvites(teamId, {
    query: {
      enabled: !!team?.isOwner,
      queryKey: getListTeamInvitesQueryKey(teamId),
    },
  });

  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();
  const inviteMember = useInviteTeamMember();
  const removeMember = useRemoveTeamMember();
  const cancelInvite = useCancelTeamInvite();

  const [inviteEmail, setInviteEmail] = useState("");

  if (!team) return null;

  const linkedElsewhere = new Set(
    teams.filter((t) => t.boardId != null && t.id !== team.id).map((t) => t.boardId!),
  );
  const linkableBoards = boards.filter(
    (b) => b.isOwner && !b.isShared && !linkedElsewhere.has(b.id),
  );
  const boardOptions =
    team.boardId && !linkableBoards.some((b) => b.id === team.boardId)
      ? [...linkableBoards, boards.find((b) => b.id === team.boardId)!].filter(Boolean)
      : linkableBoards;

  function invalidateTeam() {
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(teamId) });
    qc.invalidateQueries({ queryKey: getListTeamInvitesQueryKey(teamId) });
    qc.invalidateQueries({ queryKey: getListBoardsQueryKey() });
  }

  function handleBoardChange(value: string) {
    const boardId = value === "none" ? null : Number(value);
    const previousBoardId = team!.boardId;
    updateTeam.mutate(
      { id: teamId, data: { boardId } },
      {
        onSuccess: (updatedTeam) => {
          qc.setQueryData(getListTeamsQueryKey(), (current: typeof teams | undefined) =>
            current?.map((currentTeam) => (currentTeam.id === teamId ? updatedTeam : currentTeam)) ?? [],
          );

          if (previousBoardId != null) {
            qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(previousBoardId) });
          }
          if (boardId != null) {
            qc.invalidateQueries({ queryKey: getGetBoardTeamQueryKey(boardId) });
          }

          invalidateTeam();
          toast({ title: boardId ? "Board linked" : "Board unlinked" });
        },
        onError: (err) =>
          toast({
            title:
              err && typeof err === "object" && "data" in err
                ? String((err as { data?: { error?: string } }).data?.error ?? "Failed to update team")
                : "Failed to update team",
            variant: "destructive",
          }),
      },
    );
  }

  function handleInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    inviteMember.mutate(
      { id: teamId, data: { email } },
      {
        onSuccess: (result) => {
          invalidateTeam();
          setInviteEmail("");
          toast({
            title:
              result.type === "member"
                ? "Member added to team"
                : "Invitation email sent",
          });
        },
        onError: (err) =>
          toast({
            title:
              err && typeof err === "object" && "data" in err
                ? String((err as { data?: { error?: string } }).data?.error ?? "Failed to invite")
                : "Failed to invite",
            variant: "destructive",
          }),
      },
    );
  }

  function handleDelete() {
    if (!team) return;
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return;
    deleteTeam.mutate(
      { id: teamId },
      {
        onSuccess: () => {
          invalidateTeam();
          toast({ title: "Team deleted" });
        },
        onError: () => toast({ title: "Failed to delete team", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{team.name}</h2>
            {team.isOwner ? (
              <Badge variant="secondary" className="text-[10px]">Owner</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Member</Badge>
            )}
          </div>
          {team.boardName && (
            <p className="text-sm text-muted-foreground mt-1">
              Linked board: {team.boardName}
            </p>
          )}
        </div>
        {team.isOwner && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={deleteTeam.isPending}
            aria-label="Delete team"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {team.isOwner && (
        <div className="space-y-1.5">
          <Label>Linked board</Label>
          <Select
            value={team.boardId ? String(team.boardId) : "none"}
            onValueChange={handleBoardChange}
            disabled={updateTeam.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a board" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No board linked</SelectItem>
              {boardOptions.map((board) => (
                <SelectItem key={board.id} value={String(board.id)}>
                  {board.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Only boards you own can be linked. Shared boards cannot be linked.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium">Members ({members.length})</Label>
        <div className="space-y-1.5 mt-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-muted/50"
            >
              <div>
                <span className="font-medium">{userDisplayName(member)}</span>
                <span className="text-muted-foreground ml-2 text-xs">{member.email}</span>
                {member.isOwner && (
                  <span className="text-xs text-muted-foreground ml-2">Owner</span>
                )}
              </div>
              {team.isOwner && !member.isOwner && (
                <button
                  type="button"
                  onClick={() =>
                    removeMember.mutate(
                      { id: teamId, userId: member.userId },
                      {
                        onSuccess: () => {
                          invalidateTeam();
                          toast({ title: "Member removed" });
                        },
                        onError: () =>
                          toast({ title: "Failed to remove member", variant: "destructive" }),
                      },
                    )
                  }
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

      {team.isOwner && invites.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pending invites</Label>
          <div className="space-y-1.5">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between text-sm py-2 px-3 rounded-md bg-amber-50 border border-amber-100"
              >
                <span>{invite.email}</span>
                <button
                  type="button"
                  onClick={() =>
                    cancelInvite.mutate(
                      { id: teamId, inviteId: invite.id },
                      {
                        onSuccess: () => {
                          invalidateTeam();
                          toast({ title: "Invite cancelled" });
                        },
                        onError: () =>
                          toast({ title: "Failed to cancel invite", variant: "destructive" }),
                      },
                    )
                  }
                  className="p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Cancel invite"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {team.isOwner && (
        <div className="space-y-2 pt-2 border-t border-border">
          <Label htmlFor={`invite-${teamId}`}>Invite by email</Label>
          <div className="flex gap-2">
            <Input
              id={`invite-${teamId}`}
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail.trim() || inviteMember.isPending}
            >
              Invite
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: teams = [] } = useListTeams();
  const createTeam = useCreateTeam();
  const [newTeamName, setNewTeamName] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name) return;

    createTeam.mutate(
      { data: { name } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setNewTeamName("");
          toast({ title: "Team created" });
        },
        onError: () => toast({ title: "Failed to create team", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-2xl space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create teams, invite members, and link a board so your team can collaborate and assign
            tasks.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="flex gap-2 bg-card border border-card-border rounded-xl p-4"
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="new-team">New team name</Label>
            <Input
              id="new-team"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Engineering"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={!newTeamName.trim() || createTeam.isPending}>
              <Plus className="w-4 h-4 mr-1" />
              {createTeam.isPending ? "Creating..." : "Create team"}
            </Button>
          </div>
        </form>

        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams yet. Create one to get started.</p>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => <TeamCard key={team.id} teamId={team.id} />)}
          </div>
        )}
      </div>
    </div>
  );
}
