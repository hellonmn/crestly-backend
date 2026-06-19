import { useState } from "react";
import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentAttendance, useParentHome } from "./hooks";
import { Icon } from "@crestly/icons";

const STATUS_COLOR: Record<string, string> = {
  present:    "#16a34a",
  late:       "#d97706",
  excused:    "#0ea5e9",
  absent:     "#dc2626",
  not_marked: "#9ca3af",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayMonth(): string {
  return new Date().toISOString().slice(0, 7);
}
function shiftMonth(m: string, delta: number): string {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, mm! - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  return new Date(Date.UTC(y!, mm! - 1, 1))
    .toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function ParentAttendancePage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const [month, setMonth] = useState(todayMonth());
  const { data, isLoading } = useParentAttendance(sr, month);

  const [yy, mm] = month.split("-").map(Number);
  const first = new Date(Date.UTC(yy!, mm! - 1, 1));
  const daysInMonth = new Date(Date.UTC(yy!, mm!, 0)).getUTCDate();
  const startOffset = first.getUTCDay();   // 0 = Sun

  return (
    <div className="pa">
      <h1 className="pa__title">Attendance</h1>
      <KidPills kids={kids} />

      <section className="pa__today">
        <Icon name="calendar" size={16} />
        <div>
          <div className="muted body-s">Today</div>
          <strong>{data?.todayStatus ? labelStatus(data.todayStatus) : "—"}</strong>
        </div>
      </section>

      <section className="pa__last7">
        <h2 className="pa__h">Last 7 days</h2>
        <div className="pa__last7-row">
          {(data?.last7 ?? []).map((d) => (
            <div
              key={d.iso}
              className="pa__last7-cell"
              title={`${d.iso} — ${labelStatus(d.status)}`}
              style={{ background: STATUS_COLOR[d.status] ?? STATUS_COLOR.not_marked }}
            >
              <span>{d.iso.slice(8, 10)}</span>
              <em>{shortStatus(d.status)}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="pa__month">
        <header className="pa__month-head">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
            <Icon name="chev-left" size={14} />
          </button>
          <h2 className="pa__h" style={{ margin: 0 }}>{monthLabel(month)}</h2>
          <button type="button" onClick={() => setMonth(shiftMonth(month, +1))} aria-label="Next month">
            <Icon name="chev-right" size={14} />
          </button>
        </header>

        <div className="pa__summary">
          <Stat label="%" value={`${data?.monthSummary.percent ?? 0}%`} tone="ok" />
          <Stat label="Present" value={String(data?.monthSummary.present ?? 0)} />
          <Stat label="Late"    value={String(data?.monthSummary.late ?? 0)} />
          <Stat label="Absent"  value={String(data?.monthSummary.absent ?? 0)} />
          <Stat label="Excused" value={String(data?.monthSummary.excused ?? 0)} />
        </div>

        <div className="pa__cal">
          {DAY_NAMES.map((d) => <div key={d} className="pa__cal-h">{d}</div>)}
          {Array.from({ length: startOffset }).map((_, i) => <div key={`b${i}`} className="pa__cal-blank" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const n = i + 1;
            const status = data?.days[String(n)] ?? "not_marked";
            return (
              <div
                key={n}
                className="pa__cal-cell"
                title={`${month}-${String(n).padStart(2, "0")} — ${labelStatus(status)}`}
                style={{ background: STATUS_COLOR[status] }}
              >
                {n}
              </div>
            );
          })}
        </div>

        {isLoading && <div className="muted body-s" style={{ marginTop: 12 }}>Loading…</div>}
      </section>

      <style>{PA_CSS}</style>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="pa__stat">
      <div className={`pa__stat-v ${tone === "ok" ? "is-ok" : ""}`}>{value}</div>
      <div className="muted body-s">{label}</div>
    </div>
  );
}

function labelStatus(s: string): string {
  return s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function shortStatus(s: string): string {
  return s === "present" ? "P" : s === "absent" ? "A" : s === "late" ? "L" : s === "excused" ? "E" : "·";
}

const PA_CSS = `
  .pa { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pa__title {
    font-family: var(--font-display, system-ui);
    font-weight: 800; font-size: 22px; letter-spacing: -.02em;
    margin: 0 0 14px;
  }
  .pa__h {
    font-family: var(--font-mono, monospace);
    font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase;
    color: var(--ink-60);
    margin: 0 0 8px;
  }
  .pa__today {
    display: flex; align-items: center; gap: 12px;
    background: var(--white); border: 1px solid var(--rule);
    border-radius: 12px; padding: 14px;
    margin-bottom: 18px;
  }
  .pa__today > svg { color: var(--orange-deep, var(--orange)); flex-shrink: 0; }
  .pa__today strong { display: block; font-size: 16px; }

  .pa__last7 { margin-bottom: 22px; }
  .pa__last7-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .pa__last7-cell {
    aspect-ratio: 1; border-radius: 10px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; font-weight: 700; font-size: 13px;
  }
  .pa__last7-cell em { font-style: normal; font-size: 9.5px; opacity: .9; }

  .pa__month { background: var(--white); border: 1px solid var(--rule); border-radius: 14px; padding: 14px; }
  .pa__month-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .pa__month-head button {
    width: 28px; height: 28px; border-radius: 50%;
    border: 1px solid var(--rule); background: var(--white);
    cursor: pointer; display: grid; place-items: center;
  }
  .pa__summary {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;
    margin-bottom: 14px;
  }
  .pa__stat {
    background: var(--cream-soft); border-radius: 8px; padding: 8px 4px; text-align: center;
  }
  .pa__stat-v { font-weight: 800; font-size: 16px; }
  .pa__stat-v.is-ok { color: var(--success, #16a34a); }

  .pa__cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .pa__cal-h {
    text-align: center; font-size: 10px; font-weight: 700;
    color: var(--ink-40); padding: 4px 0;
    font-family: var(--font-mono, monospace); letter-spacing: .08em;
  }
  .pa__cal-blank { aspect-ratio: 1; }
  .pa__cal-cell {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px;
    color: white; font-weight: 600; font-size: 11px;
  }
`;
