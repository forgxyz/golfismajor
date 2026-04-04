import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Flag, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EventResult {
  id: number;
  playerName: string;
  managerId: string | null;
  managerName: string | null;
  isRostered: boolean;
  position: string;
  positionNum: number | null;
  score: string | null;
  roundScore: string | null;
  status: string;
  projectedPoints: number | null;
  pointsOverride: number | null;
  effectivePoints: number;
}

interface ManagerRollup {
  managerId: string;
  managerName: string;
  projectedEventPoints: number;
}

interface CurrentEventData {
  event: {
    id: string;
    name: string;
    status: string;
    round: number | null;
    eventCategory: string;
    isMajor: boolean;
    venue: string | null;
    startDate: string | null;
  };
  results: EventResult[];
  managerRollup: ManagerRollup[];
}

// Manager color palette (matches 6 managers)
const MANAGER_COLORS: Record<string, string> = {
  jack:    "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500",
  michael: "bg-purple-100 dark:bg-purple-900/40 border-purple-400 dark:border-purple-500",
  matthew: "bg-orange-100 dark:bg-orange-900/40 border-orange-400 dark:border-orange-500",
  sean:    "bg-red-100 dark:bg-red-900/40 border-red-400 dark:border-red-500",
  ben:     "bg-yellow-100 dark:bg-yellow-900/40 border-yellow-400 dark:border-yellow-500",
  peter:   "bg-green-100 dark:bg-green-900/40 border-green-400 dark:border-green-500",
};

const MANAGER_DOT: Record<string, string> = {
  jack:    "bg-blue-500",
  michael: "bg-purple-500",
  matthew: "bg-orange-500",
  sean:    "bg-red-500",
  ben:     "bg-yellow-500",
  peter:   "bg-green-500",
};

const MANAGER_TEXT: Record<string, string> = {
  jack:    "text-blue-700 dark:text-blue-300",
  michael: "text-purple-700 dark:text-purple-300",
  matthew: "text-orange-700 dark:text-orange-300",
  sean:    "text-red-700 dark:text-red-300",
  ben:     "text-yellow-700 dark:text-yellow-300",
  peter:   "text-green-700 dark:text-green-300",
};

function positionLabel(pos: number | null, allResults: EventResult[]): string {
  if (!pos) return "—";
  // Count how many players share the same positionNum
  const tied = allResults.filter(r => r.positionNum === pos).length;
  return tied > 1 ? `T${pos}` : String(pos);
}

export default function Tournament() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<CurrentEventData | null>({
    queryKey: ["/api/current-event"],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/refresh/leaderboard"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/current-event"] });
      toast({ title: "Leaderboard refreshed" });
    },
    onError: (e: any) => toast({ title: "Refresh failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="page-content">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No active tournament</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Admin → Events and pull the schedule or set a current event.
          </p>
        </div>
      </div>
    );
  }

  const { event, results, managerRollup } = data;

  // Build set of unique manager IDs present in results for the legend
  const activeManagerIds = [...new Set(results.filter(r => r.isRostered && r.managerId).map(r => r.managerId!))];

  // Map managerId -> managerName for the legend
  const managerNames: Record<string, string> = {};
  for (const r of results) {
    if (r.managerId && r.managerName) managerNames[r.managerId] = r.managerName;
  }

  const rosteredInEvent = results.filter(r => r.isRostered);
  const rosteredCount = rosteredInEvent.length;

  return (
    <div className="page-content">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold">{event.name}</h1>
            {event.isMajor && (
              <span className="badge badge-major">Major</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {event.venue ?? "Venue TBD"}
            {event.startDate && ` · ${new Date(event.startDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
            {" · "}{event.status}
          </p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-leaderboard"
        >
          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Manager roll-up KPI strip */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {managerRollup.map((m, i) => (
            <div
              key={m.managerId}
              className={`kpi-card p-3 border-l-4 ${MANAGER_COLORS[m.managerId] ?? "border-gray-300"}`}
              data-testid={`kpi-manager-${m.managerId}`}
            >
              <div className="text-xs text-muted-foreground truncate">{m.managerName.split(" ")[0]}</div>
              <div className="text-lg font-bold">{m.projectedEventPoints.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">proj. pts</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state before refresh */}
      {results.length === 0 && (
        <div className="empty-state mb-6">
          <Flag className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">No leaderboard data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click Refresh to pull the live leaderboard from ESPN.</p>
        </div>
      )}

      {/* Full leaderboard */}
      {results.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold">Live Leaderboard</h2>
              <span className="text-xs text-muted-foreground">{results.length} players · {rosteredCount} rostered</span>
            </div>
            {/* Color legend */}
            <div className="hidden sm:flex items-center gap-3 flex-wrap justify-end">
              {activeManagerIds.map(mid => (
                <div key={mid} className="flex items-center gap-1.5 text-xs">
                  <span className={`w-2.5 h-2.5 rounded-full ${MANAGER_DOT[mid] ?? "bg-gray-400"}`} />
                  <span className={MANAGER_TEXT[mid] ?? ""}>{managerNames[mid]?.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2 w-12">POS</th>
                  <th className="text-left px-4 py-2">PLAYER</th>
                  <th className="text-right px-4 py-2 w-16">SCORE</th>
                  <th className="text-right px-4 py-2 w-24 hidden sm:table-cell">PROJ PTS</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => {
                  const pos = positionLabel(r.positionNum, results);
                  const isRostered = r.isRostered;
                  const mid = r.managerId ?? "";

                  return (
                    <tr
                      key={r.id ?? idx}
                      data-testid={`row-player-${idx}`}
                      className={`border-b border-border/50 transition-colors ${
                        isRostered
                          ? `${MANAGER_COLORS[mid] ?? "bg-gray-50 dark:bg-gray-800"} font-medium`
                          : "hover:bg-muted/30"
                      }`}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{pos}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {isRostered && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${MANAGER_DOT[mid] ?? "bg-gray-400"}`} />
                          )}
                          <span className={isRostered ? "" : "text-muted-foreground"}>{r.playerName || "—"}</span>
                          {isRostered && r.managerName && (
                            <span className={`text-xs hidden sm:inline ${MANAGER_TEXT[mid] ?? ""}`}>
                              {r.managerName.split(" ")[0]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        <span className={
                          r.score && r.score.startsWith("-") ? "text-green-600 dark:text-green-400" :
                          r.score === "E" ? "" :
                          r.score && r.score !== "0" ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                        }>
                          {r.score ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right hidden sm:table-cell">
                        {isRostered && r.effectivePoints > 0 ? (
                          <span className="text-xs font-semibold text-primary">{r.effectivePoints.toLocaleString()}</span>
                        ) : isRostered ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
