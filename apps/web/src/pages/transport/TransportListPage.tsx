import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { usePickupPoints } from "./hooks";
import { useAuth } from "@/lib/auth-store";

/* ============================================================
   Transport pickup-points list — ports erp/transport/index.php.
   Stat tiles · search toolbar · clickable rows that jump into
   the pickup detail page. Search lives in the URL with a 250ms
   debounce so reload / share works.
   ============================================================ */

function moneyCompact(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}
function padId(n: number): string { return String(n).padStart(3, "0"); }

export function TransportListPage() {
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("transport.manage");
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [qInput, setQInput] = useState(q);

  // Debounce search → URL
  useMemo(() => {
    const t = setTimeout(() => {
      if (qInput === q) return;
      const next = new URLSearchParams(params);
      if (qInput) next.set("q", qInput); else next.delete("q");
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error, refetch, isFetching } = usePickupPoints(q || undefined);

  return (
    <>
      <PageHead
        group="LOGISTICS"
        meta="TRANSPORT"
        title="Transport"
        lede="Pickup points, distance slabs, and bus-fee revenue for the current session. Tap a row to see the student roster on that route."
        actions={
          <>
            <Link to="/transport/slabs" className="btn btn--ghost btn--sm">
              <Icon name="features" size={14} /> Fee slabs →
            </Link>
            {canManage && (
              <Link to="/transport/new" className="btn btn--primary btn--sm">
                <Icon name="plus" size={14} /> Add pickup
              </Link>
            )}
          </>
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="pickup points" />

      {/* Stat tiles — match PHP order: Pickups / Students / Revenue / Slabs */}
      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile
          tint="sky"
          icon="transport"
          label="PICKUP POINTS"
          value={String(data?.totalPickups ?? "—")}
          delta={data ? `${data.activePickups.toLocaleString("en-IN")} with students` : ""}
        />
        <StatTile
          tint="mint"
          icon="students"
          label="STUDENTS ON TRANSPORT"
          value={String(data?.totalStudents ?? "—")}
          delta="across all pickups"
        />
        <StatTile
          tint="rose"
          icon="rupee"
          label="TRANSPORT REVENUE"
          value={data ? moneyCompact(data.totalRevenue) : "—"}
          delta="payable this session"
        />
        <StatTile
          tint="mustard"
          icon="features"
          label="DISTANCE SLABS"
          value={String(data?.totalSlabs ?? "—")}
          delta={
            <Link to="/transport/slabs" style={{ color: "var(--ink-60)", textDecoration: "underline" }}>
              View fee matrix →
            </Link> as unknown as string
          }
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar card" style={{ padding: "12px 16px" }}>
        <div className="search" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search pickup point…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <Link to="/transport/slabs" className="btn btn--ghost btn--sm">Fee slabs →</Link>
        {canManage && (
          <Link to="/transport/new" className="btn btn--primary btn--sm">
            <Icon name="plus" size={14} /> Add pickup
          </Link>
        )}
      </div>

      {/* List */}
      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Pickup Points<BrandDot /></h3>
            <div className="table-card__sub">
              Showing {(data?.items.length ?? 0).toLocaleString("en-IN")} of {data?.totalPickups ?? "—"}
              {q && <> · filtered by "{q}"</>}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={6} cols={6} /></div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
            <div className="muted body-s">
              No pickup points match.
              {canManage && (
                <>
                  {" "}
                  <Link to="/transport/new">Add the first one →</Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Name</th>
                <th style={{ width: 100 }}>Distance</th>
                <th style={{ width: 120 }}>Slab</th>
                <th style={{ width: 90 }}>Students</th>
                <th style={{ width: 120 }}>Revenue</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((p) => (
                <tr
                  key={p.id}
                  className="tr-link"
                  onClick={() => navigate(`/transport/${p.id}`)}
                >
                  <td className="mono" style={{ color: "var(--ink-60)" }}>{padId(p.id)}</td>
                  <td className="td-name">
                    <b>{p.name}</b>
                    {p.googleMapsLink && (
                      <a
                        href={p.googleMapsLink}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => e.stopPropagation()}
                        className="muted body-s"
                        style={{ marginLeft: 8, fontSize: 11, textDecoration: "none" }}
                      >
                        Maps ↗
                      </a>
                    )}
                  </td>
                  <td className="mono body-s">
                    {p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : <span className="muted">—</span>}
                  </td>
                  <td>
                    {p.slab ? (
                      <span className="pill pill--wheat" style={{ fontSize: 11, padding: "1px 8px" }}>
                        {p.slab}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="mono body-s">{p.studentCount.toLocaleString("en-IN")}</td>
                  <td className="mono body-s">{moneyCompact(p.revenue)}</td>
                  <td className="muted" aria-hidden="true">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{TRANS_CSS}</style>
    </>
  );
}

const TRANS_CSS = `
  .tr-link { cursor: pointer; transition: background 120ms ease; }
  .tr-link:hover { background: var(--cream-soft); }
`;
