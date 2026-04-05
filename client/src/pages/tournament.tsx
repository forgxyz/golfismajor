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

// Returns { label, tiedMinPos } — detects ties by score, not stored positionNum
// (handles stale DB data where ESPN stored sequential 3/4/5 instead of T3/T3/T3)
function tieInfo(score: string | null, allResults: EventResult[]): { isTied: boolean; minPos: number } {
  if (!score || score === "E" || score === "0") return { isTied: false, minPos: 999 };
  const group = allResults.filter(r => r.score === score);
  if (group.length <= 1) return { isTied: false, minPos: group[0]?.positionNum ?? 999 };
  const minPos = group.reduce((m, r) => Math.min(m, r.positionNum ?? 999), 999);
  return { isTied: true, minPos };
}

function positionLabel(pos: number | null, score: string | null, allResults: EventResult[]): string {
  if (!pos) return "—";
  const { isTied, minPos } = tieInfo(score, allResults);
  return isTied ? `T${minPos}` : String(pos);
}

// For tied players, use the top-position's projected points (all tied = same points)
function effectiveDisplayPoints(r: EventResult, allResults: EventResult[]): number {
  const { isTied, minPos } = tieInfo(r.score, allResults);
  if (!isTied) return r.effectivePoints;
  const minPosResult = allResults.find(x => x.score === r.score && x.positionNum === minPos);
  return minPosResult?.effectivePoints ?? r.effectivePoints;
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
      <div className="page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
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
    <div className="page">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
            <h1 className="page-title">{event.name}</h1>
            {event.isMajor && <span className="badge badge-major">Major</span>}
          </div>
          <p className="page-subtitle">
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
        <div className="kpi-grid kpi-grid-3x2">
          {managerRollup.map((m) => (
            <div
              key={m.managerId}
              className={`kpi-card border-l-4 ${MANAGER_COLORS[m.managerId] ?? "border-gray-300"}`}
              data-testid={`kpi-manager-${m.managerId}`}
            >
              <div className="kpi-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${MANAGER_DOT[m.managerId] ?? "bg-gray-400"}`} />
                {m.managerName.split(" ")[0]}
              </div>
              <div className="kpi-value">{m.projectedEventPoints.toLocaleString()}</div>
              <div className="kpi-sub">proj. pts</div>
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
        <div className="table-card">
          <div className="table-card-header">
            <div className="table-card-title">
              Live Leaderboard
              <span className="table-card-meta" style={{ marginLeft: "var(--space-2)" }}>{results.length} players · {rosteredCount} rostered</span>
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

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>POS</th>
                  <th>PLAYER</th>
                  <th style={{ textAlign: "right" }}>SCORE</th>
                  <th style={{ textAlign: "right" }} className="hidden sm:table-cell">PROJ PTS</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => {
                  const pos = positionLabel(r.positionNum, r.score, results);
                  const displayPoints = effectiveDisplayPoints(r, results);
                  const isRostered = r.isRostered;
                  const mid = r.managerId ?? "";

                  return (
                    <tr
                      key={r.id ?? idx}
                      data-testid={`row-player-${idx}`}
                      className={isRostered ? MANAGER_COLORS[mid] ?? "" : ""}
                    >
                      <td style={{ color: "var(--color-text-muted)", fontFamily: "monospace", fontSize: "var(--text-xs)" }}>{pos}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          {isRostered && (
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${MANAGER_DOT[mid] ?? "bg-gray-400"}`} />
                          )}
                          <span style={isRostered ? { fontWeight: 600 } : { color: "var(--color-text-muted)" }}>{r.playerName || "—"}</span>
                          {isRostered && r.managerName && (
                            <span className={`hidden sm:inline text-xs ${MANAGER_TEXT[mid] ?? ""}`}>
                              {r.managerName.split(" ")[0]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                        <span style={{
                          color: r.score && r.score.startsWith("-") ? "var(--color-success)" :
                                 r.score && r.score !== "E" && r.score !== "0" ? "var(--color-danger, #ef4444)" :
                                 "var(--color-text-muted)"
                        }}>
                          {r.score ?? "—"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }} className="hidden sm:table-cell">
                        {isRostered && displayPoints > 0 ? (
                          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-primary)" }}>{displayPoints.toLocaleString()}</span>
                        ) : isRostered ? (
                          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>—</span>
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
