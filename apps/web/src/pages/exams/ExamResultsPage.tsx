import { useCallback, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useClasses } from "@/pages/classes/hooks";
import { useExamTerms, useResults } from "./hooks";

/* ------------------------------------------------------------------ */
/* Helpers — grade ladder mirrors PHP exam_grade_pill_class()         */
/* ------------------------------------------------------------------ */

function gradePillClass(g: string): string {
  if (g === "A1" || g === "A2") return "pill--success";
  if (g === "B1" || g === "B2") return "pill--info";
  if (g === "C1" || g === "C2") return "pill--wheat";
  if (g === "D")                return "pill--warn";
  if (g === "E")                return "pill--error";
  return "pill--neutral";
}

function padSr(n: number): string { return String(n).padStart(4, "0"); }

const GRADE_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamResultsPage() {
  const [params, setParams] = useSearchParams();
  const termId    = Number(params.get("term") ?? "") || undefined;
  const classSlug = params.get("class") ?? "";
  const section   = params.get("section") ?? "";

  const { data: terms,   isLoading: termsLoading }   = useExamTerms();
  const { data: classes, isLoading: classesLoading } = useClasses();

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  // Auto-pick first class + section when none chosen.
  useEffect(() => {
    if (classSlug || !classes || classes.length === 0) return;
    const first = classes[0]!;
    const firstSection = first.sections[0]?.code;
    update({
      class: first.slug,
      ...(firstSection ? { section: firstSection } : {}),
    });
  }, [classSlug, classes, update]);

  // Section options for the chosen class.
  const sectionOptions = useMemo(() => {
    if (!classSlug || !classes) return [] as string[];
    const c = classes.find((x) => x.slug === classSlug);
    return c?.sections.map((s) => s.code) ?? [];
  }, [classSlug, classes]);

  // Auto-pick first section when section is empty but class has sections.
  useEffect(() => {
    if (section || !classSlug || sectionOptions.length === 0) return;
    update({ section: sectionOptions[0] ?? null });
  }, [section, classSlug, sectionOptions, update]);

  const query = classSlug && section
    ? { termId: termId ?? undefined, class: classSlug, section }
    : null;

  const { data, isLoading: resultsLoading, error: resultsError, refetch: resultsRefetch, isFetching: resultsFetching } = useResults(query);

  const currentTerm = terms?.find((t) => t.id === termId);

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="RESULTS"
        title="Class Results"
        lede={
          currentTerm
            ? <>
                Rank list for <b>{currentTerm.name}</b> ({currentTerm.shortCode}). Click any name to
                open that test's printable marksheet.
              </>
            : "Rank list and final aggregate across all terms. Click any name to open the printable Report Card."
        }
        actions={
          <Link to="/exams" className="btn btn--ghost btn--sm">
            <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </Link>
        }
      />

      <QueryError error={resultsError} refetch={resultsRefetch} isFetching={resultsFetching} label="results" />

      {/* Pickers */}
      <form
        className="toolbar card"
        style={{
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Marksheet view</label>
          <select
            className="select"
            value={termId ?? ""}
            onChange={(e) => update({ term: e.target.value || null })}
            disabled={termsLoading}
          >
            <option value="">Full session · Report Card</option>
            {terms?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode} — {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Class</label>
          <select
            className="select"
            value={classSlug}
            onChange={(e) => update({ class: e.target.value || null, section: null })}
            disabled={classesLoading}
          >
            {classes?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Section</label>
          <select
            className="select"
            value={section}
            onChange={(e) => update({ section: e.target.value || null })}
            disabled={!classSlug}
          >
            {sectionOptions.length === 0 && <option value="">No sections</option>}
            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </form>

      {!query ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6 }}>PICK A SECTION</div>
          <div className="muted body-s">Choose Class &amp; Section to load the rank list.</div>
        </div>
      ) : resultsLoading ? (
        <>
          <Skeleton.StatRow count={4} />
          <div className="card"><Skeleton.Table rows={6} cols={6} /></div>
        </>
      ) : !data || data.rows.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6 }}>NO DATA</div>
          <div className="muted body-s">
            No marks recorded yet for {classSlug}-{section}
            {currentTerm && <> in {currentTerm.shortCode}</>}.
            {" "}<Link to="/exams/marks">Enter marks</Link> first.
          </div>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid--cols-4 grid--gap-sm">
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-mint"><Icon name="check" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Passed</div>
                <div className="stat-tile__value">{data.passed}</div>
                <div className="stat-tile__delta">
                  {data.rows.length > 0 ? Math.round((data.passed / data.rows.length) * 1000) / 10 : 0}% of class
                </div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-rose"><Icon name="x" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Failed</div>
                <div className="stat-tile__value">{data.failed}</div>
                <div className="stat-tile__delta">
                  {data.rows.length > 0 ? Math.round((data.failed / data.rows.length) * 1000) / 10 : 0}% of class
                </div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-mustard">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /></svg>
              </div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Class average</div>
                <div className="stat-tile__value">{Number(data.classAverage).toFixed(1)}%</div>
                <div className="stat-tile__delta">
                  {data.classAverage > 0 ? `Grade ladder ≈ ${avgGrade(data.classAverage)}` : "—"}
                </div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-sky">
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={8} r={6} /><path d="M9 14l-2 8 5-3 5 3-2-8" /></svg>
              </div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">Topper</div>
                <div className="stat-tile__value" style={{ fontSize: 18, lineHeight: 1.1 }}>
                  {data.topper?.studentName ?? "—"}
                </div>
                <div className="stat-tile__delta">
                  {data.topper
                    ? `${Number(data.topper.percentage).toFixed(1)}%`
                    : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Grade distribution */}
          {Object.keys(data.gradeDistribution).length > 0 && (
            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="label" style={{ marginBottom: 8 }}>GRADE DISTRIBUTION</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {GRADE_ORDER.map((g) => {
                  const n = data.gradeDistribution[g] ?? 0;
                  if (!n) return null;
                  return (
                    <span
                      key={g}
                      className={`pill ${gradePillClass(g)}`}
                      style={{ padding: "4px 10px", fontSize: 12 }}
                    >
                      <b>{g}</b> · {n}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rank list */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Rank</th>
                  <th>Student</th>
                  <th style={{ textAlign: "right" }}>Marks</th>
                  <th style={{ textAlign: "center" }}>Percent</th>
                  <th style={{ textAlign: "center" }}>Grade</th>
                  <th style={{ textAlign: "center" }}>Result</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const isFail = r.passFail === "FAIL";
                  return (
                    <tr key={r.srNumber} className={isFail ? "is-fail-row" : ""}>
                      <td>
                        <span className={`rank-pill ${rankExtraClass(r.rank)}`}>#{r.rank}</span>
                      </td>
                      <td>
                        <Link
                          to={`/print/marksheet/${r.srNumber}${termId ? `?term=${termId}` : ""}`}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          <b>{r.studentName}</b>
                          <div className="muted body-s">SR {padSr(r.srNumber)}</div>
                        </Link>
                      </td>
                      <td className="mono" style={{ textAlign: "right" }}>
                        {trimZero(r.totalObtained)} / {r.totalMax}
                      </td>
                      <td className="mono" style={{ textAlign: "center" }}>
                        {Number(r.percentage).toFixed(1)}%
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`pill ${gradePillClass(r.grade)}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                          {r.grade}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span
                          className={`pill ${r.passFail === "PASS" ? "pill--success" : "pill--error"}`}
                          style={{ fontSize: 11, padding: "2px 8px" }}
                        >
                          {r.passFail}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          to={`/print/marksheet/${r.srNumber}${termId ? `?term=${termId}` : ""}`}
                          className="btn btn--ghost btn--sm"
                        >
                          Marksheet
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <style>{RESULTS_CSS}</style>
    </>
  );
}

function trimZero(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}
function rankExtraClass(rank: number): string {
  if (rank === 1) return "rank-pill--gold";
  if (rank === 2) return "rank-pill--silver";
  if (rank === 3) return "rank-pill--bronze";
  return "";
}
function avgGrade(pct: number): string {
  if (pct >= 91) return "A1";
  if (pct >= 81) return "A2";
  if (pct >= 71) return "B1";
  if (pct >= 61) return "B2";
  if (pct >= 51) return "C1";
  if (pct >= 41) return "C2";
  if (pct >= 33) return "D";
  return "E";
}

const RESULTS_CSS = `
  .data-table tbody tr.is-fail-row td { background: rgba(184,53,32,0.04); }
  .rank-pill {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 42px; padding: 4px 10px; border-radius: var(--r-pill);
    background: var(--cream); color: var(--ink-60);
    font-family: var(--font-display); font-weight: 700; font-size: 12px;
  }
  .rank-pill--gold   { background: #FFD166; color: var(--ink); }
  .rank-pill--silver { background: #E5E7EB; color: var(--ink); }
  .rank-pill--bronze { background: #F5B58A; color: var(--ink); }
`;
