import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useAttendanceHistory } from "./hooks";
import type { AttendanceStatus } from "@crestly/shared";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: "var(--tint-mint-deep)",
  absent: "var(--error)",
  late: "var(--warn)",
  excused: "var(--info)",
};
const STATUS_BG: Record<AttendanceStatus, string> = {
  present: "var(--tint-mint)",
  absent: "var(--error-soft)",
  late: "var(--warn-soft)",
  excused: "var(--info-soft)",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AttendanceHistoryPage() {
  const { srNumber } = useParams<{ srNumber: string }>();
  const sr = Number(srNumber);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data, isLoading } = useAttendanceHistory(sr, year, month);

  // Build calendar grid: Mon-first 7-col rows.
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1));
    const last = new Date(Date.UTC(year, month, 0));
    const startOffset = (first.getUTCDay() + 6) % 7;     // 0=Mon
    const out: ({ date: string; day: number; status: AttendanceStatus | null } | null)[] = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= last.getUTCDate(); d++) {
      const iso = new Date(Date.UTC(year, month - 1, d)).toISOString().slice(0, 10);
      out.push({ date: iso, day: d, status: data?.days[iso] ?? null });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [year, month, data]);

  function shift(months: number) {
    let m = month + months;
    let y = year;
    while (m < 1) { m += 12; y--; }
    while (m > 12) { m -= 12; y++; }
    setYear(y);
    setMonth(m);
  }

  const pct = data && data.marked > 0
    ? Math.round(((data.present + data.late) / data.marked) * 100)
    : 0;

  return (
    <>
      <PageHead
        group="ATTENDANCE"
        meta={`SR #${sr}`}
        title="Attendance history"
        lede={data ? `${data.marked} days marked · ${pct}% present this month` : "Loading…"}
        actions={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(-1)}>‹ Prev</button>
            <button className="btn btn--ghost btn--sm" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }}>This month</button>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(1)}>Next ›</button>
            <Link to="/attendance" className="btn btn--primary btn--sm">
              <Icon name="chev-left" size={14} /> Back
            </Link>
          </>
        }
      />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile tint="mustard" icon="attendance" label="MONTH %" value={`${pct}%`} delta={data ? `${data.marked} of marked` : ""} />
        <StatTile tint="rose" icon="x" label="ABSENCES" value={String(data?.absent ?? "—")} delta="" />
        <StatTile tint="wheat" icon="alert" label="LATE" value={String(data?.late ?? "—")} delta="" />
        <StatTile tint="sky" icon="info" label="EXCUSED" value={String(data?.excused ?? "—")} delta="" />
      </div>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12 }}>
          {new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </div>
        {isLoading ? (
          <p className="muted">Loading calendar…</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((d) => (
                <div key={d} className="label" style={{ textAlign: "center", color: "var(--ink-40)" }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {cells.map((c, i) => {
                if (!c) return <div key={i} />;
                const bg = c.status ? STATUS_BG[c.status] : "var(--cream-soft)";
                const fg = c.status ? STATUS_COLORS[c.status] : "var(--ink-40)";
                return (
                  <div
                    key={c.date}
                    title={c.status ?? "not marked"}
                    style={{
                      padding: "8px 6px",
                      borderRadius: "var(--r-3)",
                      background: bg,
                      color: fg,
                      textAlign: "center",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {c.day}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 16, fontSize: 12 }}>
              {(Object.keys(STATUS_BG) as AttendanceStatus[]).map((s) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_BG[s] }} />
                  <span className="muted">{s}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
