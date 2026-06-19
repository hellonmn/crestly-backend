import { Fragment, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useMarksheet } from "./hooks";
import type { Marksheet } from "@crestly/shared";

/* ============================================================
   Marksheet print page — ports erp/exams/marksheet.php's
   .ms-sheet template verbatim. Renders as a single A4 portrait
   page; ?auto=1 fires window.print() once data loads.
   ============================================================ */

function fmt1(n: number): string {
  // PHP rtrim(rtrim(number_format($n, 1), '0'), '.') → "85" not "85.0"
  const s = (Math.round(n * 10) / 10).toFixed(1);
  return s.replace(/\.0+$/, "");
}
function fmtPct(n: number): string { return (Math.round(n * 10) / 10).toFixed(1); }
function fmtWeight(n: number): string {
  const s = (Math.round(n * 100) / 100).toFixed(2);
  return s.replace(/\.?0+$/, "");
}
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}
function padSr(n: number): string { return String(n).padStart(4, "0"); }
function todayLabel(): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date());
}

// Grade ladder: A1, A2, B1, B2, C1, C2, D, E (matches PHP exam_grade_from_percent).
function gradeFor(pct: number): string {
  if (pct >= 91) return "A1";
  if (pct >= 81) return "A2";
  if (pct >= 71) return "B1";
  if (pct >= 61) return "B2";
  if (pct >= 51) return "C1";
  if (pct >= 41) return "C2";
  if (pct >= 33) return "D";
  return "E";
}

/* The server's overall.grade uses the simpler A+/A/B+/... ladder
   from results.service.ts. The PHP marksheet uses A1/A2/.../D/E.
   We compute the marksheet-style grade client-side to keep visuals
   identical. */
function letterGrade(pct: number): string { return gradeFor(pct); }

export function MarksheetPrintPage() {
  const { sr } = useParams<{ sr: string }>();
  const [params] = useSearchParams();
  const auto = params.get("auto") === "1";
  const termIdParam = params.get("term");
  const termId = termIdParam ? Number(termIdParam) : undefined;

  const srNumber = Number(sr);
  const { data, isLoading, error } = useMarksheet(srNumber, termId);

  useEffect(() => {
    if (!auto || !data) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [auto, data]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "Geist, system-ui" }}>
        Loading marksheet…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "Geist, system-ui" }}>
        <h2>Marksheet not available</h2>
        <p>No data for SR #{srNumber}. The student may not have any marks entered yet.</p>
        <Link to="/exams/results">← Back to results</Link>
      </div>
    );
  }

  const isSingle = data.isSingleTerm;
  const filter = data.filterTerm;
  const pageTitle = isSingle && filter ? `${filter.shortCode} Marksheet` : "Marksheet";
  document.title = `${pageTitle} · ${data.student.studentName}`;

  return (
    <>
      <style>{MS_CSS}</style>

      {/* On-screen toolbar — hidden when printing. */}
      <div className="ms-toolbar no-print">
        <div className="ms-toolbar__crumb">
          <Link to="/exams" className="label">EXAMS</Link>
          <span className="muted">·</span>
          <Link
            to={`/exams/results?class=${encodeURIComponent(data.student.class)}&section=${encodeURIComponent(data.student.section)}${isSingle && filter ? `&termId=${filter.id}` : ""}`}
            className="label"
          >
            CLASS {data.student.class}-{data.student.section}
          </Link>
          <span className="muted">·</span>
          <span className="label">{isSingle && filter ? `${filter.shortCode.toUpperCase()} MARKSHEET` : "FULL-SESSION MARKSHEET"}</span>
        </div>
        <div className="ms-toolbar__actions">
          <select
            className="select select--sm"
            value={termId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const next = new URL(window.location.href);
              if (v) next.searchParams.set("term", v); else next.searchParams.delete("term");
              window.location.href = next.toString();
            }}
            style={{ minWidth: 200 }}
            aria-label="Marksheet view"
          >
            <option value="">Full Session · Report Card</option>
            {data.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode} — {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => window.print()}
          >
            <PrintIcon /> Print / Save PDF
          </button>
        </div>
      </div>

      <Sheet data={data} isSingle={isSingle} filterTermShortCode={filter?.shortCode ?? null} filterTermName={filter?.name ?? null} />
    </>
  );
}

/* ============================================================
   Sheet — the A4 page that renders identically on-screen and
   when printed.
   ============================================================ */

function Sheet({
  data, isSingle, filterTermShortCode, filterTermName,
}: {
  data: Marksheet;
  isSingle: boolean;
  filterTermShortCode: string | null;
  filterTermName: string | null;
}) {
  const ov = data.overall;
  const pass = ov.result === "PASS";
  const bandPrefix = isSingle && filterTermShortCode ? `${filterTermShortCode.toUpperCase()} ` : "Final ";
  const showPromotionCell = data.nextClass !== null || !isSingle;

  // Per-term column totals for the tfoot row (mirrors PHP totals).
  const colTotals = data.terms.map((t) => {
    let max = 0;
    let obt = 0;
    for (const sub of data.subjects) {
      const cell = sub.perTerm[String(t.id)];
      if (cell) {
        max += cell.max;
        if (!cell.isAbsent && cell.obtained !== null) obt += cell.obtained;
      } else {
        // No marks row entered: still count the cell's potential max.
        max += 0;
      }
    }
    return { max, obt };
  });

  const overallLetter = letterGrade(ov.percent);

  return (
    <div className="ms-sheet">
      {/* Decorative top band */}
      <div className="ms-band" />

      {/* School header */}
      <header className="ms-school">
        <div className="ms-school__logo">
          <svg viewBox="0 0 100 100" width="64" height="64">
            <rect width="100" height="100" rx="22" fill="#100D0A" />
            <path
              d="M 80 36 A 34 34 0 1 0 80 68 L 58.25 68 A 18 18 0 1 1 58.25 36 Z"
              fill="#F5EFE3"
              fillRule="evenodd"
            />
            <circle cx="72" cy="78" r="6.5" fill="#F25C19" />
          </svg>
        </div>
        <div className="ms-school__id">
          <div className="ms-school__name">
            {data.school.name}<span className="brand-dot">.</span>
          </div>
          {data.school.address && (
            <div className="ms-school__addr">{data.school.address}</div>
          )}
          {data.school.board && (
            <div className="ms-school__addr">{data.school.board}</div>
          )}
        </div>
        <div className="ms-school__rc">
          <div className="ms-school__rc-title">
            {isSingle && filterTermName ? filterTermName : "Report Card"}
          </div>
          <div className="ms-school__rc-sub">
            {data.school.sessionLabel || `Academic Session ${data.session}`}
          </div>
          {isSingle && filterTermShortCode && (
            <div className="ms-school__rc-dates">
              {filterTermShortCode.toUpperCase()} · Weight {fmtWeight(data.terms[0]?.weightPercent ?? 0)}%
              {data.terms[0]?.isFinalized && " · FINALIZED"}
            </div>
          )}
        </div>
      </header>

      {/* Student profile band */}
      <section className="ms-profile">
        <div className="ms-cell ms-cell--name">
          <span className="ms-cell__lbl">Student Name</span>
          <span className="ms-cell__val">{data.student.studentName}</span>
        </div>
        <div className="ms-cell">
          <span className="ms-cell__lbl">Class &amp; Section</span>
          <span className="ms-cell__val">{data.student.class} – {data.student.section}</span>
        </div>
        <div className="ms-cell">
          <span className="ms-cell__lbl">SR No.</span>
          <span className="ms-cell__val mono">{padSr(data.student.srNumber)}</span>
        </div>
        <div className="ms-cell">
          <span className="ms-cell__lbl">Father's Name</span>
          <span className="ms-cell__val">{data.student.fatherName || "—"}</span>
        </div>
        <div className="ms-cell">
          <span className="ms-cell__lbl">Mother's Name</span>
          <span className="ms-cell__val">{data.student.motherName || "—"}</span>
        </div>
        <div className="ms-cell">
          <span className="ms-cell__lbl">Date of Birth</span>
          <span className="ms-cell__val">{fmtDay(data.student.dob)}</span>
        </div>
      </section>

      {/* Scholastic table */}
      <section className="ms-block">
        <div className="ms-block__title">Scholastic Performance</div>
        <table className="ms-tbl ms-tbl--sch">
          <thead>
            <tr>
              <th rowSpan={2} className="ms-tbl__sub">Subject</th>
              {data.terms.map((t) => (
                <th key={t.id} colSpan={2} className="ms-tbl__term">
                  {t.shortCode}
                  {!isSingle && (
                    <span className="ms-tbl__w">{fmtPct(t.weightPercent)}%</span>
                  )}
                </th>
              ))}
              <th colSpan={3} className="ms-tbl__final">Final</th>
            </tr>
            <tr>
              {data.terms.map((t) => (
                <Fragment key={`hd-${t.id}`}>
                  <th className="ms-tbl__mm">M.M.</th>
                  <th className="ms-tbl__ob">Obt.</th>
                </Fragment>
              ))}
              <th className="ms-tbl__pct">%</th>
              <th className="ms-tbl__gr">Grade</th>
              <th className="ms-tbl__rs">Result</th>
            </tr>
          </thead>
          <tbody>
            {data.subjects.map((sub) => {
              const failed = sub.failed;
              const subjectLetter = letterGrade(sub.weightedPercent);
              return (
                <tr key={sub.subjectId} className={failed ? "is-fail" : ""}>
                  <td className="ms-tbl__sub">{sub.subjectName}</td>
                  {data.terms.map((t) => {
                    const cell = sub.perTerm[String(t.id)];
                    const max = cell?.max ?? 0;
                    let obtDisplay = "—";
                    let obtCls = "is-empty";
                    if (cell) {
                      if (cell.isAbsent) { obtDisplay = "AB"; obtCls = "is-absent"; }
                      else if (cell.obtained !== null) {
                        obtDisplay = fmt1(cell.obtained);
                        obtCls = "";
                      }
                    }
                    return (
                      <Fragment key={`sub-${sub.subjectId}-t-${t.id}`}>
                        <td className="ms-tbl__mm mono">{max}</td>
                        <td className={`ms-tbl__ob mono ${obtCls}`}>{obtDisplay}</td>
                      </Fragment>
                    );
                  })}
                  <td className="ms-tbl__pct mono">{fmtPct(sub.weightedPercent)}</td>
                  <td className="ms-tbl__gr">
                    <span className={`ms-grade ms-grade--${subjectLetter.toLowerCase()}`}>{subjectLetter}</span>
                  </td>
                  <td className="ms-tbl__rs">
                    <span className={`ms-rs ms-rs--${failed ? "f" : "p"}`}>{failed ? "FAIL" : "PASS"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="ms-tbl__sub" style={{ textAlign: "right" }}>Total</td>
              {data.terms.map((t, i) => {
                const ct = colTotals[i] ?? { max: 0, obt: 0 };
                return (
                  <Fragment key={`tot-${t.id}`}>
                    <td className="ms-tbl__mm mono">{ct.max}</td>
                    <td className="ms-tbl__ob mono">{fmt1(ct.obt)}</td>
                  </Fragment>
                );
              })}
              <td className="ms-tbl__pct mono">{fmtPct(ov.percent)}</td>
              <td className="ms-tbl__gr">
                <span className={`ms-grade ms-grade--${overallLetter.toLowerCase()}`}>{overallLetter}</span>
              </td>
              <td className="ms-tbl__rs">
                <span className={`ms-rs ms-rs--${pass ? "p" : "f"}`}>{pass ? "PASS" : "FAIL"}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Co-scholastic */}
      {data.coScholastic.length > 0 && (
        <section className="ms-block">
          <div className="ms-block__title">Co-Scholastic Areas</div>
          <table className="ms-tbl ms-tbl--co">
            <thead>
              <tr>
                <th className="ms-tbl__sub">Area</th>
                {data.terms.map((t) => <th key={t.id}>{t.shortCode}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.coScholastic.map((a) => (
                <tr key={a.areaId}>
                  <td className="ms-tbl__sub">
                    {a.areaName}
                    {a.description && <span className="ms-co__desc">{a.description}</span>}
                  </td>
                  {data.terms.map((t) => {
                    const g = a.perTerm[String(t.id)] ?? null;
                    const cls = g ? g.toLowerCase() : "none";
                    return (
                      <td key={t.id}>
                        <span className={`ms-co-grade ms-co-grade--${cls}`}>{g ?? "—"}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Result band */}
      <section className={`ms-result ${pass ? "is-pass" : "is-fail"} ${showPromotionCell ? "" : "ms-result--4col"}`}>
        <div className="ms-result__cell">
          <span className="ms-result__lbl">{bandPrefix}Percentage</span>
          <span className="ms-result__val ms-result__val--lg">{fmtPct(ov.percent)}%</span>
        </div>
        <div className="ms-result__cell">
          <span className="ms-result__lbl">{bandPrefix}Grade</span>
          <span className="ms-result__val">
            <span className={`ms-grade ms-grade--${overallLetter.toLowerCase()} ms-grade--lg`}>{overallLetter}</span>
          </span>
        </div>
        <div className="ms-result__cell">
          <span className="ms-result__lbl">Total Marks</span>
          <span className="ms-result__val mono">{fmt1(ov.obtained)} / {ov.max}</span>
        </div>
        <div className="ms-result__cell">
          <span className="ms-result__lbl">Result</span>
          <span className="ms-result__val ms-result__verdict">{pass ? "PASS" : "FAIL"}</span>
        </div>
        {showPromotionCell && (
          <div className="ms-result__cell">
            <span className="ms-result__lbl">{pass ? "Promoted to" : "Status"}</span>
            <span className="ms-result__val">
              {pass && data.nextClass
                ? `Class ${data.nextClass}`
                : pass
                ? "Course Complete"
                : "Re-appear"}
            </span>
          </div>
        )}
      </section>

      {/* Legend */}
      <section className="ms-legend">
        <div className="ms-legend__col">
          <div className="ms-legend__title">Grade Scale (Scholastic)</div>
          <div className="ms-legend__grid">
            <span><b>A1</b> 91–100</span><span><b>A2</b> 81–90</span>
            <span><b>B1</b> 71–80</span><span><b>B2</b> 61–70</span>
            <span><b>C1</b> 51–60</span><span><b>C2</b> 41–50</span>
            <span><b>D</b> 33–40</span><span><b>E</b> 0–32</span>
          </div>
        </div>
        <div className="ms-legend__col">
          <div className="ms-legend__title">Co-Scholastic Grades</div>
          <div className="ms-legend__grid ms-legend__grid--3">
            <span><b>A</b> Outstanding</span>
            <span><b>B</b> Very Good</span>
            <span><b>C</b> Satisfactory</span>
          </div>
          <div className="ms-legend__note">
            {isSingle && filterTermShortCode ? (
              <>
                Pass criteria: marks ≥ the paper's pass-marks in every subject of <b>{filterTermShortCode}</b>.{" "}
                <b>AB</b> = absent. This card reflects only the <b>{filterTermName}</b>; the full-session
                Report Card combines all terms with their weightage.
              </>
            ) : (
              <>
                Pass criteria: ≥ 33% in the <b>{data.annualTerm?.shortCode ?? "Annual"}</b> exam of every subject.{" "}
                <b>AB</b> = absent. Aggregate is the weighted average across all terms.
              </>
            )}
          </div>
        </div>
      </section>

      {/* Signatures */}
      <footer className="ms-sign">
        <div className="ms-sign__col"><span className="ms-sign__line" /><span className="ms-sign__lbl">Class Teacher</span></div>
        <div className="ms-sign__col"><span className="ms-sign__line" /><span className="ms-sign__lbl">Examination In-Charge</span></div>
        <div className="ms-sign__col"><span className="ms-sign__line" /><span className="ms-sign__lbl">Principal</span></div>
        <div className="ms-sign__col"><span className="ms-sign__line" /><span className="ms-sign__lbl">Parent's Signature</span></div>
      </footer>

      {/* Issue stamp */}
      <div className="ms-stamp">
        Issued on {todayLabel()} · {data.school.name}
      </div>
    </div>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
         style={{ marginRight: 6, verticalAlign: -2 }}>
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z"/>
    </svg>
  );
}

/* ============================================================
   Inline styles — verbatim port of erp/exams/marksheet.php's
   .ms-* rules so the page paints pixel-for-pixel identical.
   ============================================================ */
const MS_CSS = `
  body { background: #ECE6D8; margin: 0; }

  .ms-toolbar {
    max-width: 210mm;
    margin: 12px auto;
    padding: 10px 14px;
    background: #FAF6EE;
    border: 1px solid rgba(16,13,10,0.1);
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: 'Geist', system-ui, sans-serif;
    flex-wrap: wrap;
  }
  .ms-toolbar__crumb { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .ms-toolbar__crumb .label {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(16,13,10,0.55);
    text-decoration: none;
  }
  .ms-toolbar__crumb .label:hover { color: #100D0A; }
  .ms-toolbar__crumb .muted { color: rgba(16,13,10,0.35); }
  .ms-toolbar__actions {
    margin-left: auto;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .ms-toolbar .btn {
    display: inline-flex; align-items: center;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(16,13,10,0.15);
    background: #fff;
    color: #100D0A;
    font-size: 12.5px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    line-height: 1.1;
  }
  .ms-toolbar .btn--primary { background: #100D0A; color: #F5EFE3; border-color: #100D0A; }
  .ms-toolbar .select {
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid rgba(16,13,10,0.15);
    background: #fff;
    font-size: 12.5px;
    color: #100D0A;
    font-family: inherit;
  }

  /* ============================================================
     THE A4 SHEET
     ============================================================ */
  :root {
    --ms-ink:    #100D0A;
    --ms-ink-60: rgba(16,13,10,0.6);
    --ms-ink-40: rgba(16,13,10,0.4);
    --ms-ink-15: rgba(16,13,10,0.15);
    --ms-cream:  #F5EFE3;
    --ms-cream-soft: #FAF6EE;
    --ms-orange: #F25C19;
    --ms-success:#1F6F4A;
    --ms-error:  #B83520;
    --ms-info:   #3F8FB8;
    --ms-warn:   #C58A1B;
  }

  .ms-sheet {
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 14mm 14mm 12mm;
    box-shadow: 0 10px 30px rgba(16,13,10,0.10), 0 2px 6px rgba(16,13,10,0.05);
    color: var(--ms-ink);
    font-family: 'Geist', system-ui, sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    position: relative;
    box-sizing: border-box;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .ms-band {
    position: absolute; top:0; left:0; right:0;
    height: 6mm;
    background: linear-gradient(90deg, var(--ms-ink) 0%, var(--ms-ink) 70%, var(--ms-orange) 70%, var(--ms-orange) 100%);
  }

  .ms-school {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 14px;
    align-items: center;
    padding: 6mm 0 4mm;
    border-bottom: 2px solid var(--ms-ink);
    margin-bottom: 4mm;
  }
  .ms-school__name {
    font-weight: 800;
    font-size: 22pt;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .ms-school__name .brand-dot { color: var(--ms-orange); }
  .ms-school__addr {
    font-size: 9pt;
    color: var(--ms-ink-60);
    margin-top: 2pt;
    letter-spacing: 0.01em;
  }
  .ms-school__rc { text-align: right; }
  .ms-school__rc-title {
    font-weight: 700;
    font-size: 13pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ms-ink);
  }
  .ms-school__rc-sub {
    font-size: 9pt;
    color: var(--ms-ink-60);
    margin-top: 2pt;
  }
  .ms-school__rc-dates {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 8pt;
    color: var(--ms-ink-40);
    margin-top: 1pt;
    letter-spacing: 0.04em;
  }

  .ms-profile {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    gap: 0;
    border: 1px solid var(--ms-ink-15);
    border-radius: 2mm;
    margin-bottom: 4mm;
    background: var(--ms-cream-soft);
  }
  .ms-cell {
    padding: 3mm 4mm;
    display: flex; flex-direction: column;
    border-right: 1px solid var(--ms-ink-15);
    border-bottom: 1px solid var(--ms-ink-15);
  }
  .ms-cell:nth-child(3n) { border-right: 0; }
  .ms-cell:nth-last-child(-n+3) { border-bottom: 0; }
  .ms-cell__lbl {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 7.5pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ms-ink-40);
    margin-bottom: 1mm;
  }
  .ms-cell__val {
    font-size: 11pt;
    font-weight: 600;
    color: var(--ms-ink);
  }
  .ms-cell__val.mono {
    font-family: 'Geist Mono', ui-monospace, monospace;
    letter-spacing: 0.04em;
  }

  .ms-block { margin-bottom: 4mm; }
  .ms-block__title {
    font-weight: 700;
    font-size: 10pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ms-ink);
    padding: 1mm 0 1.5mm;
    border-bottom: 1px solid var(--ms-ink);
    margin-bottom: 2mm;
  }

  .ms-tbl {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
  }
  .ms-tbl th, .ms-tbl td {
    padding: 1.6mm 2mm;
    border: 1px solid var(--ms-ink-15);
    text-align: center;
    vertical-align: middle;
  }
  .ms-tbl thead th {
    background: var(--ms-cream);
    color: var(--ms-ink);
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .ms-tbl__sub {
    text-align: left !important;
    font-weight: 600;
    width: 30%;
  }
  .ms-tbl__term  { background: var(--ms-cream) !important; }
  .ms-tbl__final { background: var(--ms-ink) !important; color: var(--ms-cream) !important; }
  .ms-tbl__w {
    display: block;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 7pt;
    font-weight: 400;
    color: var(--ms-ink-60);
    letter-spacing: 0.04em;
    margin-top: 1pt;
  }
  .ms-tbl__mm, .ms-tbl__ob, .ms-tbl__pct {
    font-family: 'Geist Mono', ui-monospace, monospace;
    width: 6%;
  }
  .ms-tbl__pct, .ms-tbl__gr, .ms-tbl__rs { background: rgba(245, 239, 227, 0.4); }
  .ms-tbl__gr { width: 6%; }
  .ms-tbl__rs { width: 8%; }
  .ms-tbl tbody tr.is-fail { background: rgba(184,53,32,0.05); }
  .ms-tbl .is-absent { color: var(--ms-error); font-weight: 700; }
  .ms-tbl .is-empty  { color: var(--ms-ink-40); }
  .ms-tbl tfoot td {
    background: var(--ms-cream-soft) !important;
    font-weight: 700;
    font-size: 9.5pt;
  }
  .ms-tbl tfoot .ms-tbl__sub { background: var(--ms-cream-soft) !important; }

  .ms-grade {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; padding: 1px 6px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 8pt;
    letter-spacing: 0.02em;
    color: #fff;
  }
  .ms-grade--lg { padding: 4px 14px; font-size: 11pt; }
  .ms-grade--a1, .ms-grade--a2 { background: var(--ms-success); }
  .ms-grade--b1, .ms-grade--b2 { background: var(--ms-info); }
  .ms-grade--c1, .ms-grade--c2 { background: var(--ms-warn); }
  .ms-grade--d                 { background: var(--ms-ink-60); }
  .ms-grade--e, .ms-grade--f   { background: var(--ms-error); }

  .ms-rs {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 8pt;
    letter-spacing: 0.04em;
  }
  .ms-rs--p { background: var(--ms-success); color: #fff; }
  .ms-rs--f { background: var(--ms-error);   color: #fff; }

  .ms-tbl--co .ms-tbl__sub { width: 40%; }
  .ms-tbl--co th, .ms-tbl--co td { padding: 1.4mm 2mm; }
  .ms-co__desc {
    display: block;
    font-size: 7.5pt;
    color: var(--ms-ink-40);
    font-weight: 400;
    margin-top: 1pt;
  }
  .ms-co-grade {
    display: inline-flex; align-items: center; justify-content: center;
    width: 22px; height: 22px;
    border-radius: 50%;
    font-weight: 700;
    font-size: 9pt;
    color: #fff;
  }
  .ms-co-grade--a { background: var(--ms-success); }
  .ms-co-grade--b { background: var(--ms-info); }
  .ms-co-grade--c { background: var(--ms-warn); }
  .ms-co-grade--none { background: transparent; color: var(--ms-ink-40); }

  .ms-result {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0;
    border-radius: 2mm;
    overflow: hidden;
    margin-bottom: 4mm;
    border: 1.5px solid var(--ms-ink);
  }
  .ms-result.ms-result--4col { grid-template-columns: repeat(4, 1fr); }
  .ms-result__cell {
    padding: 3mm 3mm;
    display: flex; flex-direction: column;
    gap: 1mm;
    background: var(--ms-cream-soft);
    border-right: 1px solid var(--ms-ink-15);
  }
  .ms-result__cell:last-child { border-right: 0; }
  .ms-result__lbl {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 7pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ms-ink-40);
  }
  .ms-result__val {
    font-size: 11pt;
    font-weight: 700;
    color: var(--ms-ink);
  }
  .ms-result__val--lg {
    font-size: 18pt;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.01em;
  }
  .ms-result__val.mono {
    font-family: 'Geist Mono', ui-monospace, monospace;
    letter-spacing: 0.02em;
  }
  .ms-result__verdict {
    font-weight: 800;
    font-size: 16pt;
    letter-spacing: 0.06em;
  }
  .ms-result.is-pass .ms-result__verdict { color: var(--ms-success); }
  .ms-result.is-fail .ms-result__verdict { color: var(--ms-error); }
  .ms-result.is-pass { border-color: var(--ms-success); }
  .ms-result.is-fail { border-color: var(--ms-error); }

  .ms-legend {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6mm;
    padding: 3mm 0;
    border-top: 1px solid var(--ms-ink-15);
    border-bottom: 1px solid var(--ms-ink-15);
    margin-bottom: 4mm;
  }
  .ms-legend__title {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 7.5pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ms-ink-40);
    margin-bottom: 1.5mm;
  }
  .ms-legend__grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.6mm 3mm;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 8pt;
    color: var(--ms-ink-60);
  }
  .ms-legend__grid--3 { grid-template-columns: repeat(3, 1fr); }
  .ms-legend__grid b { color: var(--ms-ink); font-weight: 700; margin-right: 2pt; }
  .ms-legend__note {
    margin-top: 2mm;
    font-size: 8pt;
    color: var(--ms-ink-60);
    line-height: 1.4;
  }
  .ms-legend__note b { color: var(--ms-ink); }

  .ms-sign {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8mm;
    margin-top: 12mm;
    margin-bottom: 4mm;
  }
  .ms-sign__col { text-align: center; }
  .ms-sign__line {
    display: block;
    border-top: 1.3px solid var(--ms-ink);
    margin-bottom: 1.5mm;
  }
  .ms-sign__lbl {
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 8pt;
    letter-spacing: 0.04em;
    color: var(--ms-ink-60);
  }

  .ms-stamp {
    text-align: center;
    font-family: 'Geist Mono', ui-monospace, monospace;
    font-size: 7.5pt;
    color: var(--ms-ink-40);
    letter-spacing: 0.06em;
    border-top: 1px dashed var(--ms-ink-15);
    padding-top: 2mm;
  }

  .mono { font-family: 'Geist Mono', ui-monospace, monospace; }

  /* ============================================================
     PRINT — A4 portrait, single page.
     ============================================================ */
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { background: #fff !important; }
    body { margin: 0; padding: 0; }
    .no-print { display: none !important; }
    .ms-sheet, .ms-sheet *, .ms-sheet *::before, .ms-sheet *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .ms-sheet {
      width: 210mm !important;
      min-height: 297mm !important;
      padding: 14mm 14mm 12mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      page-break-after: avoid;
    }
    .ms-tbl tr, .ms-result, .ms-sign, .ms-legend, .ms-block { page-break-inside: avoid; }
  }
`;
