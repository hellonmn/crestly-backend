import { useState } from "react";
import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentDiary, useParentHome } from "./hooks";
import { Icon } from "@crestly/icons";

function today(): string { return new Date().toISOString().slice(0, 10); }
function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
function dayLabel(iso: string): string {
  if (iso === today()) return "Today";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
}

export function ParentDiaryPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const [date, setDate] = useState(today());
  const { data, isLoading } = useParentDiary(sr, date);

  const isFuture = date > today();

  return (
    <div className="pd">
      <h1 className="pd__title">Diary & Homework</h1>
      <KidPills kids={kids} />

      <header className="pd__nav">
        <button type="button" onClick={() => setDate(shiftDay(date, -1))} aria-label="Previous day">
          <Icon name="chev-left" size={14} />
        </button>
        <div className="pd__nav-date">
          <strong>{dayLabel(date)}</strong>
          <div className="muted body-s">{fmtFull(date)}</div>
        </div>
        <button type="button" onClick={() => setDate(shiftDay(date, 1))} disabled={isFuture} aria-label="Next day">
          <Icon name="chev-right" size={14} />
        </button>
      </header>

      {data && data.recentDates.length > 0 && (
        <div className="pd__recent">
          {data.recentDates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={"pd__rec-pill " + (d === date ? "is-on" : "")}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      )}

      {isLoading && <div className="muted">Loading…</div>}

      {!isLoading && data && data.entries.length === 0 && (
        <div className="pd__empty">
          <Icon name="diary" size={26} />
          <h2>Nothing logged yet</h2>
          <p className="muted body-s">Teachers update through the day — check back later.</p>
        </div>
      )}

      {(data?.entries ?? []).map((e, i) => (
        <article key={i} className="pd__entry">
          <header className="pd__entry-h">
            <span className="pd__time mono">
              {e.startTime?.slice(0, 5) ?? ""}–{e.endTime?.slice(0, 5) ?? ""}
            </span>
            <div>
              <div className="pd__subj">{e.subjectName ?? e.subjectCode ?? "Activity"}</div>
              {e.teacherName && <div className="muted body-s">{e.teacherName}</div>}
            </div>
          </header>
          {e.topic && (
            <div className="pd__block">
              <div className="muted body-s pd__block-h">Taught</div>
              <p>{e.topic}</p>
            </div>
          )}
          {e.homework && (
            <div className="pd__block pd__block--hw">
              <div className="muted body-s pd__block-h">Homework</div>
              <p>{e.homework}</p>
            </div>
          )}
        </article>
      ))}

      <style>{PD_CSS}</style>
    </div>
  );
}

function fmtFull(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}

const PD_CSS = `
  .pd { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pd__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }

  .pd__nav {
    display: flex; align-items: center; gap: 10px;
    background: var(--white); border: 1px solid var(--rule); border-radius: 12px;
    padding: 10px 12px; margin-bottom: 12px;
  }
  .pd__nav button {
    width: 30px; height: 30px; border-radius: 50%;
    border: 1px solid var(--rule); background: var(--white);
    display: grid; place-items: center; cursor: pointer;
  }
  .pd__nav button:disabled { opacity: .35; cursor: default; }
  .pd__nav-date { flex: 1; text-align: center; }
  .pd__nav-date strong { font-family: var(--font-display, system-ui); font-size: 15px; }

  .pd__recent {
    display: flex; gap: 6px; overflow-x: auto;
    margin-bottom: 14px; padding-bottom: 4px;
    scrollbar-width: none;
  }
  .pd__recent::-webkit-scrollbar { display: none; }
  .pd__rec-pill {
    flex-shrink: 0;
    padding: 5px 12px; border-radius: 999px;
    background: var(--white); border: 1px solid var(--rule);
    font: inherit; font-size: 11.5px; cursor: pointer;
  }
  .pd__rec-pill.is-on { background: var(--tint-wheat, #fcebd6); border-color: var(--orange); font-weight: 700; }

  .pd__empty {
    background: var(--white); border: 1px dashed var(--rule); border-radius: 14px;
    padding: 36px 20px; text-align: center; color: var(--ink-60);
  }
  .pd__empty h2 { font-family: var(--font-display, system-ui); margin: 10px 0 6px; font-size: 16px; }

  .pd__entry {
    background: var(--white); border: 1px solid var(--rule); border-radius: 14px;
    padding: 14px; margin-bottom: 10px;
  }
  .pd__entry-h { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 10px; }
  .pd__time {
    background: var(--cream-soft); padding: 3px 8px; border-radius: 6px;
    font-size: 10.5px; font-weight: 700; letter-spacing: .04em;
    flex-shrink: 0;
  }
  .pd__subj { font-weight: 700; font-size: 14px; }
  .pd__block { margin-top: 8px; }
  .pd__block-h { font-family: var(--font-mono, monospace); font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 3px; }
  .pd__block p { margin: 0; font-size: 13px; line-height: 1.55; }
  .pd__block--hw p {
    background: var(--tint-wheat, #fcebd6); border-left: 3px solid var(--orange);
    padding: 8px 12px; border-radius: 0 8px 8px 0;
  }
`;
