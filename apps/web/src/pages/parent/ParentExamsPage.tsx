import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentExams, useParentHome } from "./hooks";
import { Icon } from "@crestly/icons";

export function ParentExamsPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentExams(sr);

  return (
    <div className="pe">
      <h1 className="pe__title">Exam Result</h1>
      <KidPills kids={kids} />

      {isLoading && <div className="muted">Loading…</div>}

      {!isLoading && !data?.overall && (
        <div className="pe__empty">
          <Icon name="info" size={26} />
          <h2>No results yet</h2>
          <p className="muted body-s">Please check back after the term-end results are published.</p>
        </div>
      )}

      {data?.overall && (
        <>
          <section className="pe__hero">
            <div className="pe__ring" data-pct={Math.min(100, Math.max(0, Math.round(data.overall.weightedPct)))}>
              <span>{Math.round(data.overall.weightedPct)}%</span>
            </div>
            <div className="pe__hero-body">
              <span className="muted body-s">Session {data.sessionCode}</span>
              <div className="pe__chips">
                <span className="pill pill--info">Grade {data.overall.grade}</span>
                <span className={`pill ${data.overall.result === "PASS" ? "pill--success" : "pill--error"}`}>
                  {data.overall.result}
                </span>
              </div>
              <div className="muted body-s" style={{ marginTop: 4 }}>
                {data.overall.totalObtained.toFixed(0)} / {data.overall.totalMax} marks
              </div>
            </div>
          </section>

          <section className="pe__sec">
            <h2 className="pe__h">Performance by term</h2>
            <div className="pe__bars">
              {data.terms.map((t) => (
                <div key={t.id} className="pe__bar-row">
                  <div className="pe__bar-label">{t.shortCode} <span className="muted">({t.weightPercent}%)</span></div>
                  <div className="pe__bar"><span style={{ width: `${Math.min(100, t.pct ?? 0)}%` }} /></div>
                  <div className="pe__bar-pct">{t.pct == null ? "—" : `${t.pct.toFixed(0)}%`}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="pe__sec">
            <h2 className="pe__h">Per subject</h2>
            <div className="pe__bars">
              {data.subjects.map((s) => (
                <div key={s.id} className="pe__bar-row">
                  <div className="pe__bar-label">{s.name}</div>
                  <div className="pe__bar"><span style={{ width: `${Math.min(100, s.finalPct ?? 0)}%` }} /></div>
                  <div className="pe__bar-pct">{s.finalPct == null ? "—" : `${s.finalPct.toFixed(0)}%`}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <style>{PE_CSS}</style>
    </div>
  );
}

const PE_CSS = `
  .pe { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pe__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pe__h { font-family: var(--font-mono, monospace); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-60); margin: 0 0 10px; }
  .pe__empty {
    background: var(--white); border: 1px dashed var(--rule); border-radius: 14px;
    padding: 40px 20px; text-align: center; color: var(--ink-60);
  }
  .pe__empty h2 { font-family: var(--font-display, system-ui); margin: 10px 0 6px; font-size: 17px; }

  .pe__hero {
    display: flex; gap: 16px; align-items: center;
    background: var(--white); border: 1px solid var(--rule); border-radius: 14px;
    padding: 16px;
    margin-bottom: 18px;
  }
  .pe__ring {
    width: 84px; height: 84px; border-radius: 50%;
    display: grid; place-items: center;
    background:
      conic-gradient(var(--orange) calc(var(--pct, 0) * 1%), var(--cream-soft) 0);
    --pct: 0;
    position: relative;
    flex-shrink: 0;
  }
  .pe__ring::before {
    content: ""; position: absolute; inset: 6px; border-radius: 50%; background: var(--white);
  }
  .pe__ring span { position: relative; font-weight: 800; font-size: 17px; }
  .pe__ring[data-pct] { --pct: attr(data-pct); }
  /* attr() in conic-gradient isn't reliable yet — set via inline style fallback */
  .pe__chips { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }

  .pe__sec { background: var(--white); border: 1px solid var(--rule); border-radius: 14px; padding: 14px; margin-bottom: 14px; }
  .pe__bars { display: flex; flex-direction: column; gap: 8px; }
  .pe__bar-row { display: grid; grid-template-columns: 110px 1fr 50px; gap: 10px; align-items: center; font-size: 12px; }
  .pe__bar { background: var(--cream-soft); border-radius: 999px; height: 8px; overflow: hidden; }
  .pe__bar span { display: block; height: 100%; background: var(--orange); border-radius: 999px; }
  .pe__bar-pct { text-align: right; font-weight: 700; font-family: var(--font-mono, monospace); }
`;
