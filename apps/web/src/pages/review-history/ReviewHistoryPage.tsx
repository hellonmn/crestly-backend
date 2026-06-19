import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useReviewHistory } from "./hooks";
import type { ReviewDay } from "@crestly/shared";

const WINDOWS = [7, 14, 30, 60, 90] as const;

function fmtDateLabel(iso: string, todayIso: string, yestIso: string): { day: string; sub: string } {
  if (iso === todayIso) return { day: "Today", sub: weekdayLong(iso) };
  if (iso === yestIso)  return { day: "Yesterday", sub: weekdayLong(iso) };
  return { day: shortDate(iso), sub: weekdayLong(iso) };
}
function weekdayLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .format(d).replace(/,/g, "");
}
function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}
function colorForPct(p: number): string {
  if (p >= 100) return "var(--success)";
  if (p >= 50)  return "var(--warn)";
  if (p > 0)    return "var(--orange)";
  return "var(--ink-40)";
}

/** Inline SVG sparkline that mirrors PHP `dr_sparkline`. */
function Sparkline({ points, height = 80, color = "var(--success)" }: {
  points: Array<{ date: string; percent: number }>;
  height?: number;
  color?: string;
}) {
  if (points.length === 0) return <div className="muted body-s">no data</div>;
  const W = 1080;
  const H = height;
  const pad = 4;
  const sw = W - pad * 2;
  const sh = H - pad * 2;
  const n = points.length;
  let line = "";
  let area = "";
  let lastX = 0;
  for (let i = 0; i < n; i++) {
    const x = pad + (n === 1 ? sw / 2 : (i / (n - 1)) * sw);
    const y = pad + sh - (Math.max(0, points[i]!.percent) / 100) * sh;
    line += (i === 0 ? "M" : "L") + `${x.toFixed(1)} ${y.toFixed(1)} `;
    if (i === 0) area = `M${x},${pad + sh} L${x},${y} `;
    else area += `L${x},${y} `;
    lastX = x;
  }
  area += `L${lastX.toFixed(1)},${(pad + sh).toFixed(1)} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReviewHistoryPage() {
  const [windowDays, setWindowDays] = useState<number>(30);
  const { data, isLoading } = useReviewHistory(windowDays);

  // The API returns days in newest-first order already after our service tweak;
  // be defensive in case ordering changes — sort descending here.
  const daysDesc = useMemo(() => {
    if (!data) return [] as ReviewDay[];
    return [...data.days].sort((a, b) => b.reviewDate.localeCompare(a.reviewDate));
  }, [data]);

  // Today / yesterday ISO for friendly label substitution.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString().slice(0, 10);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestIso = yest.toISOString().slice(0, 10);

  // Total tile count (16 in PHP) — read from any day's `total`, fall back to 16.
  const total = daysDesc[0]?.total ?? 16;

  // Initially expand Today only (mirrors PHP <details open>).
  const [openIso, setOpenIso] = useState<Set<string>>(() => new Set([todayIso]));
  function toggle(iso: string) {
    setOpenIso((s) => {
      const n = new Set(s);
      if (n.has(iso)) n.delete(iso); else n.add(iso);
      return n;
    });
  }

  return (
    <>
      <style>{REVIEW_CSS}</style>

      <PageHead
        group="SYSTEM"
        meta="REVIEW HISTORY"
        title="Review History"
        lede="Track which dashboard tiles you reviewed each day. Yesterday's checks stay frozen so you can audit what was looked at; today resets to empty automatically."
      />

      {/* ===== STAT TILES ===== */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint"><Icon name="check" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Last 7 days · avg</div>
              <div className="stat-tile__value">{(data?.avg7d ?? 0).toFixed(1)}%</div>
              <div className="stat-tile__delta">average completion</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-sky"><Icon name="calendar" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Last 30 days · avg</div>
              <div className="stat-tile__value">{(data?.avg30d ?? 0).toFixed(1)}%</div>
              <div className="stat-tile__delta">average completion</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mustard"><Icon name="features" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Full-review streak</div>
              <div className="stat-tile__value">{data?.fullReviewStreak ?? 0}</div>
              <div className="stat-tile__delta">
                day{data?.fullReviewStreak === 1 ? "" : "s"} all {total} reviewed in a row
              </div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-rose"><Icon name="punch" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">All-time checks</div>
              <div className="stat-tile__value">{data?.allTimeChecks ?? 0}</div>
              <div className="stat-tile__delta">tiles ticked across all days</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 30-DAY TREND SPARKLINE ===== */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div className="label">30-DAY COMPLETION TREND</div>
          <span className="muted body-s mono">0 – 100%</span>
        </div>
        {data && data.sparkline.length > 0 ? (
          <>
            <Sparkline points={data.sparkline} height={80} color="var(--success)" />
            <div className="muted body-s mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10.5 }}>
              <span>{shortDate(data.sparkline[0]!.date)}</span>
              <span>today</span>
            </div>
          </>
        ) : (
          <Skeleton.Text width="100%" height={60} />
        )}
      </div>

      {/* ===== WINDOW SELECTOR ===== */}
      <div className="toolbar card" style={{ padding: "12px 16px" }}>
        <span className="label">WINDOW</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            className={`btn btn--sm ${w === windowDays ? "btn--primary" : "btn--ghost"}`}
            onClick={() => setWindowDays(w)}
          >
            {w} days
          </button>
        ))}
        <div className="spacer" style={{ flex: 1 }} />
        <Link to="/" className="btn btn--ghost btn--sm">← Back to dashboard</Link>
      </div>

      {/* ===== DAY-BY-DAY ===== */}
      <div className="card card--tight">
        <div className="label" style={{ marginBottom: 14 }}>
          DAY-BY-DAY · LAST {windowDays} DAYS
        </div>
        {isLoading ? (
          <Skeleton.Table rows={5} cols={3} />
        ) : daysDesc.length === 0 ? (
          <div style={{ padding: "32px 12px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO HISTORY</div>
            <div className="muted body-s">No review activity in this window yet.</div>
          </div>
        ) : (
          <div className="rh-list">
            {daysDesc.map((row) => {
              const pct = row.total > 0 ? Math.round((row.reviewed.length / row.total) * 100) : 0;
              const open = openIso.has(row.reviewDate);
              const color = colorForPct(pct);
              const label = fmtDateLabel(row.reviewDate, todayIso, yestIso);
              return (
                <div key={row.reviewDate} className={`rh-row ${open ? "is-open" : ""}`}>
                  <button type="button" className="rh-summary" onClick={() => toggle(row.reviewDate)}>
                    <div className="rh-date">
                      <div className="rh-date__day">{label.day}</div>
                      <div className="rh-date__sub">{label.sub}</div>
                    </div>
                    <div className="rh-progress">
                      <div className="rh-progress__bar" style={{ background: "var(--cream)" }}>
                        <div style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <div className="rh-progress__txt mono">
                        <span style={{ color, fontWeight: 700 }}>{row.reviewed.length}</span>
                        <span className="muted"> / {row.total}</span>
                        <span className="muted"> · {pct}%</span>
                      </div>
                    </div>
                    <span className="rh-chev" aria-hidden="true">
                      <Icon name="chev-down" size={12} />
                    </span>
                  </button>
                  {open && (
                    <div className="rh-body">
                      {row.reviewed.length === 0 && (
                        <p className="muted body-s" style={{ margin: "0 0 12px" }}>No tiles reviewed on this day.</p>
                      )}
                      <div className="rh-split">
                        <div>
                          <div className="label" style={{ marginBottom: 8, color: "var(--success)" }}>
                            REVIEWED · {row.reviewed.length}
                          </div>
                          {row.reviewed.length === 0 ? (
                            <div className="muted body-s">—</div>
                          ) : (
                            row.reviewed.map((r) => (
                              <div key={r.key} className="rh-item rh-item--ok">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12l5 5L20 7" />
                                </svg>
                                <span style={{ flex: 1 }}>{r.label ?? r.key}</span>
                                <span className="muted body-s mono">
                                  {new Date(r.reviewedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div>
                          <div className="label" style={{ marginBottom: 8, color: "var(--warn)" }}>
                            PENDING · {row.pending.length}
                          </div>
                          {row.pending.length === 0 ? (
                            <div className="muted body-s">All clear.</div>
                          ) : (
                            row.pending.map((p) => (
                              <div key={p.key} className="rh-item rh-item--miss">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx={12} cy={12} r={9} />
                                </svg>
                                <span style={{ flex: 1 }}>{p.label ?? p.key}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* Inline CSS — verbatim from erp/review-history/index.php */
const REVIEW_CSS = `
  .rh-list { display:flex; flex-direction:column; gap:6px; }
  .rh-row {
    border: 1px solid var(--rule-soft);
    border-radius: var(--r-3, 10px);
    background: var(--white);
    overflow: hidden;
    transition: border-color var(--t-fast, 0.15s) ease;
  }
  .rh-row.is-open { border-color: var(--rule); }
  .rh-summary {
    display: grid;
    grid-template-columns: 160px 1fr 22px;
    gap: 18px;
    align-items: center;
    padding: 12px 16px;
    cursor: pointer;
    user-select: none;
    width: 100%;
    background: transparent;
    border: 0;
    text-align: left;
    font-family: inherit;
    color: inherit;
  }
  .rh-summary:hover { background: var(--cream-soft); }
  .rh-date__day { font-weight: 600; font-size: 14px; }
  .rh-date__sub { font-family: var(--font-mono); font-size: 11px; color: var(--ink-40); margin-top: 2px; letter-spacing: 0.04em; }
  .rh-progress { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .rh-progress__bar { flex: 1; height: 8px; border-radius: var(--r-pill); overflow: hidden; }
  .rh-progress__bar > div { height: 100%; border-radius: var(--r-pill); transition: width 180ms ease; }
  .rh-progress__txt { font-size: 12.5px; white-space: nowrap; flex-shrink: 0; }
  .rh-chev { color: var(--ink-40); display: inline-flex; align-items: center; transition: transform 0.18s ease; }
  .rh-row.is-open .rh-chev { transform: rotate(180deg); }
  .rh-body { padding: 14px 18px 18px; border-top: 1px dashed var(--rule-soft); background: var(--cream-soft); }
  .rh-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .rh-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 8px;
    font-size: 13px;
    border-radius: 6px;
    margin-bottom: 3px;
  }
  .rh-item--ok   { color: var(--ink); }
  .rh-item--ok   svg { color: var(--success); flex-shrink: 0; }
  .rh-item--miss { color: var(--ink-60); }
  .rh-item--miss svg { color: var(--warn); flex-shrink: 0; }
  @media (max-width: 700px) {
    .rh-summary { grid-template-columns: 110px 1fr 18px; gap: 10px; padding: 10px 12px; }
    .rh-date__day { font-size: 13px; }
    .rh-date__sub { font-size: 10px; }
    .rh-progress { gap: 8px; }
    .rh-progress__txt { font-size: 11.5px; }
    .rh-split { grid-template-columns: 1fr; gap: 16px; }
    .rh-body { padding: 12px 14px 14px; }
  }
`;
