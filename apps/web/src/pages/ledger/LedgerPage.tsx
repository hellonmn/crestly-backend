import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useLedgerOverview } from "./hooks";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function LedgerPage() {
  const today = new Date();
  const monthStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, []);
  const todayIso = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayIso);
  const { data, isLoading } = useLedgerOverview(from, to);

  function thisMonth() { setFrom(monthStart); setTo(todayIso); }
  function thisYear() {
    const d = new Date(today.getFullYear(), 3, 1); // FY starts April
    if (today.getMonth() < 3) d.setFullYear(today.getFullYear() - 1);
    setFrom(d.toISOString().slice(0, 10));
    setTo(todayIso);
  }

  return (
    <>
      <PageHead
        group="FINANCE"
        title="Expense Ledger"
        lede="Head-wise summary across vouchers."
        actions={
          <Link to="/ledger/staff" className="btn btn--ghost btn--sm">
            <Icon name="team" size={14} /> Staff salary
          </Link>
        }
      />

      <div className="toolbar card">
        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 160 }} />
        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 160 }} />
        <button className="btn btn--ghost btn--sm" onClick={thisMonth}>This month</button>
        <button className="btn btn--ghost btn--sm" onClick={thisYear}>This FY</button>
      </div>

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="rupee" label="TOTAL EXPENSE" value={data ? fmt(data.totalExpense) : "—"} delta={`${from} → ${to}`} />
        <StatTile tint="mint" icon="check" label="PAID" value={data ? fmt(data.paid) : "—"} delta="" />
        <StatTile tint="rose" icon="alert" label="DUE / PENDING" value={data ? fmt(data.due) : "—"} delta="" />
        <StatTile tint="sky" icon="salary" label="STAFF SALARY (MTD)" value={data ? fmt(data.staffSalaryThisMonth) : "—"} delta="" />
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {data?.byCategory.map((r) => (
              <tr key={r.category}>
                <td>{r.category}</td>
                <td className="mono">{r.count}</td>
                <td className="mono">{fmt(r.total)}</td>
                <td className="mono">{fmt(r.paid)}</td>
                <td className="mono">{fmt(r.due)}</td>
                <td style={{ textAlign: "right" }}>
                  <Link to={`/vouchers?category=${encodeURIComponent(r.category)}`} className="btn btn--ghost btn--sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {data && data.byCategory.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>No expenses in this window.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
