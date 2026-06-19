import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { api } from "@/lib/api";
import type { PlatformLedgerOverview } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function LedgerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super", "ledger"],
    queryFn: async () => (await api.get<PlatformLedgerOverview>("/superadmin/ledger")).data,
  });

  return (
    <>
      <PageHead group="REVENUE" title="Ledger" lede="Platform-wide purchase log + per-school revenue." />

      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile tint="mint" icon="rupee" label="LIFETIME REVENUE" value={data ? fmt(data.totalCollected) : "—"} delta="paid" />
        <StatTile tint="wheat" icon="alert" label="PENDING" value={String(data?.pending ?? "—")} delta="awaiting verify" />
        <StatTile tint="rose" icon="x" label="FAILED" value={String(data?.failed ?? "—")} delta="never settled" />
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Top schools by revenue</div>
        {!data || data.bySchool.length === 0 ? (
          <p className="muted">No purchases yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>School</th><th>Purchases</th><th>Revenue</th></tr></thead>
            <tbody>
              {data.bySchool.map((s) => (
                <tr key={s.schoolId}>
                  <td className="td-name">
                    <Link to={`/schools/${s.schoolId}`} style={{ textDecoration: "none", color: "inherit" }}>{s.schoolName}</Link>
                  </td>
                  <td className="mono">{s.purchases}</td>
                  <td className="mono">{fmt(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Recent purchases</div>
        {isLoading && <p className="muted">Loading…</p>}
        {data && data.recent.length === 0 && <p className="muted">No purchases yet.</p>}
        {data && data.recent.length > 0 && (
          <table className="data-table">
            <thead><tr><th>When</th><th>School</th><th>Feature</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.recent.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: 11 }}>
                    {p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="td-name">{p.schoolName}</td>
                  <td className="mono">{p.featureKey}</td>
                  <td className="mono">{fmt(p.amount)}</td>
                  <td>
                    <span className={`pill ${p.status === "paid" ? "pill--success" : p.status === "failed" ? "pill--error" : "pill--warn"}`}>
                      <span className="pill__dot" />{p.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {p.status === "paid" && (
                      <Link to={`/invoice/${p.id}`} className="btn btn--ghost btn--sm">
                        <Icon name="print" size={12} /> Invoice
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
