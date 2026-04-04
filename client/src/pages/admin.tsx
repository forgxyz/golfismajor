import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Settings, RefreshCw, Trash2, Plus, Edit3 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface LeagueRule { key: string; value: string; description: string | null; }
interface PlayerAlias { id: number; apiName: string; canonicalName: string; }
interface Event { id: string; name: string; status: string | null; startDate: string | null; eventCategory: string; isCurrent: boolean; isMajor: boolean; }
interface PlayerTotal { playerName: string; fedexPoints: number; fedexRank: number | null; updatedAt: string | null; }

const CATEGORIES = ["major", "signature", "full_field", "additional", "team_event", "playoff_1", "playoff_2"];

export default function AdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"players" | "events" | "aliases" | "rules">("players");

  // Data queries
  const { data: rules = [] } = useQuery<LeagueRule[]>({ queryKey: ["/api/rules"] });
  const { data: aliases = [] } = useQuery<PlayerAlias[]>({ queryKey: ["/api/aliases"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: playerTotals = [] } = useQuery<PlayerTotal[]>({ queryKey: ["/api/player-totals"] });
  const { data: rosters = [] } = useQuery<{ managerId: string; managerName: string; players: { name: string; fedexPoints: number; fedexRank: number | null }[] }[]>({ queryKey: ["/api/rosters"] });

  // Form state
  const [newAlias, setNewAlias] = useState({ apiName: "", canonicalName: "" });
  const [editRule, setEditRule] = useState<{ key: string; value: string } | null>(null);
  const [playerEdit, setPlayerEdit] = useState<{ name: string; points: string; rank: string }>({ name: "", points: "", rank: "" });
  const [scheduleResult, setScheduleResult] = useState<string | null>(null);

  // Mutations
  const upsertAlias = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/aliases", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/aliases"] }); setNewAlias({ apiName: "", canonicalName: "" }); toast({ title: "Alias saved" }); },
  });
  const deleteAlias = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/aliases/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/aliases"] }); toast({ title: "Alias deleted" }); },
  });
  const upsertRule = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/rules", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/rules"] }); setEditRule(null); toast({ title: "Rule saved" }); },
  });
  const setCurrentEvent = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/events/${id}/set-current`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events"] }); queryClient.invalidateQueries({ queryKey: ["/api/current-event"] }); toast({ title: "Current event updated" }); },
  });
  const updateCategory = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) => apiRequest("POST", `/api/events/${id}/category`, { category }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/events"] }); toast({ title: "Category updated" }); },
  });
  const refreshSchedule = useMutation({
    mutationFn: () => apiRequest("POST", "/api/refresh/schedule"),
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      const data = await res.json?.() ?? {};
      setScheduleResult(`Fetched ${data.count ?? 0} events from TheSportsDB`);
      toast({ title: "Schedule refreshed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const updatePlayerPoints = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/player-totals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/standings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rosters"] });
      setPlayerEdit({ name: "", points: "", rank: "" });
      toast({ title: "Player points updated" });
    },
  });

  const allRosteredPlayers = rosters.flatMap(r => r.players.map(p => ({ ...p, managerName: r.managerName })));

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Settings size={28} style={{ color: "var(--color-primary)" }} />
          Admin
        </h1>
        <p className="page-subtitle">League configuration, overrides, and manual data corrections</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-6)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-3)" }}>
        {(["players", "events", "aliases", "rules"] as const).map(t => (
          <button
            key={t}
            className={`btn btn-sm ${tab === t ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setTab(t)}
            data-testid={`tab-${t}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Players Tab ── */}
      {tab === "players" && (
        <div>
          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">Update Player FedExCup Points</div>
              <div className="table-card-meta">Override season points for any rostered player</div>
            </div>
            <div style={{ padding: "var(--space-5)" }}>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">Player</label>
                  <select
                    className="form-select"
                    value={playerEdit.name}
                    onChange={e => {
                      const found = allRosteredPlayers.find(p => p.name === e.target.value);
                      setPlayerEdit({ name: e.target.value, points: String(found?.fedexPoints ?? ""), rank: String(found?.fedexRank ?? "") });
                    }}
                    data-testid="select-player"
                  >
                    <option value="">Select player…</option>
                    {allRosteredPlayers.map(p => (
                      <option key={p.name} value={p.name}>{p.name} ({p.managerName})</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-label">FedEx Points</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    value={playerEdit.points}
                    onChange={e => setPlayerEdit(prev => ({ ...prev, points: e.target.value }))}
                    placeholder="e.g. 1224"
                    data-testid="input-player-points"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">FedEx Rank</label>
                  <input
                    className="form-input"
                    type="number"
                    value={playerEdit.rank}
                    onChange={e => setPlayerEdit(prev => ({ ...prev, rank: e.target.value }))}
                    placeholder="e.g. 4"
                    data-testid="input-player-rank"
                    style={{ width: 100 }}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!playerEdit.name || !playerEdit.points || updatePlayerPoints.isPending}
                  onClick={() => updatePlayerPoints.mutate({ playerName: playerEdit.name, fedexPoints: parseFloat(playerEdit.points), fedexRank: parseInt(playerEdit.rank) || null })}
                  data-testid="btn-save-player"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">Current Player Totals</div>
              <div className="table-card-meta">All rostered players</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Manager</th>
                    <th style={{ textAlign: "right" }}>FedEx Points</th>
                    <th style={{ textAlign: "right" }}>Rank</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {allRosteredPlayers.sort((a, b) => b.fedexPoints - a.fedexPoints).map(p => {
                    const total = playerTotals.find(t => t.playerName === p.name);
                    return (
                      <tr key={p.name}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>{p.managerName}</td>
                        <td style={{ textAlign: "right" }}>
                          <span className={`points-pill ${p.fedexPoints === 0 ? "zero" : ""}`}>
                            {p.fedexPoints > 0 ? p.fedexPoints.toLocaleString("en-US", { maximumFractionDigits: 1 }) : "—"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                          {p.fedexRank ? `#${p.fedexRank}` : "—"}
                        </td>
                        <td style={{ color: "var(--color-text-faint)", fontSize: "var(--text-xs)" }}>
                          {total?.updatedAt ? new Date(total.updatedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Events Tab ── */}
      {tab === "events" && (
        <div>
          <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-primary"
              onClick={() => refreshSchedule.mutate()}
              disabled={refreshSchedule.isPending}
              data-testid="btn-refresh-schedule"
            >
              <RefreshCw size={14} className={refreshSchedule.isPending ? "animate-spin" : ""} />
              Pull Schedule from TheSportsDB
            </button>
            {scheduleResult && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{scheduleResult}</span>}
          </div>

          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">Events</div>
              <div className="table-card-meta">Set current event · override category</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} style={ev.isCurrent ? { background: "var(--color-primary-highlight)" } : {}}>
                      <td>
                        <span style={{ fontWeight: ev.isCurrent ? 700 : 400 }}>{ev.name}</span>
                        {ev.isCurrent && <span className="status-badge status-live" style={{ marginLeft: "var(--space-2)" }}>CURRENT</span>}
                        {ev.isMajor && <span className="status-badge" style={{ marginLeft: "var(--space-2)", background: "var(--color-gold-highlight)", color: "var(--color-gold)" }}>Major</span>}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>{ev.startDate ?? "—"}</td>
                      <td>
                        <select
                          className="form-select"
                          style={{ minWidth: 120, padding: "2px var(--space-2)", fontSize: "var(--text-xs)" }}
                          value={ev.eventCategory}
                          onChange={e => updateCategory.mutate({ id: ev.id, category: e.target.value })}
                          data-testid={`select-category-${ev.id}`}
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className={`status-badge status-${ev.status ?? "scheduled"}`}>{ev.status ?? "scheduled"}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {!ev.isCurrent && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => setCurrentEvent.mutate(ev.id)}
                            data-testid={`btn-set-current-${ev.id}`}
                          >
                            Set Current
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--color-text-faint)", padding: "var(--space-8)" }}>No events. Pull schedule to populate.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Aliases Tab ── */}
      {tab === "aliases" && (
        <div>
          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">Add Name Alias</div>
              <div className="table-card-meta">Map API name variants to canonical roster names</div>
            </div>
            <div style={{ padding: "var(--space-5)" }}>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label">API Name (as returned by API)</label>
                  <input className="form-input" value={newAlias.apiName} onChange={e => setNewAlias(p => ({ ...p, apiName: e.target.value }))} placeholder="e.g. Ludvig Aberg" data-testid="input-api-name" />
                </div>
                <div className="form-field">
                  <label className="form-label">Canonical Name (matches roster)</label>
                  <input className="form-input" value={newAlias.canonicalName} onChange={e => setNewAlias(p => ({ ...p, canonicalName: e.target.value }))} placeholder="e.g. Ludvig Åberg" data-testid="input-canonical-name" />
                </div>
                <button
                  className="btn btn-primary"
                  disabled={!newAlias.apiName.trim() || !newAlias.canonicalName.trim() || upsertAlias.isPending}
                  onClick={() => upsertAlias.mutate(newAlias)}
                  data-testid="btn-add-alias"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
          </div>
          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">Existing Aliases</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>API Name</th>
                    <th>Canonical Name</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {aliases.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}>{a.apiName}</td>
                      <td style={{ fontWeight: 600 }}>{a.canonicalName}</td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteAlias.mutate(a.id)} data-testid={`btn-delete-alias-${a.id}`}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {aliases.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--color-text-faint)", padding: "var(--space-6)" }}>No aliases configured.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Rules Tab ── */}
      {tab === "rules" && (
        <div>
          <div className="table-card">
            <div className="table-card-header">
              <div className="table-card-title">League Rules</div>
              <div className="table-card-meta">Click a rule to edit its value</div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Description</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.key}>
                      <td style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{r.key}</td>
                      <td>
                        {editRule?.key === r.key ? (
                          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                            <input
                              className="form-input"
                              value={editRule.value}
                              onChange={e => setEditRule(prev => prev ? { ...prev, value: e.target.value } : null)}
                              style={{ width: 100 }}
                              data-testid={`input-rule-${r.key}`}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => upsertRule.mutate({ key: r.key, value: editRule.value, description: r.description })}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditRule(null)}>Cancel</button>
                          </div>
                        ) : (
                          <strong>{r.value}</strong>
                        )}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>{r.description}</td>
                      <td style={{ textAlign: "right" }}>
                        {editRule?.key !== r.key && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setEditRule({ key: r.key, value: r.value })} data-testid={`btn-edit-rule-${r.key}`}>
                            <Edit3 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
