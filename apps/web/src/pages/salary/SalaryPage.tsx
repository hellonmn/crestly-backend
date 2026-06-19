import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { api } from "@/lib/api";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useAuth } from "@/lib/auth-store";
import type { SalaryResponse, SalaryDayState } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Formatting helpers — mirror PHP money / money_compact / format_minutes */
/* ------------------------------------------------------------------ */

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (a >= 1_000)       return `₹${(n / 1_000).toFixed(1).replace(/\.?0+$/, "")} K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function fmtMinutes(m: number): string {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
function ymToLabel(ym: string): string {
  const [yr, mo] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" })
    .format(new Date(yr!, (mo ?? 1) - 1, 1));
}
function ymShort(ym: string): string {
  const [yr, mo] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" })
    .format(new Date(yr!, (mo ?? 1) - 1, 1));
}
function dayDow(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")} ${new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(d)}`;
}

/** Pill class + label per state — mirrors PHP salary_state_pill/_label. */
function stateMeta(state: SalaryDayState): { pill: string; label: string } {
  switch (state) {
    case "holiday":   return { pill: "pill--wheat",   label: "HOLIDAY" };
    case "weekend":
    case "sunday":    return { pill: "pill--neutral", label: "SUNDAY" };
    case "no_shift":  return { pill: "pill--wheat",   label: "NO DUTY HOURS" };
    case "no_salary": return { pill: "pill--warn",    label: "NO SALARY SET" };
    case "pending":   return { pill: "pill--info",    label: "IN" };
    case "computed":  return { pill: "pill--success", label: "PRESENT" };
    case "absent":    return { pill: "pill--error",   label: "ABSENT" };
    case "future":    return { pill: "pill--neutral", label: "—" };
  }
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function SalaryPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();

  const userId = Number(params.get("userId") ?? user?.id ?? 0);
  const month = params.get("month") ?? currentMonth();

  const isSelf = userId === user?.id;
  const isAdmin = (user?.permissions ?? []).includes("hr.dashboard")
    || (user?.permissions ?? []).includes("ledger.view");

  const { data, isLoading } = useQuery({
    queryKey: ["salary", userId, month],
    queryFn: async () => (await api.get<SalaryResponse>("/salary", { params: { userId, month } })).data,
    enabled: !!userId,
  });

  function setMonth(next: string) {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("month", next);
      return n;
    }, { replace: true });
  }
  function shift(delta: number) {
    const [yr, mo] = month.split("-").map(Number);
    let y = yr!, m = mo! + delta;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    setMonth(`${y}-${String(m).padStart(2, "0")}`);
  }

  const prevMonth = useMemo(() => {
    const [yr, mo] = month.split("-").map(Number);
    let y = yr!, m = mo! - 1;
    if (m < 1) { m = 12; y--; }
    return `${y}-${String(m).padStart(2, "0")}`;
  }, [month]);
  const nextMonth = useMemo(() => {
    const [yr, mo] = month.split("-").map(Number);
    let y = yr!, m = mo! + 1;
    if (m > 12) { m = 1; y++; }
    return `${y}-${String(m).padStart(2, "0")}`;
  }, [month]);
  const nextDisabled = nextMonth > currentMonth();

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <style>{SALARY_CSS}</style>

      <PageHead
        group={isSelf ? "SELF" : "HR"}
        meta={`SALARY · ${ymShort(month).toUpperCase()}`}
        title={isLoading ? "Loading…" : (data?.userName ?? "Staff")}
        lede={
          data ? (
            <>
              {data.userDesignation || "—"}
              {data.userDepartment && <> · {data.userDepartment}</>}
              {" · "}
              {data.monthlySalary > 0 ? `${compact(data.monthlySalary)}/month` : "no salary set"}
            </>
          ) : "Loading…"
        }
      />

      {/* Month nav */}
      <div className="toolbar card" style={{ padding: "10px 14px" }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => shift(-1)}>
          ‹ {ymShort(prevMonth)}
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span className="label">VIEWING</span>
          <div className="display-m" style={{ fontSize: 18, marginTop: 2 }}>{ymToLabel(month)}</div>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => shift(1)}
          disabled={nextDisabled}
          style={nextDisabled ? { opacity: 0.4, pointerEvents: "none" } : undefined}
        >
          {ymShort(nextMonth)} ›
        </button>
        {!isSelf && isAdmin && (
          <Link to={`/ledger/staff?month=${month}`} className="btn btn--ghost btn--sm" style={{ marginLeft: "auto" }}>
            ← All staff
          </Link>
        )}
      </div>

      {/* Stat tiles */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint"><Icon name="rupee" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Net earned</div>
              <div className="stat-tile__value">{compact(data?.netEarned ?? 0)}</div>
              <div className="stat-tile__delta">so far this month</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-wheat"><Icon name="ledger" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Daily gross</div>
              <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.dailyGross ?? 0)}</div>
              <div className="stat-tile__delta">
                {compact(data?.monthlySalary ?? 0)} / {data?.daysInMonth ?? 0} days
              </div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-rose"><Icon name="alert" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Total cut</div>
              <div className="stat-tile__value" style={{ color: "var(--error)" }}>
                {compact(data?.totalCut ?? 0)}
              </div>
              <div className="stat-tile__delta">late + early + absent</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mustard"><Icon name="check" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Days marked</div>
              <div className="stat-tile__value">{data?.daysPresent ?? 0}</div>
              <div className="stat-tile__delta">
                {data?.daysAbsent ?? 0} absent · {data?.daysPending ?? 0} in
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop daily ledger */}
      <div className="table-card m-hide">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Daily ledger<BrandDot /></h3>
            <div className="table-card__sub">
              {ymToLabel(month)} · {data?.daysInMonth ?? 0} days
            </div>
          </div>
        </div>
        <div className="sal-head">
          <span>DATE</span><span>STATUS</span><span>IN</span><span>OUT</span>
          <span>LATE</span><span>EARLY</span><span>CUT</span><span>NET</span>
        </div>
        {isLoading ? (
          <Skeleton.Table rows={10} cols={8} />
        ) : (data?.rows.length ?? 0) === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO DATA</div>
            <div className="muted body-s">No ledger rows for this month.</div>
          </div>
        ) : (
          data?.rows.map((r) => {
            const meta = stateMeta(r.state);
            const isToday = r.date === todayIso;
            return (
              <div key={r.date} className={`sal-row ${isToday ? "is-today" : ""}`}>
                <span className="mono body-s">
                  {dayDow(r.date)}
                  {isToday && (
                    <span className="pill pill--info" style={{ fontSize: 9.5, padding: "1px 6px", marginLeft: 4 }}>
                      TODAY
                    </span>
                  )}
                </span>
                <span><span className={`pill ${meta.pill}`}>{meta.label}</span></span>
                <span className="mono body-s">{r.punchIn ?? "—"}</span>
                <span className="mono body-s">{r.punchOut ?? "—"}</span>
                <span className="mono body-s" style={{ color: r.lateMinutes ? "var(--warn)" : "var(--ink-40)" }}>
                  {r.lateMinutes ? fmtMinutes(r.lateMinutes) : "—"}
                </span>
                <span className="mono body-s" style={{ color: r.earlyMinutes ? "var(--warn)" : "var(--ink-40)" }}>
                  {r.earlyMinutes ? fmtMinutes(r.earlyMinutes) : "—"}
                </span>
                <span
                  className="mono"
                  style={{ color: r.cut > 0 ? "var(--error)" : "var(--ink-40)", fontWeight: r.cut > 0 ? 600 : 400 }}
                >
                  {r.cut > 0 ? `–${money(r.cut)}` : "—"}
                </span>
                <span
                  className="mono"
                  style={{
                    fontWeight: 700,
                    color: r.state === "computed" ? "var(--success)" : "var(--ink-40)",
                  }}
                >
                  {r.state === "computed" || r.state === "absent" ? money(r.net) : "—"}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Mobile day cards */}
      <div className="m-show">
        <div className="m-list-head">
          <span className="m-list-head__title">Daily ledger<BrandDot /></span>
          <span className="m-list-head__sub">{ymShort(month)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data?.rows
            .filter((r) => r.state !== "future")
            .map((r) => {
              const meta = stateMeta(r.state);
              const isToday = r.date === todayIso;
              return (
                <div
                  key={r.date}
                  className="card"
                  style={{ padding: "10px 12px", ...(isToday ? { borderColor: "var(--info)" } : {}) }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>
                      {dayDow(r.date)}{isToday && " · TODAY"}
                    </span>
                    <div
                      style={{
                        textAlign: "right",
                        fontFamily: "var(--font-display)",
                        fontWeight: 700, fontSize: 15,
                        color: r.state === "computed" ? "var(--success)" : "var(--ink-40)",
                      }}
                    >
                      {r.state === "computed" || r.state === "absent" ? money(r.net) : "—"}
                    </div>
                    <span className={`pill ${meta.pill}`}>{meta.label}</span>
                  </div>
                  {(r.punchIn || r.punchOut || r.cut > 0) && (
                    <div className="muted body-s" style={{ marginTop: 6, fontSize: 11.5 }}>
                      {r.punchIn && <>In <span className="mono">{r.punchIn}</span></>}
                      {r.punchOut && <> · Out <span className="mono">{r.punchOut}</span></>}
                      {r.lateMinutes > 0 && <> · <span style={{ color: "var(--warn)" }}>late {fmtMinutes(r.lateMinutes)}</span></>}
                      {r.earlyMinutes > 0 && <> · <span style={{ color: "var(--warn)" }}>early {fmtMinutes(r.earlyMinutes)}</span></>}
                      {r.cut > 0 && <> · <span style={{ color: "var(--error)" }}>cut –{money(r.cut)}</span></>}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inline CSS — verbatim of erp/salary/index.php                       */
/* ------------------------------------------------------------------ */
const SALARY_CSS = `
  .sal-head, .sal-row {
    display: grid;
    grid-template-columns: 90px 130px 70px 70px 80px 80px 90px 100px;
    gap: 12px; padding: 10px 18px; align-items: center;
  }
  .sal-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .sal-row { border-bottom: 1px solid var(--rule-soft); font-size: 13px; }
  .sal-row:last-child { border-bottom: 0; }
  .sal-row:hover { background: var(--cream-soft); }
  .sal-row.is-today { background: rgba(42,95,168,0.05); border-left: 3px solid var(--info); }
`;
