import { useGetTaskStats, useListColumns } from "@workspace/api-client-react";
import { Loader2, AlertCircle, CheckCircle2, ListTodo, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";

const PRIORITY_COLORS = {
  high: { bar: "bg-red-500", text: "text-red-600", bg: "bg-red-50" },
  medium: { bar: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
  low: { bar: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" },
};

export default function StatsPage() {
  const boardId = useBoardIdFromRoute()!;
  const { data: stats, isLoading } = useGetTaskStats({ boardId });
  const { data: columns = [] } = useListColumns({ boardId });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const complete = stats.byColumn.find(c =>
    columns.find(col => col.id === c.columnId && col.title.toLowerCase().includes("done"))
  )?.count ?? 0;

  const maxColCount = Math.max(...stats.byColumn.map(c => c.count), 1);
  const totalPriority = stats.byPriority.low + stats.byPriority.medium + stats.byPriority.high;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-border bg-background">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">Stats</h2>
      </div>

      <div className="px-6 py-6 space-y-8 max-w-3xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total tasks"
            value={stats.total}
            icon={<ListTodo className="w-4 h-4" />}
            color="text-primary"
          />
          <StatCard
            label="Completed"
            value={complete}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="text-emerald-600"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={<AlertCircle className="w-4 h-4" />}
            color={stats.overdue > 0 ? "text-red-600" : "text-muted-foreground"}
          />
          <StatCard
            label="Completion"
            value={stats.total > 0 ? `${Math.round((complete / stats.total) * 100)}%` : "—"}
            icon={<BarChart3 className="w-4 h-4" />}
            color="text-primary"
          />
        </div>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Tasks by column</h3>
          <div className="space-y-3">
            {stats.byColumn.map(col => {
              const column = columns.find(c => c.id === col.columnId);
              const pct = maxColCount > 0 ? (col.count / maxColCount) * 100 : 0;
              return (
                <div key={col.columnId} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-muted-foreground truncate">{col.columnTitle}</div>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: column?.color ?? "#6366f1",
                      }}
                    />
                  </div>
                  <div className="w-8 text-sm font-medium text-foreground text-right">{col.count}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3">Tasks by priority</h3>
          <div className="grid grid-cols-3 gap-3">
            {(["high", "medium", "low"] as const).map(p => {
              const count = stats.byPriority[p];
              const pct = totalPriority > 0 ? Math.round((count / totalPriority) * 100) : 0;
              const s = PRIORITY_COLORS[p];
              return (
                <div key={p} className={cn("rounded-xl p-4 border border-border", s.bg)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", s.text)}>{p}</span>
                    <span className="text-lg font-bold text-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", s.bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">{pct}% of total</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 shadow-sm">
      <div className={cn("mb-2", color)}>{icon}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
