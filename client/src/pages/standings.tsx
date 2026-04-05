import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Trophy, TrendingUp } from "lucide-react";

interface PlayerRow {
  name: string;
  fedexPoints: number;
  fedexRank: number | null;
  isTop3: boolean;
}

interface ManagerStanding {
  managerId: string;
  managerName: string;
  rank: number;
  top3Points: number;
  allPoints: number;
  players: PlayerRow[];
}

function formatPoints(pts: number) {
  if (pts === 0) return "—";
  return pts.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export default function StandingsPage() {
  const { data: standings, isLoading } = useQuery<ManagerStanding[]>({
    queryKey: ["/api/standings"],
    refetchInterval: 60_000,
  });

  const leader = standings?.[0];
  const secondPlace = standings?.[1];
  const margin = leader && secondPlace ? leader.top3Points - secondPlace.top3Points : 0;

  // Best single player across all rosters
  const allPlayers = standings?.flatMap(s => s.players) ?? [];
  const topPlayer = allPlayers.reduce((best, p) => (!best || p.fedexPoints > best.fedexPoints) ? p : best, null as PlayerRow | null);
  const topPlayerManager = topPlayer ? standings?.find(s => s.players.some(p => p.name === topPlayer.name)) : null;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">League Standings</h1>
        <p className="page-subtitle">Ranked by top-3 FedExCup points per manager · 2026 PGA TOUR Season</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card" data-testid="kpi-leader">
          <div className="kpi-label">Current Leader</div>
          <div className="kpi-value">{leader?.managerName.split(" ")[0] ?? "—"}</div>
          <div className="kpi-sub">{formatPoints(leader?.top3Points ?? 0)} pts</div>
        </div>
        <div className="kpi-card" data-testid="kpi-margin">
          <div className="kpi-label">Lead Margin</div>
          <div className="kpi-value">{formatPoints(margin)}</div>
          <div className="kpi-sub">pts ahead of 2nd</div>
        </div>
        <div className="kpi-card" data-testid="kpi-top-player">
          <div className="kpi-label">Top Player</div>
          <div className="kpi-value" style={{ fontSize: "clamp(1rem, 0.9rem + 0.5vw, 1.25rem)" }}>
            {topPlayer?.name.split(" ").slice(-1)[0] ?? "—"}
          </div>
          <div className="kpi-sub">{formatPoints(topPlayer?.fedexPoints ?? 0)} FedEx pts · {topPlayerManager?.managerName.split(" ")[0]}</div>
        </div>
      </div>

      {/* Main Standings Table */}
      <div className="table-card" data-testid="standings-table">
        <div className="table-card-header">
          <div className="table-card-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Trophy size={16} style={{ color: "var(--color-primary)" }} />
            Season Standings
          </div>
          <div className="table-card-meta">Top 3 of 5 counted</div>
        </div>
        <div className="table-wrap">
          {isLoading ? (
            <div className="empty-state">Loading standings…</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Rank</th>
                  <th>Manager</th>
                  <th style={{ textAlign: "right" }}>Counted Pts</th>
                  <th style={{ textAlign: "right" }}>All 5 Pts</th>
                  <th>Top 3 Players</th>
                  <th>Bench</th>
                </tr>
              </thead>
              <tbody>
                {standings?.map((s) => {
                  const top3 = s.players.filter(p => p.isTop3);
                  const bench = s.players.filter(p => !p.isTop3);
                  return (
                    <tr key={s.managerId} data-testid={`standing-row-${s.managerId}`}>
                      <td>
                        <span className={`rank-badge rank-${s.rank <= 3 ? s.rank : ""}`}>
                          {s.rank}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{s.managerName}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className="points-pill">{formatPoints(s.top3Points)}</span>
                      </td>
                      <td style={{ textAlign: "right", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                        {formatPoints(s.allPoints)}
                      </td>
                      <td>
                        <div className="player-list">
                          {top3.map(p => (
                            <span key={p.name} className="player-tag top3" title={`FedEx Rank: ${p.fedexRank ?? "N/A"}`}>
                              {p.name}
                              <span style={{ opacity: 0.7 }}>· {formatPoints(p.fedexPoints)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="player-list">
                          {bench.map(p => (
                            <span key={p.name} className="player-tag" title={`FedEx Rank: ${p.fedexRank ?? "N/A"}`}>
                              {p.name}
                              <span style={{ opacity: 0.7 }}>· {formatPoints(p.fedexPoints)}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full Roster Detail */}
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <TrendingUp size={14} />
          Full Roster Breakdown
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
        {standings?.map(s => (
          <div key={s.managerId} className="table-card" data-testid={`roster-card-${s.managerId}`} style={{ marginBottom: 0 }}>
            <div className="table-card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span className={`rank-badge rank-${s.rank <= 3 ? s.rank : ""}`}>{s.rank}</span>
                <span className="table-card-title">{s.managerName}</span>
              </div>
              <span className="points-pill">{formatPoints(s.top3Points)}</span>
            </div>
            <table>
              <tbody>
                {s.players.map(p => (
                  <tr key={p.name}>
                    <td style={{ paddingLeft: "var(--space-5)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        {p.isTop3 && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)", flexShrink: 0 }} />}
                        <span style={{ fontWeight: p.isTop3 ? 600 : 400, fontSize: "var(--text-sm)" }}>{p.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right", paddingRight: "var(--space-5)" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: p.isTop3 ? 700 : 400, color: p.isTop3 ? "var(--color-primary)" : "var(--color-text-muted)" }}>
                        {formatPoints(p.fedexPoints)}
                      </span>
                      {p.fedexRank && (
                        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-faint)", marginLeft: "var(--space-2)" }}>
                          #{p.fedexRank}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
