import { Link } from "react-router-dom";
import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentHome, useParentTests } from "./hooks";
import type { ParentTestListItem } from "@crestly/shared";

const STATE_LABEL: Record<ParentTestListItem["state"], string> = {
  available: "Start", upcoming: "Upcoming", closed: "Closed", attempted: "View score",
};

export function ParentTestsPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentTests(sr);

  return (
    <div className="pt">
      <h1 className="pt__title">Tests</h1>
      <KidPills kids={kids} />

      {isLoading && <div className="muted">Loading…</div>}

      {!isLoading && (data?.tests.length ?? 0) === 0 && (
        <div className="muted body-s" style={{ textAlign: "center", padding: 24 }}>No tests assigned yet.</div>
      )}

      {data?.tests.map((t) => {
        const clickable = t.state === "available" || t.state === "attempted";
        const inner = (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="pt__name">{t.title}</div>
              <div className="muted body-s">
                {t.subjectName ? `${t.subjectName} · ` : ""}{t.questionCount} questions · {t.totalMarks} marks
                {t.durationMin ? ` · ${t.durationMin} min` : ""}
              </div>
            </div>
            {t.state === "attempted" && t.score != null ? (
              <span className="pt__scorewrap">
                <span className="pt__score">{t.score}/{t.totalMarks}</span>
                {t.passed != null && (
                  <span className={`pt__pf ${t.passed ? "is-pass" : "is-fail"}`}>{t.passed ? "PASS" : "FAIL"}</span>
                )}
              </span>
            ) : (
              <span className={`pt__badge pt__badge--${t.state}`}>{STATE_LABEL[t.state]}</span>
            )}
          </>
        );
        return clickable ? (
          <Link key={t.id} to={`/parent/tests/${t.id}?sr=${sr}`} className="pt__row">{inner}</Link>
        ) : (
          <div key={t.id} className="pt__row pt__row--off">{inner}</div>
        );
      })}

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pt { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pt__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pt__row {
    display: flex; align-items: center; gap: 12px;
    background: var(--white); border: 1px solid var(--rule); border-radius: 12px;
    padding: 14px; margin-bottom: 8px; color: var(--ink); text-decoration: none;
  }
  .pt__row:hover { border-color: var(--orange); }
  .pt__row--off { opacity: .6; }
  .pt__name { font-weight: 700; font-size: 14px; }
  .pt__scorewrap { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
  .pt__score { font-family: var(--font-mono, monospace); font-weight: 800; font-size: 15px; color: var(--orange-deep, #b8410b); }
  .pt__pf { font-size: 9px; font-weight: 800; letter-spacing: .06em; padding: 1px 6px; border-radius: 999px; }
  .pt__pf.is-pass { background: #dcfce7; color: #166534; }
  .pt__pf.is-fail { background: rgba(220,38,38,.12); color: #dc2626; }
  .pt__badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; flex-shrink: 0; }
  .pt__badge--available { background: var(--orange); color: #fff; }
  .pt__badge--upcoming { background: var(--cream-soft); color: var(--ink-60); }
  .pt__badge--closed { background: #f3f4f6; color: #6b7280; }
  .pt__badge--attempted { background: #dcfce7; color: #166534; }
`;
