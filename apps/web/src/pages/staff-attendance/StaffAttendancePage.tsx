import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useStaffAttendance } from "./hooks";
import { useTeamList } from "../team/hooks";
import type { PunchType } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  // Local-ISO so the date input shows today in the user's tz, not UTC.
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}
function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date} · ${time}`;
}
function fmtDistance(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StaffAttendancePage() {
  // Apply-style filters: we hold "pending" form values + "applied" query.
  const [pendFrom, setPendFrom]   = useState<string>(isoDaysAgo(0));
  const [pendTo, setPendTo]       = useState<string>(isoDaysAgo(0));
  const [pendUser, setPendUser]   = useState<string>("");                   // userId or ""
  const [pendType, setPendType]   = useState<PunchType | "">("");
  const [pendZone, setPendZone]   = useState<"all" | "in" | "outside">("all");

  const [applied, setApplied] = useState({
    from: pendFrom, to: pendTo, userId: pendUser, type: pendType, zone: pendZone,
  });

  function apply() {
    setApplied({ from: pendFrom, to: pendTo, userId: pendUser, type: pendType, zone: pendZone });
  }
  function reset() {
    const f = isoDaysAgo(0), t = isoDaysAgo(0);
    setPendFrom(f); setPendTo(t); setPendUser(""); setPendType(""); setPendZone("all");
    setApplied({ from: f, to: t, userId: "", type: "", zone: "all" });
  }

  const { data, isLoading } = useStaffAttendance({
    from: applied.from || undefined,
    to: applied.to || undefined,
    userId: applied.userId ? Number(applied.userId) : undefined,
    punchType: applied.type || undefined,
    zone: applied.zone,
    pageSize: 200,
    page: 1,
  });

  // Team roster for the Staff dropdown — only active staff.
  const { data: roster } = useTeamList({ status: "active", pageSize: 200, page: 1 });

  // PHP: capped at 200 rows; we mirror that copy on the TOTAL EVENTS tile.
  const items = data?.items ?? [];
  const distinctStaff = new Set(items.map((p) => p.userId)).size;

  return (
    <>
      <style>{SA_CSS}</style>

      <PageHead
        group="HR"
        meta="STAFF ATTENDANCE"
        title="Staff Attendance"
        lede="Punch log with geo-fence + selfie audit."
      />

      {/* ----- Aggregates ----- */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint"><LogInIcon /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Punch-ins</div>
              <div className="stat-tile__value">{(data?.punchIns ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">{distinctStaff} distinct staff</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-rose"><LogOutIcon /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Punch-outs</div>
              <div className="stat-tile__value">{(data?.punchOuts ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">in selected range</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mustard"><Icon name="alert" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Outside geofence</div>
              <div className="stat-tile__value" style={{ color: "var(--warn)" }}>
                {(data?.outsideCount ?? 0).toLocaleString("en-IN")}
              </div>
              <div className="stat-tile__delta">anomalies to review</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-wheat"><Icon name="calendar" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Total events</div>
              <div className="stat-tile__value">{(data?.total ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">capped at 200 rows</div>
            </div>
          </div>
        </div>
      )}

      {/* ----- Filters ----- */}
      <form
        className="toolbar card"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); apply(); }}
      >
        <div className="sa-filters">
          <div className="field">
            <label className="field__label" htmlFor="sa-from">From</label>
            <input id="sa-from" className="input" type="date" value={pendFrom} onChange={(e) => setPendFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sa-to">To</label>
            <input id="sa-to" className="input" type="date" value={pendTo} onChange={(e) => setPendTo(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sa-user">Staff</label>
            <select id="sa-user" className="select" value={pendUser} onChange={(e) => setPendUser(e.target.value)}>
              <option value="">All</option>
              {roster?.items.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}{u.roleName ? ` · ${u.roleName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sa-type">Type</label>
            <select id="sa-type" className="select" value={pendType} onChange={(e) => setPendType(e.target.value as PunchType | "")}>
              <option value="">All</option>
              <option value="in">Punch-in</option>
              <option value="out">Punch-out</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sa-zone">Zone</label>
            <select id="sa-zone" className="select" value={pendZone} onChange={(e) => setPendZone(e.target.value as typeof pendZone)}>
              <option value="all">Any</option>
              <option value="outside">Outside (anomaly)</option>
              <option value="in">Inside</option>
            </select>
          </div>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <button type="submit" className="btn btn--primary btn--sm">Apply</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>Reset</button>
      </form>

      {/* ----- Desktop punch log ----- */}
      <div className="table-card m-hide">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Punch log<BrandDot /></h3>
            <div className="table-card__sub">{items.length.toLocaleString("en-IN")} rows</div>
          </div>
        </div>
        <div className="sa-head">
          <span>TIME</span>
          <span>STAFF</span>
          <span>TYPE</span>
          <span>DISTANCE</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {isLoading ? (
          <Skeleton.Table rows={6} cols={6} />
        ) : items.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO PUNCHES</div>
            <div className="muted">
              No staff punches recorded in this range.
              {" "}
              <Link to="/punch">Open Punch In/Out</Link> to record one.
            </div>
          </div>
        ) : (
          items.map((r) => (
            <div key={r.id} className={`sa-row ${r.isOutside ? "is-outside" : ""}`}>
              <span className="mono body-s">{shortDateTime(r.punchedAt)}</span>
              <span style={{ minWidth: 0 }}>
                <b>{r.userName}</b>
                <div className="muted body-s" style={{ fontSize: 11 }}>
                  {r.designation ?? r.department ?? "—"}
                </div>
              </span>
              <span>
                <span className={`pill ${r.punchType === "in" ? "pill--success" : "pill--info"}`}>
                  {r.punchType.toUpperCase()}
                </span>
              </span>
              <span className="mono body-s">
                {fmtDistance(r.distanceM)}
                <div className="muted body-s" style={{ fontSize: 11 }}>{r.geofenceType}</div>
              </span>
              <span>
                {r.isOutside ? (
                  <span className="pill pill--warn"><span className="pill__dot" />Outside</span>
                ) : (
                  <span className="pill pill--success"><span className="pill__dot" />In zone</span>
                )}
              </span>
              <span style={{ textAlign: "right" }}>
                <Link to={`/staff-attendance/${r.id}`} className="btn btn--ghost btn--sm">Open</Link>
              </span>
            </div>
          ))
        )}
      </div>

      {/* ----- Mobile list ----- */}
      <div className="m-show">
        <div className="m-list-head">
          <span className="m-list-head__title">Punch log<BrandDot /></span>
          <span className="m-list-head__sub">{items.length.toLocaleString("en-IN")} rows</span>
        </div>
        {isLoading ? (
          <Skeleton.Table rows={4} cols={3} />
        ) : items.length === 0 ? (
          <div className="card" style={{ padding: "28px 18px", textAlign: "center" }}>
            <div className="muted body-s">No punches in range.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((r) => (
              <Link
                key={r.id}
                to={`/staff-attendance/${r.id}`}
                className="card"
                style={{
                  display: "block", padding: "12px 14px",
                  textDecoration: "none", color: "inherit",
                  ...(r.isOutside ? { borderColor: "var(--warn)", background: "rgba(201,122,10,0.04)" } : {}),
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
                  <span className={`pill ${r.punchType === "in" ? "pill--success" : "pill--info"}`}>
                    {r.punchType.toUpperCase()}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.userName}
                    </div>
                    <div className="muted body-s" style={{ fontSize: 11.5 }}>
                      {shortDateTime(r.punchedAt)} · {fmtDistance(r.distanceM)}
                    </div>
                  </div>
                  {r.isOutside ? (
                    <span className="pill pill--warn"><span className="pill__dot" />Outside</span>
                  ) : (
                    <span className="pill pill--success" style={{ opacity: 0.7 }}>In zone</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* Inline icons (PHP uses log-in / log-out arrows). */
function LogInIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/* Inline CSS — verbatim of erp/staff-attendance/index.php. */
const SA_CSS = `
  .sa-filters {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px; flex: 1; min-width: 0;
  }
  @media (max-width: 900px) { .sa-filters { grid-template-columns: 1fr 1fr; } }

  .sa-head, .sa-row {
    display: grid;
    grid-template-columns: 130px 1.6fr 70px 1fr 100px 80px;
    gap: 14px; padding: 12px 20px; align-items: center;
  }
  .sa-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .sa-row { border-bottom: 1px solid var(--rule-soft); font-size: 13px; }
  .sa-row:last-child { border-bottom: 0; }
  .sa-row:hover { background: var(--cream-soft); }
  .sa-row.is-outside {
    background: rgba(201,122,10,0.04);
    border-left: 3px solid var(--warn);
  }
  .sa-row.is-outside:hover { background: rgba(201,122,10,0.07); }
`;
