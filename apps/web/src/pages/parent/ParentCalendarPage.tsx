import { useMemo, useState } from "react";
import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentCalendar, useParentHome } from "./hooks";
import type { CalendarCategory, CalendarFeedItem } from "@crestly/shared";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function thisMonth(): string { return new Date().toISOString().slice(0, 7); }
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1 + delta, 1)).toISOString().slice(0, 7);
}
function dotColor(c: CalendarCategory): string {
  switch (c) {
    case "holiday": return "#16a34a";
    case "exam":    return "#2563eb";
    case "fee":     return "var(--orange-deep, #b8410b)";
    case "ptm":
    case "meeting": return "#7c3aed";
    default:        return "var(--ink-60)";
  }
}
function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { d: String(d.getDate()).padStart(2, "0"), dow: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()] };
}

export function ParentCalendarPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const [month, setMonth] = useState<string>(thisMonth);
  const { data, isLoading } = useParentCalendar(sr, month);

  const [y, m] = month.split("-").map(Number);
  const label = `${MONTHS[(m ?? 1) - 1]} ${y}`;

  const byDate = useMemo(() => {
    const groups = new Map<string, CalendarFeedItem[]>();
    for (const it of data?.items ?? []) {
      const arr = groups.get(it.date) ?? [];
      arr.push(it);
      groups.set(it.date, arr);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  return (
    <div className="pcal">
      <h1 className="pcal__title">Calendar</h1>
      <KidPills kids={kids} />

      <div className="pcal__nav">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
        <span>{label}</span>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
      </div>

      {isLoading && <div className="muted">Loading…</div>}

      {!isLoading && byDate.length === 0 && (
        <div className="muted body-s" style={{ textAlign: "center", padding: 24 }}>Nothing scheduled in {label}.</div>
      )}

      {byDate.map(([date, items]) => {
        const { d, dow } = fmtDay(date);
        return (
          <div key={date} className="pcal__day">
            <div className="pcal__date"><span className="pcal__d">{d}</span><span className="pcal__dow">{dow}</span></div>
            <div className="pcal__items">
              {items.map((it) => (
                <div key={it.key} className="pcal__item">
                  <span className="pcal__dot" style={{ background: dotColor(it.category) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pcal__name">{it.title}</div>
                    <div className="muted body-s">
                      {it.category.toUpperCase()}
                      {!it.allDay && it.startTime ? ` · ${it.startTime}${it.endTime ? `–${it.endTime}` : ""}` : ""}
                      {it.location ? ` · ${it.location}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pcal { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pcal__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pcal__nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 12px 0 16px; font-weight: 700; }
  .pcal__nav button { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--rule); background: var(--white); cursor: pointer; font-size: 18px; }
  .pcal__day { display: flex; gap: 12px; padding: 10px 0; border-top: 1px dashed var(--rule-soft); }
  .pcal__date { width: 40px; text-align: center; flex-shrink: 0; }
  .pcal__d { display: block; font-family: var(--font-mono, monospace); font-weight: 800; font-size: 17px; }
  .pcal__dow { font-size: 9.5px; letter-spacing: .08em; color: var(--ink-40); text-transform: uppercase; }
  .pcal__items { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .pcal__item { display: flex; align-items: center; gap: 10px; background: var(--white); border: 1px solid var(--rule); border-radius: 12px; padding: 10px 12px; }
  .pcal__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .pcal__name { font-weight: 700; font-size: 13.5px; }
`;
