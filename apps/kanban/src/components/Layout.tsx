import { Link, useLocation } from "wouter";
import { BarChart2, Plus, LogOut, ChevronRight, ChevronDown, Users, UserCircle, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import AddColumnDialog from "@/components/AddColumnDialog";
import AddBoardDialog from "@/components/AddBoardDialog";
import { useMe, useLogout, userInitials } from "@/hooks/useAuth";
import { useListBoards } from "@workspace/api-client-react";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";
import { Badge } from "@/components/ui/badge";
import NotificationBell from "@/components/NotificationBell";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const boardId = useBoardIdFromRoute();
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const [addColumnBoardId, setAddColumnBoardId] = useState<number | null>(null);
  const [expandedBoardIds, setExpandedBoardIds] = useState<Set<number>>(() => new Set());
  const [addBoardOpen, setAddBoardOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: user } = useMe();
  const { data: boards = [] } = useListBoards();
  const logout = useLogout();

  const statsHref = boardId ? `/boards/${boardId}/stats` : "/";

  // Close sidebar on route change (mobile navigation)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Prevent body scroll when drawer is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  function toggleBoardExpanded(id: number) {
    setExpandedBoardIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openAddColumn(boardIdToAdd: number) {
    setAddColumnBoardId(boardIdToAdd);
    setAddColumnOpen(true);
  }

  const sidebarContent = (
    <>
      {/* Brand header */}
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Kanban</h1>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">Task tracker</p>
        </div>
        {/* Close button — mobile only */}
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1.5 rounded-md text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/60 transition-colors"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
          Boards
        </div>

        {boards.map(board => {
          const href = `/boards/${board.id}`;
          const isActive = boardId === board.id && !location.endsWith("/stats");
          const isExpanded = expandedBoardIds.has(board.id);
          return (
            <div key={board.id} className="space-y-0.5">
              <div
                className={cn(
                  "flex items-center rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleBoardExpanded(board.id)}
                  className={cn(
                    "p-2 rounded-md shrink-0 transition-colors",
                    isActive
                      ? "text-white hover:bg-sidebar-accent/80"
                      : "text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/40"
                  )}
                  aria-label={isExpanded ? "Collapse board" : "Expand board"}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <Link href={href} className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "flex items-center gap-2 py-2 pr-3 text-sm font-medium cursor-pointer"
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
              </div>
              {isExpanded && (
                <button
                  onClick={() => openAddColumn(board.id)}
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
          <Link href="/teams">
            <span
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                location === "/teams"
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
              )}
            >
              <Users className="w-4 h-4" />
              Teams
            </span>
          </Link>
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
            <div className="w-6 h-6 rounded-full bg-sidebar-accent flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0">
              {userInitials(user)}
            </div>
            <span className="text-xs text-sidebar-foreground/60 truncate flex-1">{user.email}</span>
            <NotificationBell className="p-1 h-6 w-6 rounded-md border-none text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/60 shadow-none" />
            <Link href="/account">
              <span
                className="p-1 rounded-md text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent/60 transition-colors flex items-center justify-center"
                aria-label="Account settings"
              >
                <UserCircle className="w-4 h-4" />
              </span>
            </Link>
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

        {typeof __BUILD_TIME__ !== "undefined" && __BUILD_TIME__ && (
          <div className="mt-2 pt-2 border-t border-sidebar-border/40 text-[10px] text-sidebar-foreground/40 text-center font-mono select-none space-y-0.5">
            <div>
              Deployed: {new Date(__BUILD_TIME__).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            {typeof __COMMIT_HASH__ !== "undefined" && __COMMIT_HASH__ && (
              <div className="text-sidebar-foreground/35">
                Commit: <span className="text-sidebar-foreground/60 font-semibold">{__COMMIT_HASH__}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Desktop sidebar (always visible on md+) ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex-col border-r border-sidebar-border">
        {sidebarContent}
      </aside>

      {/* ── Mobile drawer backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer (slide in from left) ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
          "transition-transform duration-300 ease-in-out md:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-label="Navigation"
      >
        {sidebarContent}
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar (hamburger + brand) — hidden on desktop */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-sidebar text-sidebar-foreground border-b border-sidebar-border shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent/60 transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-white tracking-tight">Kanban</span>
          <div className="flex items-center gap-1">
            <NotificationBell className="p-1.5 h-8 w-8 rounded-md border-none text-sidebar-foreground/60 hover:text-white hover:bg-sidebar-accent/60 shadow-none" />
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>

      {addColumnBoardId != null && (
        <AddColumnDialog
          open={addColumnOpen}
          onOpenChange={open => {
            setAddColumnOpen(open);
            if (!open) setAddColumnBoardId(null);
          }}
          boardId={addColumnBoardId}
        />
      )}
      <AddBoardDialog open={addBoardOpen} onOpenChange={setAddBoardOpen} />
    </div>
  );
}
