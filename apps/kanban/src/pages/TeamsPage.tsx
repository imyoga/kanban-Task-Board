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
import { Plus, Trash2, X, Users, Mail, Link as LinkIcon, UserMinus, Clock, ShieldCheck } from "lucide-react";
import { userDisplayName, userInitials } from "@/hooks/useAuth";

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
          toast({ title: boardId ? "Board linked to team" : "Board unlinked" });
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

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
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
    <div className="bg-card border border-border/80 rounded-2xl p-6 space-y-6 shadow-xs hover:shadow-md transition-shadow">
      {/* Team Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-foreground">{team.name}</h2>
            {team.isOwner ? (
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-semibold">
                Owner
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">Member</Badge>
            )}
          </div>
          {team.boardName ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-primary" />
              <span>Linked board: <strong className="text-foreground">{team.boardName}</strong></span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No board linked yet</p>
          )}
        </div>

        {team.isOwner && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-2 -mt-2"
            onClick={handleDelete}
            disabled={deleteTeam.isPending}
            aria-label="Delete team"
            title="Delete team"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Linked Board Selection (Owner only) */}
      {team.isOwner && (
        <div className="space-y-1.5 bg-muted/30 p-3.5 rounded-xl border border-border/60">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Linked Kanban Board
            </Label>
            <span className="text-[10px] text-muted-foreground">Team Workspace</span>
          </div>
          <Select
            value={team.boardId ? String(team.boardId) : "none"}
            onValueChange={handleBoardChange}
            disabled={updateTeam.isPending}
          >
            <SelectTrigger className="h-9 bg-background text-xs">
              <SelectValue placeholder="Select a board to link" />
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
        </div>
      )}

      {/* Members Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Members ({members.length})
          </Label>
          <span className="text-[10px] text-muted-foreground">Active Collaborators</span>
        </div>

        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shrink-0">
                  {userInitials(member)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {userDisplayName(member)}
                    </span>
                    {member.isOwner && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary px-1.5 py-0.2 bg-primary/10 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> Owner
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
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
                  className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  aria-label="Remove member"
                  title="Remove member"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Invites */}
      {team.isOwner && invites.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/60">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Invitations ({invites.length})
          </Label>
          <div className="space-y-1.5">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium text-amber-900 dark:text-amber-300">{invite.email}</span>
                </div>
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
                  className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                  aria-label="Cancel invite"
                  title="Cancel invite"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Form (Owner only) */}
      {team.isOwner && (
        <form onSubmit={handleInvite} className="space-y-2 pt-3 border-t border-border/60">
          <Label htmlFor={`invite-${teamId}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Invite New Member
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id={`invite-${teamId}`}
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="pl-8 h-9 text-xs"
                required
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={!inviteEmail.trim() || inviteMember.isPending}
              className="h-9 font-medium"
            >
              {inviteMember.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
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
      <div className="max-w-3xl space-y-8">
        {/* Page Header */}
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Teams & Workspaces</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create teams, invite colleagues, and link boards so your entire team can collaborate and assign tasks.
          </p>
        </div>

        {/* Create Team Form */}
        <form
          onSubmit={handleCreate}
          className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3"
        >
          <Label htmlFor="new-team" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Create a New Team
          </Label>
          <div className="flex gap-2.5">
            <Input
              id="new-team"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="e.g. Design Team, Frontend Squad..."
              className="h-10 text-sm font-medium"
              required
            />
            <Button
              type="submit"
              disabled={!newTeamName.trim() || createTeam.isPending}
              className="h-10 px-4 font-semibold shrink-0"
            >
              <Plus className="w-4 h-4 mr-1" />
              {createTeam.isPending ? "Creating..." : "Create Team"}
            </Button>
          </div>
        </form>

        {/* Teams List */}
        {teams.length === 0 ? (
          <div className="bg-card border-2 border-dashed border-border/80 rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Teams Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create your first team above to start inviting teammates and sharing boards.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {teams.map((team) => (
              <TeamCard key={team.id} teamId={team.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
