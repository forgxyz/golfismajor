import { useQuery } from "@tanstack/react-query";
import { Star, DollarSign } from "lucide-react";

interface MajorPayout {
  id: number;
  eventId: string;
  eventName: string;
  season: number;
  winnerName: string | null;
  managerId: string | null;
  payoutAmount: number;
  triggered: boolean;
}

interface ManagerBalance {
  managerId: string;
  managerName: string;
  balance: number;
}

interface MajorPayoutsData {
  payouts: MajorPayout[];
  managerBalances: ManagerBalance[];
}

export default function MajorsPage() {
  const { data, isLoading } = useQuery<MajorPayoutsData>({ queryKey: ["/api/major-payouts"] });

  if (isLoading) {
    return <div className="page"><div className="empty-state">Loading major data…</div></div>;
  }

  const { payouts = [], managerBalances = [] } = data ?? {};
  const triggered = payouts.filter(p => p.triggered);
  const totalPaid = triggered.reduce((s, p) => s + (p.triggered ? p.payoutAmount : 0), 0);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Major Championships</h1>
        <p className="page-subtitle">Side pot tracker · $250 to winning manager per major · 2026 Season</p>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Majors This Season</div>
          <div className="kpi-value">{payouts.length}</div>
          <div className="kpi-sub">{triggered.length} completed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Paid Out</div>
          <div className="kpi-value">${totalPaid.toLocaleString()}</div>
          <div className="kpi-sub">to winning managers</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Rostered Winner</div>
          <div className="kpi-value">{triggered.filter(p => p.managerId).length}</div>
          <div className="kpi-sub">of {triggered.length} majors</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Remaining Majors</div>
          <div className="kpi-value">{payouts.filter(p => !p.triggered).length}</div>
          <div className="kpi-sub">side pots available</div>
        </div>
      </div>

      {/* Major ledger */}
      <div className="table-card" data-testid="major-ledger">
        <div className="table-card-header">
          <div className="table-card-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Star size={16} style={{ color: "var(--color-gold)" }} />
            Major Payout Ledger
          </div>
          <div className="table-card-meta">Settled automatically after each major</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Major</th>
                <th>Season</th>
                <th>Winner</th>
                <th>Rostered By</th>
                <th style={{ textAlign: "right" }}>Payout</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => {
                const managerName = p.managerId
                  ? managerBalances.find(m => m.managerId === p.managerId)?.managerName
                  : null;
                return (
                  <tr key={p.id} data-testid={`major-row-${p.id}`}>
                    <td style={{ fontWeight: 600 }}>{p.eventName}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>{p.season}</td>
                    <td>{p.winnerName ?? <span style={{ color: "var(--color-text-faint)" }}>TBD</span>}</td>
                    <td>
                      {managerName
                        ? <span className="player-tag top3">{managerName}</span>
                        : p.triggered
                          ? <span style={{ color: "var(--color-text-faint)", fontSize: "var(--text-xs)" }}>Not rostered</span>
                          : <span style={{ color: "var(--color-text-faint)", fontSize: "var(--text-xs)" }}>—</span>
                      }
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {p.triggered && p.managerId
                        ? <span className="payout-yes">${p.payoutAmount.toLocaleString()}</span>
                        : <span className="payout-no">—</span>
                      }
                    </td>
                    <td>
                      {p.triggered
                        ? <span className="status-badge status-final">✓ Final</span>
                        : <span className="status-badge" style={{ background: "var(--color-gold-highlight)", color: "var(--color-gold)" }}>Pending</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manager cash balances */}
      <div className="table-card" data-testid="balance-table">
        <div className="table-card-header">
          <div className="table-card-title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <DollarSign size={16} style={{ color: "var(--color-success)" }} />
            Manager Cash Balances
          </div>
          <div className="table-card-meta">Running total across all major payouts</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Manager</th>
                <th style={{ textAlign: "right" }}>Net Balance</th>
              </tr>
            </thead>
            <tbody>
              {[...managerBalances].sort((a, b) => b.balance - a.balance).map(m => (
                <tr key={m.managerId} data-testid={`balance-row-${m.managerId}`}>
                  <td style={{ fontWeight: 600 }}>{m.managerName}</td>
                  <td style={{ textAlign: "right" }}>
                    <span className={m.balance > 0 ? "balance-pos" : m.balance < 0 ? "balance-neg" : "balance-zero"}>
                      {m.balance > 0 ? `+$${m.balance}` : m.balance < 0 ? `-$${Math.abs(m.balance)}` : "$0"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
