import { Link, useLocation } from "wouter";
import { LayoutDashboard, BarChart2, Plus, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import AddColumnDialog from "@/components/AddColumnDialog";
import { useMe, useLogout } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [addColumnOpen, setAddColumnOpen] = useState(false);
  const { data: user } = useMe();
  const logout = useLogout();

  const navItems = [
    { href: "/", label: "Board", icon: LayoutDashboard },
    { href: "/stats", label: "Stats", icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <h1 className="text-lg font-semibold text-white tracking-tight">Kanban</h1>
          <p className="text-xs text-sidebar-foreground/50 mt-0.5">Task tracker</p>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  location === href
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="px-3 pb-2 border-t border-sidebar-border pt-3 space-y-1">
          <button
            onClick={() => setAddColumnOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add column
          </button>
        </div>

        {/* User + logout */}
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

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>

      <AddColumnDialog open={addColumnOpen} onOpenChange={setAddColumnOpen} />
    </div>
  );
}
