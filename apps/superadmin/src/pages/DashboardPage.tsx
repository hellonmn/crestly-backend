import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { api } from "@/lib/api";
import { useSuperAuth } from "@/lib/auth-store";
import type { PlatformLedgerOverview, SchoolListResponse, PlatformFeature } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function DashboardPage() {
  const { admin } = useSuperAuth();
  const schools = useQuery({
    queryKey: ["super", "schools"],
    queryFn: async () => (await api.get<SchoolListResponse>("/superadmin/schools")).data,
  });
  const ledger = useQuery({
    queryKey: ["super", "ledger"],
    queryFn: async () => (await api.get<PlatformLedgerOverview>("/superadmin/ledger")).data,
  });
  const catalog = useQuery({
    queryKey: ["super", "catalog"],
    queryFn: async () => (await api.get<PlatformFeature[]>("/superadmin/catalog")).data,
  });

  const today = new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

  return (
    <>
      <PageHead
        group="HOME"
        meta={today}
        title={`Welcome, ${admin?.name?.split(" ")[0] ?? "admin"}`}
        lede="Platform control plane — onboarded schools, recurring revenue, feature catalog."
      />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="users" label="ACTIVE SCHOOLS" value={String(schools.data?.totals.active ?? "—")} delta={`${schools.data?.totals.all ?? 0} total`} />
        <StatTile tint="mint" icon="rupee" label="LIFETIME REVENUE" value={ledger.data ? fmt(ledger.data.totalCollected) : "—"} delta="paid purchases" />
        <StatTile tint="rose" icon="alert" label="ONBOARDING" value={String(schools.data?.totals.onboarding ?? "—")} delta="awaiting go-live" />
        <StatTile tint="sky" icon="library" label="CATALOG" value={String(catalog.data?.length ?? "—")} delta={`${catalog.data?.filter((f) => f.isCore).length ?? 0} core`} />
      </div>

      <div className="grid grid--split grid--gap-lg">
        <div className="card">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="display-s" style={{ fontSize: 18 }}>Recent schools</div>
            <Link to="/schools" className="btn btn--ghost btn--sm">View all</Link>
          </div>
          <table className="data-table">
            <thead><tr><th>Name</th><th>City</th><th>Status</th></tr></thead>
            <tbody>
              {schools.data?.items.slice(-8).reverse().map((s) => (
                <tr key={s.id}>
                  <td className="td-name">
                    <Link to={`/schools/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>{s.name}</Link>
                    <div className="muted body-s">{s.contactPerson ?? "—"}</div>
                  </td>
                  <td className="muted">{s.city ?? "—"}</td>
                  <td>
                    <span className={`pill ${s.status === "active" ? "pill--success" : s.status === "suspended" ? "pill--error" : "pill--warn"}`}>
                      <span className="pill__dot" />{s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <div className="display-s" style={{ fontSize: 18 }}>Top schools by revenue</div>
            <Link to="/ledger" className="btn btn--ghost btn--sm">Ledger →</Link>
          </div>
          {!ledger.data || ledger.data.bySchool.length === 0 ? (
            <p className="muted">No purchases yet.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>School</th><th>Purchases</th><th>Revenue</th></tr></thead>
              <tbody>
                {ledger.data.bySchool.slice(0, 6).map((s) => (
                  <tr key={s.schoolId}>
                    <td className="td-name">{s.schoolName}</td>
                    <td className="mono">{s.purchases}</td>
                    <td className="mono">{fmt(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid--cols-3 grid--gap-sm">
        <Shortcut to="/onboard" title="Onboard a school" sub="Spin up a new tenant" icon="plus" />
        <Shortcut to="/upgrades" title="Apply migrations" sub="Roll out tenant DB upgrades" icon="features" />
        <Shortcut to="/admins" title="Manage admins" sub="Invite or revoke platform users" icon="team" />
      </div>
    </>
  );
}

function Shortcut({ to, title, sub, icon }: { to: string; title: string; sub: string; icon: "plus" | "features" | "team" }) {
  return (
    <Link to={to} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div className="stat-tile__icon icon-tint-wheat"><Icon name={icon} size={20} /></div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <p className="muted body-s" style={{ margin: 0 }}>{sub}</p>
      </div>
    </Link>
  );
}
