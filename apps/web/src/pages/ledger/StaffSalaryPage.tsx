import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useStaffSalaryLedger } from "./hooks";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function StaffSalaryPage() {
  const [month, setMonth] = useState(currentMonth());
  const [q, setQ] = useState("");
  const { data, isLoading } = useStaffSalaryLedger({ month, q: q || undefined });

  function shift(delta: number) {
    const [yr, mo] = month.split("-").map(Number);
    let y = yr!, m = mo! + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    setMonth(`${y}-${String(m).padStart(2, "0")}`);
  }

  return (
    <>
      <PageHead
        group="FINANCE"
        meta={month}
        title="Staff Salary"
        lede="Computed vs paid vs due, per staff for the selected month."
        actions={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(-1)}>‹ Prev</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setMonth(currentMonth())}>This month</button>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(1)}>Next ›</button>
            <Link to="/ledger" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Ledger
            </Link>
          </>
        }
      />

      <div className="toolbar card">
        <div className="search">
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search by name, employee id, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }}
          />
        </div>
      </div>

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="rupee" label="COMPUTED" value={data ? fmt(data.totalComputed) : "—"} delta={`${data?.staffCount ?? "—"} staff`} />
        <StatTile tint="mint" icon="check" label="PAID OUT" value={data ? fmt(data.totalPaid) : "—"} delta="" />
        <StatTile tint="rose" icon="alert" label="DUE" value={data ? fmt(data.totalDue) : "—"} delta="" />
        <StatTile tint="wheat" icon="info" label="PENDING VOUCHERS" value={String(data?.pendingVouchers ?? "—")} delta="" />
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Monthly</th>
              <th>Days marked</th>
              <th>Computed</th>
              <th>Paid</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {data?.rows.map((r) => (
              <tr key={r.userId}>
                <td className="td-name">
                  <Link to={`/salary?userId=${r.userId}&month=${month}`} style={{ textDecoration: "none", color: "inherit" }}>
                    {r.name}
                  </Link>
                  <div className="muted body-s">{r.designation ?? "—"} {r.department ? `· ${r.department}` : ""}</div>
                </td>
                <td className="mono">{fmt(r.monthlySalary)}</td>
                <td className="mono">{r.presentDays} / {r.monthDays}</td>
                <td className="mono">{fmt(r.computed)}</td>
                <td className="mono">{fmt(r.paid)}</td>
                <td className="mono">
                  {fmt(r.due)}
                  {r.pendingVouchers > 0 && <span className="pill pill--warn" style={{ marginLeft: 4, fontSize: 9 }}>{r.pendingVouchers} pending</span>}
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link to={`/salary?userId=${r.userId}&month=${month}`} className="btn btn--ghost btn--sm">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
