import { useGetTaskStats, useListColumns } from "@workspace/api-client-react";
import { Loader2, AlertCircle, CheckCircle2, ListTodo, BarChart3, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBoardIdFromRoute } from "@/hooks/useBoardId";

const PRIORITY_COLORS = {
  high: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10 border-rose-200 dark:border-rose-800/40" },
  medium: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-200 dark:border-amber-800/40" },
  low: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/40" },
};

export default function StatsPage() {
  const boardId = useBoardIdFromRoute()!;
  const { data: stats, isLoading } = useGetTaskStats({ boardId });
  const { data: columns = [] } = useListColumns({ boardId });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return null;

  const complete = stats.byColumn.find((c) =>
    columns.find((col) => col.id === c.columnId && col.title.toLowerCase().includes("done"))
  )?.count ?? 0;

  const maxColCount = Math.max(...stats.byColumn.map((c) => c.count), 1);
  const totalPriority = stats.byPriority.low + stats.byPriority.medium + stats.byPriority.high;
  const completionRate = stats.total > 0 ? Math.round((complete / stats.total) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <BarChart3 className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">Board Analytics</h2>
          <p className="text-xs text-muted-foreground">Task metrics, distribution, and completion rates</p>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8 max-w-4xl">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Tasks"
            value={stats.total}
            icon={<ListTodo className="w-4 h-4" />}
            color="text-primary bg-primary/10"
          />
          <StatCard
            label="Completed"
            value={complete}
            icon={<CheckCircle2 className="w-4 h-4" />}
            color="text-emerald-600 bg-emerald-500/10"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={<AlertCircle className="w-4 h-4" />}
            color={stats.overdue > 0 ? "text-rose-600 bg-rose-500/10" : "text-muted-foreground bg-muted"}
          />
          <StatCard
            label="Completion Rate"
            value={`${completionRate}%`}
            icon={<TrendingUp className="w-4 h-4" />}
            color="text-primary bg-primary/10"
          />
        </div>

        {/* Tasks by Column Progress Bar */}
        <section className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Tasks by Column</h3>
            <span className="text-xs text-muted-foreground">{displayColumnTotal(stats.byColumn)} total tasks</span>
          </div>

          <div className="space-y-3.5">
            {stats.byColumn.map((col) => {
              const column = columns.find((c) => c.id === col.columnId);
              const pct = maxColCount > 0 ? (col.count / maxColCount) * 100 : 0;
              const totalPct = stats.total > 0 ? Math.round((col.count / stats.total) * 100) : 0;
              return (
                <div key={col.columnId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: column?.color ?? "#6366f1" }}
                      />
                      <span className="font-semibold text-foreground">{col.columnTitle}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{totalPct}%</span>
                      <span className="font-bold text-foreground">({col.count})</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: column?.color ?? "#6366f1",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tasks by Priority Cards */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Tasks by Priority</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["high", "medium", "low"] as const).map((p) => {
              const count = stats.byPriority[p];
              const pct = totalPriority > 0 ? Math.round((count / totalPriority) * 100) : 0;
              const s = PRIORITY_COLORS[p];
              return (
                <div key={p} className={cn("rounded-2xl p-5 border shadow-xs space-y-3", s.bg)}>
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-bold uppercase tracking-wider", s.text)}>{p}</span>
                    <span className="text-2xl font-bold text-foreground">{count}</span>
                  </div>
                  <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-500", s.bar)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">{pct}% of total tasks</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function displayColumnTotal(cols: { count: number }[]) {
  return cols.reduce((sum, c) => sum + c.count, 0);
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
    <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex items-center justify-between">
      <div>
        <div className="text-2xl font-bold text-foreground tracking-tight">{value}</div>
        <div className="text-xs font-medium text-muted-foreground mt-0.5">{label}</div>
      </div>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        {icon}
      </div>
    </div>
  );
}
