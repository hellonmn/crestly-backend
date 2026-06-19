import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useOpenSpotlight } from "@/components/Spotlight";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

/* ------------------------------------------------------------------ */
/* API shape — mirrors apps/api/src/dashboard/dashboard.service.ts     */
/* ------------------------------------------------------------------ */

interface DashboardSummary {
  activeStudents: number;
  inactiveStudents: number;
  dayCount: number;
  hostelCount: number;
  sections: number;
  todayAttendance: {
    present: number; absent: number; late: number; excused: number;
    marked: number; total: number; pct: number | null;
  };
  fee: {
    sessionCode: string; yearlyTotal: number; collected: number; due: number;
    withBalance: number; overdue: number; pct: number;
  };
  fee7day: Array<{ d: string; amt: number }>;
  monthIncome: number; monthExpense: number; monthExpensePending: number;
  monthExpenseDue: number; monthNet: number;
  expenseTop: Array<{ category: string; paid: number }>;
  voucherPending: number;
  leavePending: number; leaveToday: number;
  staffCount: number; staffPunched: number;
  payrollMonth: number; payrollUnset: number;
  hostel: {
    total: number; boys: number; girls: number;
    boysCapacity: number; girlsCapacity: number;
    rooms: number; annual: number;
  } | null;
  transport: { students: number; pickups: number; slabs: number; revenue: number } | null;
  nextExam: { termName: string; termCode: string; date: string; daysAway: number } | null;
  nextHoliday: { date: string; name: string; daysAway: number } | null;
  recentStudents: Array<{ srNumber: number; name: string; class: string; section: string; isHostel: boolean }>;
  classDist: Array<{ class: string; n: number; hostelN: number }>;
  pendingApprovals: number; allPending: number;
  reviewedToday: string[];
  schoolName: string;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers — mirror PHP `money_compact` + crumb date        */
/* ------------------------------------------------------------------ */

function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (a >= 1_000)       return `₹${(n / 1_000).toFixed(1).replace(/\.?0+$/, "")} K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function crumbDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "").toUpperCase();
}
function shortDayDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short",
  }).format(d).replace(/,/g, "").toUpperCase();
}
function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "");
}
function ddmm(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(iso));
}
function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

/* ------------------------------------------------------------------ */
/* Daily review — hook + checkbox component                            */
/* ------------------------------------------------------------------ */

const REVIEW_KEYS_ORDER = [
  "students", "kpi-attendance", "kpi-income", "kpi-approvals",
  "fee-collection", "cashflow",
  "pulse-students", "pulse-staff", "pulse-leaves",
  "expense-breakdown", "payroll",
  "hostel", "transport", "calendar",
  "class-dist", "recent-students",
] as const;

function useReviewTracker(initial: string[] = []) {
  const qc = useQueryClient();
  const [reviewed, setReviewed] = useState<Set<string>>(new Set(initial));

  // Keep state in sync when the dashboard refetches.
  useEffect(() => { setReviewed(new Set(initial)); }, [initial.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkM = useMutation({
    mutationFn: (input: { key: string; label?: string }) =>
      api.post<{ ok: true }>("/dashboard/review/check", input).then((r) => r.data),
  });
  const uncheckM = useMutation({
    mutationFn: (input: { key: string }) =>
      api.post<{ ok: true }>("/dashboard/review/uncheck", input).then((r) => r.data),
  });
  const resetM = useMutation({
    mutationFn: () => api.post<{ ok: true; cleared: number }>("/dashboard/review/reset").then((r) => r.data),
    onSuccess: () => { setReviewed(new Set()); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
  });

  const toggle = useCallback(async (key: string, label: string) => {
    const isOn = reviewed.has(key);
    // Optimistic flip
    setReviewed((s) => {
      const n = new Set(s);
      if (isOn) n.delete(key); else n.add(key);
      return n;
    });
    try {
      if (isOn) await uncheckM.mutateAsync({ key });
      else await checkM.mutateAsync({ key, label });
    } catch {
      // Roll back on failure.
      setReviewed((s) => {
        const n = new Set(s);
        if (isOn) n.add(key); else n.delete(key);
        return n;
      });
    }
  }, [reviewed, checkM, uncheckM]);

  return { reviewed, toggle, reset: () => resetM.mutate() };
}

/** Small circular check button rendered top-right on each reviewable card. */
function ReviewCheck({
  reviewKey, label, on, onToggle,
}: { reviewKey: string; label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={`Mark "${label}" as reviewed`}
      title={`Mark "${label}" reviewed`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggle(); }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      className={`dr-check ${on ? "is-on" : ""}`}
      data-review-key={reviewKey}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </button>
  );
}

/** Wrapper that adds a position:relative + faded look when reviewed. */
function ReviewableCard({
  className, style, children, reviewKey, label, reviewed, onToggle, as = "div", to, onClick,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  reviewKey: string;
  label: string;
  reviewed: Set<string>;
  onToggle: (key: string, label: string) => void;
  as?: "div" | "a";
  to?: string;
  onClick?: () => void;
}) {
  const on = reviewed.has(reviewKey);
  const combined = `${className ?? ""} ${on ? "is-reviewed" : ""}`.trim();
  const inner = (
    <>
      {children}
      <ReviewCheck reviewKey={reviewKey} label={label} on={on} onToggle={() => onToggle(reviewKey, label)} />
    </>
  );
  if (as === "a" && to) {
    return (
      <Link to={to} className={combined} style={{ position: "relative", textDecoration: "none", color: "inherit", ...style }} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={combined} style={{ position: "relative", ...style }} onClick={onClick}>
      {inner}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline + Donut SVG renderers (verbatim of PHP `render_sparkline` */
/* / `render_donut`)                                                   */
/* ------------------------------------------------------------------ */

function Sparkline({ points, height = 64, color = "var(--orange)" }: {
  points: Array<{ d: string; amt: number }>; height?: number; color?: string;
}) {
  if (points.length === 0) return <div className="muted body-s">no data</div>;
  const W = 540;
  const H = height;
  const pad = 4;
  const sw = W - pad * 2;
  const sh = H - pad * 2;
  const vals = points.map((p) => Math.max(0, p.amt));
  const max = Math.max(...vals, 1);
  const n = vals.length;
  let line = "";
  let area = "";
  let lastX = 0, lastY = 0;
  for (let i = 0; i < n; i++) {
    const x = pad + (n === 1 ? sw / 2 : (i / (n - 1)) * sw);
    const y = pad + sh - ((vals[i] ?? 0) / max) * sh;
    line += (i === 0 ? "M" : "L") + `${x.toFixed(1)} ${y.toFixed(1)} `;
    if (i === 0) area = `M${x},${pad + sh} L${x},${y} `;
    else area += `L${x},${y} `;
    lastX = x; lastY = y;
  }
  area += `L${lastX.toFixed(1)},${(pad + sh).toFixed(1)} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <path d={area} fill={color} fillOpacity={0.12} />
      <path d={line} stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r={3} fill={color} />
    </svg>
  );
}

function Donut({ segments, size = 140, thickness = 18 }: {
  segments: Array<{ label: string; value: number; color: string }>; size?: number; thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return <div className="muted body-s">no spend yet</div>;
  const r = size / 2 - thickness / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--cream)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const share = Math.max(0, s.value) / total;
        const len = share * circ;
        const dasharray = `${len.toFixed(2)} ${Math.max(0.01, circ - len).toFixed(2)}`;
        const el = (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth={thickness}
            strokeDasharray={dasharray} strokeDashoffset={(-offset).toFixed(2)}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

const DONUT_COLORS = ["var(--orange)", "var(--info)", "var(--rose-deep)", "var(--success)", "var(--warn)"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard")).data,
    refetchOnWindowFocus: true,
  });

  const isFullAccess = user?.roleSlug === "admin" || user?.roleSlug === "principal";
  const { reviewed, toggle, reset } = useReviewTracker(data?.reviewedToday ?? []);

  // Daily-review progress bar uses the master REVIEW_KEYS_ORDER as total.
  const reviewTotal = REVIEW_KEYS_ORDER.length;
  const reviewDone = useMemo(
    () => REVIEW_KEYS_ORDER.filter((k) => reviewed.has(k)).length,
    [reviewed],
  );
  const reviewPct = reviewTotal > 0 ? Math.round((reviewDone / reviewTotal) * 100) : 0;

  const at = data?.todayAttendance;
  const fee = data?.fee;
  const h = data?.hostel;
  const cfTotal = Math.max(1, (data?.monthIncome ?? 0) + (data?.monthExpense ?? 0));
  const cfInPct  = Math.round(((data?.monthIncome  ?? 0) / cfTotal) * 100);
  const cfOutPct = Math.round(((data?.monthExpense ?? 0) / cfTotal) * 100);
  const staffTotal = Math.max(1, data?.staffCount ?? 0);
  const punchPct = Math.round(((data?.staffPunched ?? 0) / staffTotal) * 100);

  const onR = (k: string, l: string) => toggle(k, l);

  return (
    <>
      <PageHead
        group="OVERVIEW"
        meta={crumbDate()}
        title={isFullAccess ? "Dashboard" : `Hi, ${user?.name?.split(" ")[0] ?? "there"}`}
        lede={
          isFullAccess
            ? `Today at ${data?.schoolName ?? "your school"}. Session ${data?.fee.sessionCode ?? "—"}.`
            : `${user?.roleName ?? "Welcome"}`
        }
      />

      {/* Inline CSS so the page is portable even without a separate stylesheet update. */}
      <style>{REVIEW_CSS}</style>

      {/* ============== DAILY REVIEW BAR ============== */}
      {isFullAccess && (
        <div id="daily-review-bar" className="card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--tint-mint)", color: "var(--success)",
            }}>
              <Icon name="check" size={18} />
            </span>
            <div>
              <div className="label">DAILY REVIEW · {shortDayDate()}</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, lineHeight: 1.1, marginTop: 2 }}>
                <span>{reviewDone}</span>
                <span className="muted" style={{ fontWeight: 400 }}> / </span>
                <span>{reviewTotal}</span>{" "}
                <span className="muted body-s" style={{ fontWeight: 400, fontSize: 12 }}>reviewed</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ height: 10, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${reviewPct}%`, background: "var(--success)", borderRadius: "var(--r-pill)", transition: "width 180ms ease" }} />
            </div>
            <div className="muted body-s" style={{ marginTop: 6, fontSize: 11 }}>
              {reviewDone === 0
                ? "Tick each tile as you review it. Saved daily to your history."
                : reviewDone === reviewTotal
                  ? "All reviewed for today. Nice work — see Review History for past days."
                  : `${reviewTotal - reviewDone} tile${reviewTotal - reviewDone === 1 ? "" : "s"} left to review.`}
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            style={{ flexShrink: 0 }}
            onClick={() => { if (confirm("Clear today's review checks? This wipes today's history row.")) reset(); }}
          >
            Reset today
          </button>
        </div>
      )}

      {/* ============== QUICK ACTIONS ============== */}
      <QuickActions
        canManageAttendance={(user?.permissions ?? []).includes("attendance.mark")}
        canManageFees={(user?.permissions ?? []).includes("fees.manage")}
        canCreateVouchers={(user?.permissions ?? []).includes("vouchers.create")}
        canManageAdmissions={(user?.permissions ?? []).includes("admissions.manage")}
        canPunch={(user?.permissions ?? []).includes("staff.punch")}
        pendingApprovals={data?.allPending ?? 0}
      />

      {/* Skeleton fallback while loading */}
      {isLoading && <Skeleton.StatRow count={4} />}

      {data && (
        <>
          {/* =============== ROW 1 · KPI tiles =============== */}
          <div className="grid grid--cols-4 grid--gap-sm">
            <ReviewableCard as="a" to="/students" className="stat-tile" reviewKey="students" label="Active students" reviewed={reviewed} onToggle={onR}>
              <div className="stat-tile__icon icon-tint-wheat"><Icon name="users" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Active students</div>
                <div className="stat-tile__value">{data.activeStudents.toLocaleString("en-IN")}</div>
                <div className="stat-tile__delta">
                  {data.dayCount.toLocaleString("en-IN")} day · {data.hostelCount.toLocaleString("en-IN")} hostel · {data.sections} sections
                </div>
              </div>
            </ReviewableCard>

            <ReviewableCard as="a" to="/attendance" className="stat-tile" reviewKey="kpi-attendance" label="Today's attendance" reviewed={reviewed} onToggle={onR}>
              <div className="stat-tile__icon icon-tint-sky"><Icon name="check" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Today's attendance</div>
                <div className="stat-tile__value">{at && at.total > 0 && at.pct != null ? `${at.pct.toFixed(1)}%` : "—"}</div>
                <div style={{ height: 5, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginTop: 6, display: "flex" }}>
                  {at && at.total > 0 && <>
                    <div style={{ width: `${Math.round((at.present / at.total) * 100)}%`, background: "var(--success)" }} />
                    <div style={{ width: `${Math.round((at.late    / at.total) * 100)}%`, background: "var(--warn)" }} />
                    <div style={{ width: `${Math.round((at.excused / at.total) * 100)}%`, background: "var(--info)" }} />
                  </>}
                </div>
                <div className="stat-tile__delta">
                  {(at?.present ?? 0).toLocaleString("en-IN")} present · {(at?.absent ?? 0).toLocaleString("en-IN")} absent
                </div>
              </div>
            </ReviewableCard>

            <ReviewableCard as="a" to="/ledger" className="stat-tile" reviewKey="kpi-income" label="This month income" reviewed={reviewed} onToggle={onR}>
              <div className="stat-tile__icon icon-tint-mint"><Icon name="rupee" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">This month income</div>
                <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data.monthIncome)}</div>
                <div className="stat-tile__delta">
                  net {data.monthNet >= 0 ? "+" : "−"}{compact(Math.abs(data.monthNet))}
                  <span className="muted"> · spend {compact(data.monthExpense)}</span>
                </div>
              </div>
            </ReviewableCard>

            <ReviewableCard as="a" to="/approvals" className="stat-tile" reviewKey="kpi-approvals" label="Pending approvals" reviewed={reviewed} onToggle={onR}>
              <div className="stat-tile__icon icon-tint-mustard"><Icon name="alert" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Pending approvals</div>
                <div className="stat-tile__value">{data.allPending.toLocaleString("en-IN")}</div>
                <div className="stat-tile__delta">
                  {data.pendingApprovals} edits · {data.voucherPending} vouchers · {data.leavePending} leaves
                </div>
              </div>
            </ReviewableCard>
          </div>

          {/* =============== ROW 2 · Fee collection + Cashflow =============== */}
          <div className="grid grid--split grid--gap-sm">
            <ReviewableCard className="card" reviewKey="fee-collection" label="Fee collection" reviewed={reviewed} onToggle={onR}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <div className="label">FEE COLLECTION · SESSION {fee?.sessionCode ?? "—"}</div>
                  <div className="display-m" style={{ marginTop: 4 }}>
                    {(fee?.pct ?? 0).toFixed(1)}%<BrandDot />
                  </div>
                  <div className="muted body-s" style={{ marginTop: 4 }}>
                    {compact(fee?.collected ?? 0)} of {compact(fee?.yearlyTotal ?? 0)} collected
                  </div>
                </div>
                <Link to="/fee-ledger" className="btn btn--ghost btn--sm">Open ledger →</Link>
              </div>

              <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginTop: 14 }}>
                <div style={{ height: "100%", width: `${fee?.pct ?? 0}%`, background: "var(--orange)", borderRadius: "var(--r-pill)" }} />
              </div>

              <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px dashed var(--rule-soft)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div className="label">LAST 7 DAYS · DAILY COLLECTION</div>
                  <span className="muted body-s mono">
                    {compact(data.fee7day.reduce((s, x) => s + x.amt, 0))}
                  </span>
                </div>
                <Sparkline points={data.fee7day} height={64} color="var(--orange)" />
                <div className="muted body-s mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10.5 }}>
                  <span>{data.fee7day[0] ? ddmm(data.fee7day[0].d) : ""}</span>
                  <span>peak {compact(Math.max(0, ...data.fee7day.map((p) => p.amt)))}</span>
                  <span>today</span>
                </div>
              </div>

              <div className="grid grid--cols-3 grid--gap-sm" style={{ marginTop: 18 }}>
                <div>
                  <div className="label">COLLECTED</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{compact(fee?.collected ?? 0)}</div>
                </div>
                <div>
                  <div className="label">OUTSTANDING</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{compact(fee?.due ?? 0)}</div>
                </div>
                <div>
                  <div className="label">STUDENTS DUE</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{(fee?.withBalance ?? 0).toLocaleString("en-IN")}</div>
                </div>
              </div>
            </ReviewableCard>

            <ReviewableCard className="card" reviewKey="cashflow" label="Monthly cashflow" reviewed={reviewed} onToggle={onR} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="label">THIS MONTH · CASHFLOW</div>
                <Link to="/ledger" className="muted body-s" style={{ textDecoration: "underline" }}>Open ledger →</Link>
              </div>
              <div>
                <div className="display-m" style={{ fontSize: 26 }}>
                  {data.monthNet >= 0 ? "+" : "−"}{compact(Math.abs(data.monthNet))}<BrandDot />
                </div>
                <div className="muted body-s">
                  net for {new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date())}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--success)" }}>↑ Income</span>
                    <span className="mono">{compact(data.monthIncome)}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cfInPct}%`, background: "var(--success)", borderRadius: "var(--r-pill)" }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "var(--warn)" }}>↓ Expense (paid)</span>
                    <span className="mono">{compact(data.monthExpense)}</span>
                  </div>
                  <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${cfOutPct}%`, background: "var(--warn)", borderRadius: "var(--r-pill)" }} />
                  </div>
                </div>
              </div>
              <div className="muted body-s" style={{ paddingTop: 8, borderTop: "1px dashed var(--rule-soft)", fontSize: 11.5 }}>
                {data.voucherPending} voucher{data.voucherPending === 1 ? "" : "s"} pending approval
                {data.monthExpenseDue > 0 && <> · {compact(data.monthExpenseDue)} due on credit bills</>}
              </div>
            </ReviewableCard>
          </div>

          {/* =============== ROW 3 · Today pulse =============== */}
          <div className="grid grid--cols-3 grid--gap-sm">
            <ReviewableCard className="card card--tight" reviewKey="pulse-students" label="Student attendance pulse" reviewed={reviewed} onToggle={onR}>
              <div className="label">STUDENTS · {shortDayDate()}</div>
              <div className="display-m" style={{ fontSize: 26, marginTop: 4 }}>
                {at && at.total > 0 && at.pct != null ? `${at.pct.toFixed(1)}%` : "—"}<BrandDot />
              </div>
              <div className="muted body-s" style={{ marginBottom: 10 }}>
                {(at?.present ?? 0).toLocaleString("en-IN")} present · {(at?.absent ?? 0).toLocaleString("en-IN")} absent
              </div>
              {at && at.total > 0 && (
                <>
                  <div style={{ height: 7, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${Math.round((at.present / at.total) * 100)}%`, background: "var(--success)" }} />
                    <div style={{ width: `${Math.round((at.late    / at.total) * 100)}%`, background: "var(--warn)" }} />
                    <div style={{ width: `${Math.round((at.excused / at.total) * 100)}%`, background: "var(--info)" }} />
                  </div>
                  <div className="muted body-s" style={{ marginTop: 8, fontSize: 11 }}>
                    {at.marked.toLocaleString("en-IN")} / {at.total.toLocaleString("en-IN")} confirmed by teachers
                  </div>
                </>
              )}
              <div><Link to="/attendance" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}>Mark attendance →</Link></div>
            </ReviewableCard>

            <ReviewableCard className="card card--tight" reviewKey="pulse-staff" label="Staff punch-in" reviewed={reviewed} onToggle={onR}>
              <div className="label">STAFF · PUNCHED IN</div>
              <div className="display-m" style={{ fontSize: 26, marginTop: 4 }}>
                {(data.staffPunched).toLocaleString("en-IN")}
                <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}> / {data.staffCount.toLocaleString("en-IN")}</span>
              </div>
              <div className="muted body-s" style={{ marginBottom: 10 }}>{punchPct}% of active staff</div>
              <div style={{ height: 7, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${punchPct}%`, background: "var(--info)", borderRadius: "var(--r-pill)" }} />
              </div>
              <div><Link to="/staff-attendance" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}>View attendance →</Link></div>
            </ReviewableCard>

            <ReviewableCard className="card card--tight" reviewKey="pulse-leaves" label="Leaves today" reviewed={reviewed} onToggle={onR}>
              <div className="label">ON LEAVE · TODAY</div>
              <div className="display-m" style={{ fontSize: 26, marginTop: 4 }}>
                {data.leaveToday}<BrandDot />
              </div>
              <div className="muted body-s" style={{ marginBottom: 10 }}>
                {data.leaveToday === 1 ? "1 staff" : `${data.leaveToday} staff`} away
                {data.leavePending > 0 && <> · <b style={{ color: "var(--warn)" }}>{data.leavePending} pending</b></>}
              </div>
              <div style={{ height: 7, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(2, staffTotal > 0 ? Math.min(100, Math.round((data.leaveToday / staffTotal) * 100)) : 0)}%`,
                  background: "var(--rose-deep)", borderRadius: "var(--r-pill)",
                }} />
              </div>
              <div><Link to="/leaves" className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}>Open leaves →</Link></div>
            </ReviewableCard>
          </div>

          {/* =============== ROW 4 · Expense breakdown + Payroll =============== */}
          <div className="grid grid--split grid--gap-sm">
            <ReviewableCard className="card" reviewKey="expense-breakdown" label="Expense breakdown" reviewed={reviewed} onToggle={onR}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div className="label">EXPENSE BREAKDOWN · {new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date())}</div>
                <Link to="/vouchers" className="muted body-s" style={{ textDecoration: "underline" }}>All vouchers →</Link>
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flexShrink: 0, position: "relative", width: 140, height: 140 }}>
                  <Donut
                    segments={data.expenseTop.map((c, i) => ({
                      label: c.category, value: c.paid, color: DONUT_COLORS[i % DONUT_COLORS.length] ?? "var(--orange)",
                    }))}
                    size={140} thickness={18}
                  />
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                    <div className="label" style={{ fontSize: 9, padding: 0 }}>PAID</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, lineHeight: 1, marginTop: 2 }}>
                      {compact(data.monthExpense)}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.expenseTop.length === 0 ? (
                    <div className="muted body-s">No expenses recorded this month.</div>
                  ) : data.expenseTop.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                      <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.category}</span>
                      <span className="mono muted body-s">{compact(s.paid)}</span>
                    </div>
                  ))}
                </div>
              </div>
              {data.voucherPending > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--rule-soft)" }}>
                  <Link to="/vouchers?status=pending_approval" style={{ color: "var(--warn)", textDecoration: "underline", fontSize: 12.5 }}>
                    {data.voucherPending} voucher{data.voucherPending === 1 ? "" : "s"} waiting for approval →
                  </Link>
                </div>
              )}
            </ReviewableCard>

            <ReviewableCard className="card" reviewKey="payroll" label="Payroll" reviewed={reviewed} onToggle={onR} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div className="label">PAYROLL · {new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date())}</div>
                <Link to="/ledger" className="muted body-s" style={{ textDecoration: "underline" }}>Open ledger →</Link>
              </div>
              <div>
                <div className="display-m" style={{ fontSize: 26 }}>{compact(data.payrollMonth)}<BrandDot /></div>
                <div className="muted body-s">monthly gross across active staff</div>
              </div>
              <div className="grid grid--cols-3 grid--gap-sm" style={{ marginTop: 4 }}>
                <div>
                  <div className="label">STAFF</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{data.staffCount}</div>
                </div>
                <div>
                  <div className="label">PUNCHED TODAY</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{data.staffPunched}</div>
                </div>
                <div>
                  <div className="label">SALARY UNSET</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: data.payrollUnset > 0 ? "var(--warn)" : "var(--ink)" }}>
                    {data.payrollUnset}
                  </div>
                </div>
              </div>
              {data.payrollUnset > 0 && (
                <div style={{ paddingTop: 8, borderTop: "1px dashed var(--rule-soft)" }}>
                  <Link to="/shifts" style={{ color: "var(--warn)", textDecoration: "underline", fontSize: 12.5 }}>
                    {data.payrollUnset} staff missing monthly salary → set now
                  </Link>
                </div>
              )}
            </ReviewableCard>
          </div>

          {/* =============== ROW 5 · Hostel · Transport · Next =============== */}
          <div className="grid grid--cols-3 grid--gap-sm">
            <ReviewableCard
              as="a" to="/hostel"
              className="card card--tight"
              reviewKey="hostel" label="Hostel occupancy"
              reviewed={reviewed} onToggle={onR}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div className="label">HOSTEL · OCCUPANCY</div>
              {h ? (
                <>
                  <div className="display-m" style={{ fontSize: 22 }}>
                    {h.total.toLocaleString("en-IN")}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> boarders</span>
                  </div>
                  <CapacityBar label="Boys" count={h.boys} capacity={h.boysCapacity} color="var(--info)" />
                  <CapacityBar label="Girls" count={h.girls} capacity={h.girlsCapacity} color="var(--rose-deep)" />
                  <div className="muted body-s" style={{ fontSize: 11 }}>
                    {h.rooms} rooms · {compact(h.annual)} annual
                  </div>
                </>
              ) : (
                <p className="muted body-s">No hostel data.</p>
              )}
            </ReviewableCard>

            <ReviewableCard
              as="a" to="/transport"
              className="card card--tight"
              reviewKey="transport" label="Transport"
              reviewed={reviewed} onToggle={onR}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div className="label">TRANSPORT</div>
              {data.transport && data.transport.students > 0 ? (
                <>
                  <div className="display-m" style={{ fontSize: 22 }}>
                    {data.transport.students.toLocaleString("en-IN")}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> students</span>
                  </div>
                  <div className="muted body-s" style={{ fontSize: 11.5 }}>
                    {data.transport.pickups} pickup{data.transport.pickups === 1 ? "" : "s"} · {data.transport.slabs} slab{data.transport.slabs === 1 ? "" : "s"}
                  </div>
                  {data.transport.revenue > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px dashed var(--rule-soft)" }}>
                      <div className="label" style={{ fontSize: 9 }}>ANNUAL REVENUE</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{compact(data.transport.revenue)}</div>
                    </div>
                  )}
                </>
              ) : (
                <p className="muted body-s">No transport routes set up.</p>
              )}
            </ReviewableCard>

            <ReviewableCard
              as="a" to={data.nextExam ? "/exams" : "/holidays"}
              className="card card--tight"
              reviewKey="calendar" label="Upcoming exam / holiday"
              reviewed={reviewed} onToggle={onR}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {data.nextExam ? (
                <>
                  <div className="label">UPCOMING EXAM</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, lineHeight: 1.2 }}>
                    {data.nextExam.termName}
                  </div>
                  <div className="muted body-s">
                    {formatDateLong(data.nextExam.date)} <span className="mono">· {data.nextExam.termCode}</span>
                  </div>
                  <div className="pill pill--info" style={{ alignSelf: "flex-start", marginTop: 4, padding: "3px 10px", fontSize: 10.5 }}>
                    {data.nextExam.daysAway === 0 ? "TODAY" : `${data.nextExam.daysAway} DAY${data.nextExam.daysAway === 1 ? "" : "S"} AWAY`}
                  </div>
                </>
              ) : data.nextHoliday ? (
                <>
                  <div className="label">NEXT HOLIDAY</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>
                    {data.nextHoliday.name}
                  </div>
                  <div className="muted body-s">{formatDateLong(data.nextHoliday.date)}</div>
                  <div className="pill pill--warn" style={{ alignSelf: "flex-start", marginTop: 4, padding: "3px 10px", fontSize: 10.5 }}>
                    {data.nextHoliday.daysAway === 0 ? "TODAY" : `${data.nextHoliday.daysAway} DAY${data.nextHoliday.daysAway === 1 ? "" : "S"} AWAY`}
                  </div>
                </>
              ) : (
                <>
                  <div className="label">CALENDAR</div>
                  <p className="muted body-s">No upcoming exam or holiday in the next 60 days.</p>
                </>
              )}
            </ReviewableCard>
          </div>

          {/* =============== ROW 6 · Class distribution + Recent students =============== */}
          <div className="grid grid--cols-2 grid--gap-sm">
            <ReviewableCard className="card card--tight" reviewKey="class-dist" label="Class distribution" reviewed={reviewed} onToggle={onR}>
              <div className="label" style={{ marginBottom: 16 }}>
                CLASS DISTRIBUTION
                <span className="muted body-s" style={{ marginLeft: 6, textTransform: "none", letterSpacing: 0, fontSize: 11 }}>
                  day · <span style={{ color: "var(--info)" }}>hostel</span>
                </span>
              </div>
              {data.classDist.length === 0 ? (
                <p className="muted body-s">No data yet. Run the importer.</p>
              ) : (() => {
                const maxN = Math.max(...data.classDist.map((r) => r.n), 1);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.classDist.map((row) => {
                      const dayN = row.n - row.hostelN;
                      return (
                        <div key={row.class} style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px", gap: 12, alignItems: "center" }}>
                          <span className="cls-pill" style={{ justifySelf: "start" }}>{row.class}</span>
                          <div style={{ height: 6, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", display: "flex" }}>
                            {row.n > 0 && (
                              <>
                                <div style={{ height: "100%", width: `${Math.round((dayN / maxN) * 100)}%`, background: "var(--tint-wheat-deep)", opacity: 0.7 }} />
                                {row.hostelN > 0 && (
                                  <div style={{ height: "100%", width: `${Math.round((row.hostelN / maxN) * 100)}%`, background: "var(--info)" }} />
                                )}
                              </>
                            )}
                          </div>
                          <span className="mono body-s" style={{ textAlign: "right" }}>
                            <span className="muted">{dayN}</span>
                            {row.hostelN > 0 && <> <span style={{ color: "var(--info)", fontWeight: 600 }}>+{row.hostelN}</span></>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </ReviewableCard>

            <ReviewableCard className="card card--tight" reviewKey="recent-students" label="Recent students" reviewed={reviewed} onToggle={onR}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div className="label">RECENT STUDENTS</div>
                <Link to="/students" className="body-s muted" style={{ textDecoration: "underline" }}>All →</Link>
              </div>
              {data.recentStudents.length === 0 ? (
                <p className="muted body-s">No students yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.recentStudents.map((r) => (
                    <Link
                      key={r.srNumber}
                      to={`/students/${r.srNumber}`}
                      style={{ display: "grid", gridTemplateColumns: "36px 1fr auto", gap: 12, alignItems: "center", textDecoration: "none", color: "inherit" }}
                    >
                      <div className="m-list__avi m-list__avi--wheat" style={{ width: 36, height: 36, fontSize: 13 }}>{initials(r.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>
                          {r.name}
                          {r.isHostel && <span className="pill pill--info" style={{ marginLeft: 4, padding: "1px 6px", fontSize: 9 }}>HOSTEL</span>}
                        </div>
                        <div className="muted body-s">SR #{r.srNumber}</div>
                      </div>
                      <span className="cls-pill">{r.class}-{r.section}</span>
                    </Link>
                  ))}
                </div>
              )}
            </ReviewableCard>
          </div>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Actions panel                                                 */
/* ------------------------------------------------------------------ */

interface QuickAction {
  to?: string;
  onClick?: () => void;
  icon: IconName;
  label: string;
  sub: string;
  tint: "orange" | "mint" | "sky" | "wheat" | "rose" | "mustard";
  badge?: number;
  external?: boolean;
}

function QuickActions(props: {
  canManageAttendance: boolean;
  canManageFees: boolean;
  canCreateVouchers: boolean;
  canManageAdmissions: boolean;
  canPunch: boolean;
  pendingApprovals: number;
}) {
  const openSpotlight = useOpenSpotlight();

  const actions: QuickAction[] = [];

  if (props.canManageAttendance) {
    actions.push({
      to: "/attendance",
      icon: "attendance",
      label: "Take attendance",
      sub: "Today's roster",
      tint: "sky",
    });
  }
  if (props.canManageFees) {
    actions.push({
      to: "/fee-ledger",
      icon: "rupee",
      label: "Record payment",
      sub: "Cash, UPI, online",
      tint: "mint",
    });
  }
  if (props.canCreateVouchers) {
    actions.push({
      to: "/vouchers/new",
      icon: "vouchers",
      label: "Raise voucher",
      sub: "Expense or salary",
      tint: "rose",
    });
  }
  if (props.canManageAdmissions) {
    actions.push({
      to: "/admissions/new",
      icon: "admissions",
      label: "Log enquiry",
      sub: "New admission lead",
      tint: "wheat",
    });
  }
  if (props.pendingApprovals > 0) {
    actions.push({
      to: "/approvals",
      icon: "approvals",
      label: "Review approvals",
      sub: "Edit requests · vouchers · leaves",
      tint: "orange",
      badge: props.pendingApprovals,
    });
  }
  if (props.canPunch) {
    actions.push({
      to: "/punch",
      icon: "punch",
      label: "Punch in / out",
      sub: "Mark your shift",
      tint: "mustard",
    });
  }
  // Always-available — search is universal.
  actions.push({
    onClick: openSpotlight,
    icon: "search",
    label: "Search anything",
    sub: "Cmd K · students, vouchers…",
    tint: "orange",
  });

  if (actions.length === 0) return null;

  return (
    <div className="card qa-card" style={{ padding: 18 }}>
      <div className="qa-card__head">
        <div>
          <div className="label">QUICK ACTIONS</div>
          <div className="qa-card__title">
            What would you like to do?<BrandDot />
          </div>
        </div>
        <span className="muted body-s" style={{ fontSize: 11 }}>
          Permission-aware · {actions.length} option{actions.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="qa-grid">
        {actions.map((a) => (
          <QuickActionCard key={a.label} action={a} />
        ))}
      </div>

      <style>{QA_CSS}</style>
    </div>
  );
}

function QuickActionCard({ action }: { action: QuickAction }) {
  const inner = (
    <>
      <span className={`qa-tile__icon qa-tile__icon--${action.tint}`}>
        <Icon name={action.icon} size={18} />
      </span>
      <span className="qa-tile__body">
        <span className="qa-tile__label">{action.label}</span>
        <span className="qa-tile__sub">{action.sub}</span>
      </span>
      {action.badge && action.badge > 0 && (
        <span className="qa-tile__badge">{action.badge.toLocaleString("en-IN")}</span>
      )}
      <span className="qa-tile__chev" aria-hidden="true">
        <Icon name="chev-right" size={14} />
      </span>
    </>
  );

  if (action.to) {
    return (
      <Link to={action.to} className="qa-tile" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className="qa-tile" onClick={action.onClick}>
      {inner}
    </button>
  );
}

const QA_CSS = `
  .qa-card { overflow: hidden; }
  .qa-card__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .qa-card__title {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 17px;
    margin-top: 4px;
    color: var(--ink);
  }
  .qa-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }
  .qa-tile {
    display: grid;
    grid-template-columns: 38px 1fr auto 16px;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--cream-soft);
    border: 1px solid var(--rule);
    border-radius: 12px;
    cursor: pointer;
    color: var(--ink);
    font: inherit;
    text-align: left;
    transition: background 120ms ease, border-color 120ms ease, transform 80ms ease, box-shadow 120ms ease;
    width: 100%;
  }
  .qa-tile:hover {
    background: var(--white);
    border-color: var(--orange);
    box-shadow: 0 4px 14px rgba(242, 92, 25, 0.10);
    transform: translateY(-1px);
  }
  .qa-tile:active { transform: translateY(0); }

  .qa-tile__icon {
    width: 38px; height: 38px;
    border-radius: 10px;
    display: inline-flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .qa-tile__icon--orange  { background: var(--orange);       color: #fff; }
  .qa-tile__icon--mint    { background: var(--tint-mint);    color: var(--tint-mint-deep); }
  .qa-tile__icon--sky     { background: var(--tint-sky);     color: var(--tint-sky-deep); }
  .qa-tile__icon--wheat   { background: var(--tint-wheat);   color: var(--tint-wheat-deep); }
  .qa-tile__icon--rose    { background: var(--tint-rose);    color: var(--tint-rose-deep); }
  .qa-tile__icon--mustard { background: var(--tint-mustard); color: var(--tint-mustard-deep); }

  .qa-tile__body {
    display: flex; flex-direction: column;
    min-width: 0;
    line-height: 1.2;
  }
  .qa-tile__label {
    font-weight: 600;
    font-size: 13.5px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .qa-tile__sub {
    font-size: 11.5px;
    color: var(--ink-60);
    margin-top: 1px;
  }

  .qa-tile__badge {
    background: var(--orange);
    color: #fff;
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    line-height: 1.4;
  }
  .qa-tile__chev { color: var(--ink-40); }
`;

function CapacityBar({ label, count, capacity, color }: { label: string; count: number; capacity: number; color: string }) {
  const pct = capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span className="mono muted">{count}/{capacity}</span>
      </div>
      <div style={{ height: 6, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline CSS — mirrors the daily-review style block from PHP          */
/* ------------------------------------------------------------------ */
const REVIEW_CSS = `
  .is-reviewed { opacity: 0.62; }
  .is-reviewed::after {
    content: ""; position: absolute; inset: 0;
    border: 1px solid var(--success); border-radius: var(--r-card, 14px);
    pointer-events: none; opacity: 0.35;
  }
  .dr-check {
    position: absolute; top: 10px; right: 10px;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--cream); border: 1.5px solid var(--rule);
    color: transparent;
    display: inline-flex; align-items: center; justify-content: center;
    cursor: pointer; user-select: none;
    transition: all var(--t-fast, 0.15s) ease;
    z-index: 3; padding: 0;
  }
  .dr-check:hover { border-color: var(--success); background: var(--tint-mint); }
  .dr-check:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .dr-check.is-on { background: var(--success); border-color: var(--success); color: #fff; }
  .dr-check svg { width: 13px; height: 13px; }
  .stat-tile .dr-check { top: 8px; right: 8px; }
  .stat-tile .stat-tile__label { padding-right: 28px; }
  @media (max-width: 600px) {
    .dr-check { width: 24px; height: 24px; }
    .dr-check svg { width: 14px; height: 14px; }
  }
`;
