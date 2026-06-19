import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentHome, useParentTimetable } from "./hooks";
import { Icon } from "@crestly/icons";

const DAY_NAMES = [
  { idx: 1, short: "Mon", long: "Monday" },
  { idx: 2, short: "Tue", long: "Tuesday" },
  { idx: 3, short: "Wed", long: "Wednesday" },
  { idx: 4, short: "Thu", long: "Thursday" },
  { idx: 5, short: "Fri", long: "Friday" },
  { idx: 6, short: "Sat", long: "Saturday" },
];

export function ParentTimetablePage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentTimetable(sr);

  // Build (day, period) → cell map for O(1) lookup
  const lookup = new Map<string, NonNullable<typeof data>["cells"][number]>();
  for (const c of data?.cells ?? []) {
    lookup.set(`${c.dayOfWeek}|${c.periodId}`, c);
  }

  return (
    <div className="pt">
      <h1 className="pt__title">Timetable</h1>
      <KidPills kids={kids} />

      {data && (
        <header className="pt__head">
          <Icon name="timetable" size={18} />
          <div>
            <strong>Class {data.classLabel}</strong>
            <div className="muted body-s">Session {data.sessionCode}</div>
          </div>
        </header>
      )}

      {isLoading && <div className="muted">Loading…</div>}

      {data && data.periods.length === 0 && (
        <div className="pt__empty">
          <Icon name="info" size={26} />
          <h2>Timetable not published yet</h2>
          <p className="muted body-s">The school hasn't set up the schedule. Check back soon.</p>
        </div>
      )}

      {data && data.periods.length > 0 && (
        <div className="pt__scroll">
          <table className="pt__grid">
            <thead>
              <tr>
                <th>Period</th>
                {DAY_NAMES.map((d) => <th key={d.idx} title={d.long}>{d.short}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.periods.map((p) => (
                <tr key={p.id} className={p.isBreak ? "is-break" : ""}>
                  <th className="pt__phead">
                    <div className="pt__pname">{p.name}</div>
                    <div className="muted mono pt__ptime">{p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)}</div>
                  </th>
                  {p.isBreak ? (
                    <td className="pt__break" colSpan={6}>{p.name}</td>
                  ) : (
                    DAY_NAMES.map((d) => {
                      const c = lookup.get(`${d.idx}|${p.id}`);
                      return (
                        <td key={d.idx} className={"pt__cell " + (c?.subjectName ? "is-filled" : "")}>
                          {c?.subjectName ? (
                            <>
                              <div className="pt__subj">{c.subjectName}</div>
                              {c.teacherName && <div className="muted body-s">{c.teacherName.split(" ")[0]}</div>}
                              {c.room && <div className="muted mono" style={{ fontSize: 10 }}>{c.room}</div>}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      );
                    })
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{PT_CSS}</style>
    </div>
  );
}

const PT_CSS = `
  .pt { max-width: 920px; margin: 0 auto; padding: 22px 18px 32px; }
  .pt__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pt__head {
    display: flex; align-items: center; gap: 12px;
    background: var(--white); border: 1px solid var(--rule); border-radius: 12px;
    padding: 12px 14px; margin-bottom: 14px;
  }
  .pt__head > svg { color: var(--orange-deep, var(--orange)); }
  .pt__head strong { display: block; font-family: var(--font-display, system-ui); }

  .pt__empty {
    background: var(--white); border: 1px dashed var(--rule); border-radius: 14px;
    padding: 36px 20px; text-align: center; color: var(--ink-60);
  }
  .pt__empty h2 { font-family: var(--font-display, system-ui); margin: 10px 0 6px; font-size: 16px; }

  .pt__scroll { overflow-x: auto; background: var(--white); border: 1px solid var(--rule); border-radius: 14px; }
  .pt__grid { width: 100%; border-collapse: separate; border-spacing: 0; min-width: 640px; }
  .pt__grid thead th {
    text-align: center; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-60); padding: 8px 6px; background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
  }
  .pt__grid tbody th {
    text-align: left; padding: 10px 12px;
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule-soft);
    width: 110px;
  }
  .pt__pname { font-weight: 700; font-size: 12.5px; }
  .pt__ptime { font-size: 10px; }
  .pt__cell {
    padding: 8px 10px; vertical-align: top;
    border-left: 1px solid var(--rule-soft);
    border-bottom: 1px solid var(--rule-soft);
    min-height: 60px;
    font-size: 12px;
  }
  .pt__cell.is-filled { background: var(--tint-wheat, #fcebd6); }
  .pt__subj { font-weight: 700; line-height: 1.2; }
  .pt__break {
    background: repeating-linear-gradient(45deg, var(--cream-soft), var(--cream-soft) 8px, var(--cream) 8px, var(--cream) 16px);
    text-align: center;
    font-style: italic; color: var(--ink-60);
    border-bottom: 1px solid var(--rule-soft);
  }
`;
