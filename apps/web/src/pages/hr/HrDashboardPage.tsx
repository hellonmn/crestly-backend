import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import type { HrDashboard } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function HrDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["hr", "dashboard"],
    queryFn: async () => (await api.get<HrDashboard>("/hr/dashboard")).data,
  });

  return (
    <>
      <PageHead
        group="HR"
        title="HR Dashboard"
        lede="Live HR snapshot."
        actions={
          <>
            <Link to="/team" className="btn btn--ghost btn--sm">Team</Link>
            <Link to="/leaves" className="btn btn--ghost btn--sm">Leaves</Link>
            <Link to="/holidays" className="btn btn--ghost btn--sm">Holidays</Link>
            <Link to="/shifts" className="btn btn--ghost btn--sm">Duty hours</Link>
            <Link to="/ledger/staff" className="btn btn--ghost btn--sm">Salary ledger</Link>
          </>
        }
      />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="team" label="ACTIVE STAFF" value={String(data?.totals.activeStaff ?? "—")} delta="" />
        <StatTile tint="mint" icon="punch" label="PUNCHED-IN TODAY" value={String(data?.totals.punchedInToday ?? "—")} delta="" />
        <StatTile tint="wheat" icon="leaves" label="ON LEAVE TODAY" value={String(data?.totals.onLeaveToday ?? "—")} delta="" />
        <StatTile tint="rose" icon="rupee" label="SALARY (MTD)" value={data ? fmt(data.totals.salaryThisMonth) : "—"} delta="" />
      </div>

      {isLoading && <p className="muted">Loading…</p>}

      <div className="grid grid--split grid--gap-lg">
        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Pending leave approvals</div>
          {data?.pendingLeaves.length === 0 && <p className="muted">All clear.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data?.pendingLeaves.map((l) => (
              <Link
                key={l.id}
                to={`/leaves?status=pending`}
                style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 8, padding: 8, borderRadius: 6, background: "var(--cream-soft)" }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{l.userName}</div>
                  <div className="muted body-s">{l.leaveType} · {l.fromDate} → {l.toDate}</div>
                </div>
                <span className="cls-pill">{l.days} d</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>On leave today</div>
          {data?.onLeaveToday.length === 0 && <p className="muted">Nobody is on leave today.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data?.onLeaveToday.map((l) => (
              <div key={l.userId} style={{ display: "flex", gap: 8 }}>
                <span style={{ flex: 1 }}>{l.userName}</span>
                <span className="muted">{l.leaveType}</span>
                <span className="muted mono" style={{ fontSize: 11 }}>until {l.until}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Upcoming holidays</div>
          {data?.upcomingHolidays.length === 0 && <p className="muted">None in the next 60 days.</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {data?.upcomingHolidays.map((h) => (
              <div key={h.holidayDate} style={{ display: "flex", gap: 8 }}>
                <span className="cls-pill mono" style={{ minWidth: 92, textAlign: "center" }}>{h.holidayDate}</span>
                <span style={{ flex: 1 }}>{h.name}</span>
                <span className="pill pill--wheat">{h.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Headcount by department</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data?.headcountByDepartment.map((h) => {
              const max = Math.max(...(data?.headcountByDepartment ?? []).map((x) => x.count));
              const pct = max > 0 ? (h.count / max) * 100 : 0;
              return (
                <div key={h.department}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{h.department}</span>
                    <span className="mono">{h.count}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--cream-soft)", borderRadius: 999 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--info)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
