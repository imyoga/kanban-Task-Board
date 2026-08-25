import { Link, useLocation } from "wouter";
import { BarChart2, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import AddColumnDialog from "@/components/AddColumnDialog";
import AddBoardDialog from "@/components/AddBoardDialog";
import { useMe, useLogout } from "@/hooks/useAuth";
import { useListBoards } from "@workspace/api-client-react";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const boardId = useBoardIdFromRoute();
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const { data: user } = useMe();
  const { data: boards = [] } = useListBoards();
  const logout = useLogout();

  const statsHref = boardId ? `/boards/${boardId}/stats` : "/";

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="text-lg font-semibold text-white tracking-tight">Kanban</h1>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">Task tracker</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
            Boards
          </div>

          {boards.map(board => {
            const href = `/boards/${board.id}`;
            const isActive = boardId === board.id && !location.endsWith("/stats");
            return (
              <div key={board.id} className="space-y-0.5">
                <Link href={href}>
                  <span
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent text-white"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                    )}
                  >
                    <span className="truncate flex-1">{board.name}</span>
                    {board.isShared && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                        Shared
                      </Badge>
                    )}
                  </span>
                </Link>
                {isActive && (
                  <button
                    onClick={() => setAddColumnOpen(true)}
                    className="w-full flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add column
                  </button>
                )}
              </div>
            );
          })}

          <div className="pt-3 mt-2 border-t border-sidebar-border">
            <Link href={statsHref}>
              <span
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  location.endsWith("/stats")
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white",
                  !boardId && "pointer-events-none opacity-50"
                )}
              >
                <BarChart2 className="w-4 h-4" />
                Stats
              </span>
            </Link>
          </div>
        </nav>

        <div className="px-3 pb-2 border-t border-sidebar-border pt-3 space-y-1">
          <button
            onClick={() => setAddBoardOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add board
          </button>
        </div>

        <div className="p-3 border-t border-sidebar-border">
          {user && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <div className="w-6 h-6 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                {user.email[0].toUpperCase()}
              </div>
              <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            </div>
          )}
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>

      {boardId && (
        <AddColumnDialog
          open={addColumnOpen}
          onOpenChange={setAddColumnOpen}
          boardId={boardId}
        />
      )}
      <AddBoardDialog open={addBoardOpen} onOpenChange={setAddBoardOpen} />
    </div>
  );
}
