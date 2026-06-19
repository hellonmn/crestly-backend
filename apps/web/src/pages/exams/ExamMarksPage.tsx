import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useClasses } from "@/pages/classes/hooks";
import { useExamSubjects, useExamTerms, useMarks, useSaveMark } from "./hooks";
import { getErrorMessage } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* Helpers — grade ladder mirrors erp/lib/exams.php :: exam_grade_*    */
/* ------------------------------------------------------------------ */

function gradeFromPercent(p: number): { letter: string; pillClass: string } {
  if (p >= 91) return { letter: "A1", pillClass: "pill--success" };
  if (p >= 81) return { letter: "A2", pillClass: "pill--success" };
  if (p >= 71) return { letter: "B1", pillClass: "pill--info" };
  if (p >= 61) return { letter: "B2", pillClass: "pill--info" };
  if (p >= 51) return { letter: "C1", pillClass: "pill--wheat" };
  if (p >= 41) return { letter: "C2", pillClass: "pill--wheat" };
  if (p >= 33) return { letter: "D",  pillClass: "pill--warn" };
  return { letter: "E", pillClass: "pill--error" };
}

function padSr(n: number): string { return String(n).padStart(4, "0"); }

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamMarksPage() {
  const [params, setParams] = useSearchParams();
  const termId    = Number(params.get("term") ?? "") || undefined;
  const classSlug = params.get("class") ?? "";
  const section   = params.get("section") ?? "";
  const subjectId = Number(params.get("subject") ?? "") || undefined;

  const { data: terms,    isLoading: termsLoading }    = useExamTerms();
  const { data: subjects, isLoading: subjectsLoading } = useExamSubjects();
  const { data: classes,  isLoading: classesLoading }  = useClasses();

  // Auto-select first term once loaded if URL has none.
  useEffect(() => {
    if (!termId && terms && terms.length > 0) {
      setParams((p) => { p.set("term", String(terms[0]!.id)); return p; }, { replace: true });
    }
  }, [terms, termId, setParams]);

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

  // Section list for the class — derived from useClasses.
  const sectionOptions = useMemo(() => {
    if (!classSlug || !classes) return [] as string[];
    const c = classes.find((x) => x.slug === classSlug);
    return c?.sections.map((s) => s.code) ?? [];
  }, [classSlug, classes]);

  // Subjects assigned to the picked class.
  const classSubjects = useMemo(() => {
    if (!classSlug || !subjects) return [];
    return subjects.filter((s) => s.classes.includes(classSlug));
  }, [classSlug, subjects]);

  const picked = !!(termId && classSlug && section && subjectId);

  const query = picked
    ? { termId: termId!, subjectId: subjectId!, class: classSlug, section }
    : null;
  const { data, isLoading: marksLoading, error: marksError, refetch: marksRefetch, isFetching: marksFetching } = useMarks(query);
  const save = useSaveMark();

  const isFinalized = data?.isFinalized ?? false;
  const maxMarks    = data?.maxMarks ?? 100;
  const passMarks   = data?.passMarks ?? 33;

  /* ----- Drafts + auto-save ----- */
  // Local drafts so the inputs are responsive, then debounce-save 600ms after
  // the user stops typing. Each cell tracks an in-flight Promise so concurrent
  // requests for the same row queue up instead of racing.
  const [drafts, setDrafts] = useState<Record<number, { marks: string; absent: boolean }>>({});
  const [savingSr, setSavingSr] = useState<Set<number>>(new Set());
  const [errorSr, setErrorSr]   = useState<Map<number, string>>(new Map());
  const [toast, setToast]       = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Clear drafts when the picked context changes — otherwise stale drafts
  // would shadow the freshly-loaded server values.
  const queryKey = `${termId}-${subjectId}-${classSlug}-${section}`;
  useEffect(() => { setDrafts({}); }, [queryKey]);

  const toastTimer = useRef<number | null>(null);
  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }

  function getCell(srNumber: number, fallback: { marks: number | null; absent: boolean }) {
    if (drafts[srNumber]) return drafts[srNumber]!;
    return {
      marks: fallback.marks != null ? String(fallback.marks) : "",
      absent: fallback.absent,
    };
  }
  function setCell(srNumber: number, patch: Partial<{ marks: string; absent: boolean }>) {
    setDrafts((prev) => ({
      ...prev,
      [srNumber]: { ...(prev[srNumber] ?? { marks: "", absent: false }), ...patch },
    }));
  }

  async function persistRow(srNumber: number) {
    if (!query) return;
    const d = drafts[srNumber];
    if (!d) return;
    setErrorSr((m) => { const n = new Map(m); n.delete(srNumber); return n; });
    setSavingSr((s) => new Set(s).add(srNumber));
    try {
      const raw = d.marks.trim();
      const marks = d.absent || raw === "" ? null : Number(raw);
      if (marks != null) {
        if (Number.isNaN(marks)) throw new Error("Marks must be a number");
        if (marks < 0)           throw new Error("Marks cannot be negative");
        if (marks > maxMarks)    throw new Error(`Marks exceed max (${maxMarks})`);
      }
      await save.mutateAsync({
        termId: query.termId,
        subjectId: query.subjectId,
        srNumber,
        marksObtained: marks,
        isAbsent: d.absent,
      });
      showToast("ok", "Saved");
    } catch (e) {
      const msg = getErrorMessage(e, "Save failed");
      setErrorSr((m) => new Map(m).set(srNumber, msg));
      showToast("err", msg);
    } finally {
      setSavingSr((s) => { const n = new Set(s); n.delete(srNumber); return n; });
    }
  }

  // Debounced persist — re-runs whenever drafts change.
  const draftTimers = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    if (!query) return;
    for (const [k, d] of Object.entries(drafts)) {
      const sr = Number(k);
      // Skip if the draft matches the server value (no-op).
      const serverRow = data?.rows.find((r) => r.srNumber === sr);
      if (serverRow) {
        const serverMarks = serverRow.marksObtained != null ? String(serverRow.marksObtained) : "";
        if (d.marks === serverMarks && d.absent === serverRow.isAbsent) continue;
      }
      const existing = draftTimers.current.get(sr);
      if (existing) window.clearTimeout(existing);
      draftTimers.current.set(sr, window.setTimeout(() => {
        draftTimers.current.delete(sr);
        persistRow(sr);
      }, 600));
    }
    return () => {
      // Don't clear on every re-render — only when the picker changes.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  // Cancel pending saves when picker changes.
  useEffect(() => {
    return () => {
      for (const t of draftTimers.current.values()) window.clearTimeout(t);
      draftTimers.current.clear();
    };
  }, [queryKey]);

  /* ----- Aggregates / progress ----- */
  const rows = data?.rows ?? [];
  const totalRows = rows.length;
  const enteredRows = rows.filter((r) => r.isAbsent || r.marksObtained != null).length;
  const pct = totalRows > 0 ? Math.round((enteredRows / totalRows) * 100) : 0;

  /* ----- Bulk actions ----- */
  async function bulkSet(value: number | "absent") {
    if (!query || isFinalized) return;
    if (!confirm(value === "absent"
      ? `Mark every student in ${classSlug}-${section} as ABSENT for this paper?`
      : `Set ${value} marks for every student in ${classSlug}-${section} for this paper?`)) return;
    // Set all drafts then fire the persist loop.
    const patch: typeof drafts = {};
    for (const r of rows) {
      patch[r.srNumber] = value === "absent"
        ? { marks: "", absent: true }
        : { marks: String(value), absent: false };
    }
    setDrafts(patch);
  }

  const selectedTerm    = terms?.find((t) => t.id === termId);
  const selectedSubject = subjects?.find((s) => s.id === subjectId);

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="MARKS"
        title="Enter Marks"
        lede={
          picked && selectedTerm && selectedSubject
            ? <>
                <b>{selectedTerm.shortCode}</b> · Class {classSlug}-{section} · <b>{selectedSubject.name}</b>
                {" "}Max {maxMarks} · Pass {passMarks} · cells auto-save.
              </>
            : "Pick the term, class, section & subject — the roster loads and every cell auto-saves."
        }
        actions={
          <Link to="/exams" className="btn btn--ghost btn--sm">
            <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </Link>
        }
      />

      <QueryError error={marksError} refetch={marksRefetch} isFetching={marksFetching} label="marks" />

      {/* ===== Picker ===== */}
      <form
        className="toolbar card"
        style={{
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Term</label>
          <select
            className="select"
            value={termId ?? ""}
            onChange={(e) => update({ term: e.target.value || null })}
            disabled={termsLoading}
          >
            {(terms?.length ?? 0) === 0 && <option value="">No terms</option>}
            {terms?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode} — {t.name}{t.isFinalized ? " 🔒" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Class</label>
          <select
            className="select"
            value={classSlug}
            onChange={(e) => update({ class: e.target.value || null, section: null, subject: null })}
            disabled={classesLoading}
          >
            <option value="">— pick —</option>
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
            <option value="">— pick —</option>
            {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="field__label" style={{ display: "block", marginBottom: 4 }}>Subject</label>
          <select
            className="select"
            value={subjectId ?? ""}
            onChange={(e) => update({ subject: e.target.value || null })}
            disabled={!classSlug || subjectsLoading}
          >
            <option value="">— pick —</option>
            {classSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {classSlug && !subjectsLoading && classSubjects.length === 0 && (
            <span className="field__hint" style={{ color: "var(--warn)" }}>
              No subjects assigned to {classSlug}. Add some under <Link to="/exams/subjects">Subjects</Link>.
            </span>
          )}
        </div>
      </form>

      {!picked ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6 }}>PICK ALL FOUR</div>
          <div className="muted body-s">Choose Term, Class, Section &amp; Subject to load the roster.</div>
        </div>
      ) : marksLoading ? (
        <div className="card"><Skeleton.Table rows={6} cols={6} /></div>
      ) : (
        <>
          {/* Progress + bulk actions */}
          <div
            className="card"
            style={{
              padding: "12px 16px",
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              gap: 14, alignItems: "center",
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, lineHeight: 1 }}>
              {pct}%
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>
                Subject-wide entry progress · {selectedTerm?.shortCode}
              </div>
              <div className="muted body-s">
                {enteredRows.toLocaleString("en-IN")} / {totalRows.toLocaleString("en-IN")} cells filled
                {" · "}{selectedSubject?.name}
              </div>
            </div>
            {isFinalized ? (
              <span className="pill pill--success">FINALIZED</span>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => bulkSet(maxMarks)}>
                  All max
                </button>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => bulkSet("absent")}>
                  All absent
                </button>
              </div>
            )}
          </div>

          {isFinalized && (
            <div className="banner banner--warn">
              <Icon name="alert" size={16} />
              <span>This term is finalized — marks are locked. Un-finalize under <Link to="/exams/terms">Terms</Link> to edit.</span>
            </div>
          )}

          {/* Marks grid */}
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Student</th>
                  <th style={{ width: 130 }}>Marks / {maxMarks}</th>
                  <th style={{ width: 80, textAlign: "center" }}>Absent</th>
                  <th style={{ width: 70, textAlign: "center" }}>Grade</th>
                  <th style={{ width: 80, textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px 24px", textAlign: "center" }}>
                      <div className="label" style={{ marginBottom: 8 }}>NO STUDENTS</div>
                      <div className="muted body-s">No active students in {classSlug}-{section}.</div>
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => {
                    const cell = getCell(r.srNumber, { marks: r.marksObtained, absent: r.isAbsent });
                    const marksNum = cell.marks.trim() === "" ? null : Number(cell.marks);
                    const hasValue = cell.absent || (marksNum != null && !Number.isNaN(marksNum));
                    const isFail   = !cell.absent && marksNum != null && marksNum < passMarks;
                    const pctRow   = !cell.absent && marksNum != null
                      ? (marksNum / maxMarks) * 100
                      : null;
                    const grade    = pctRow != null ? gradeFromPercent(pctRow) : null;
                    const saving   = savingSr.has(r.srNumber);
                    const rowErr   = errorSr.get(r.srNumber);

                    return (
                      <tr
                        key={r.srNumber}
                        className={[
                          hasValue && !cell.absent && !isFail ? "is-marked" : "",
                          cell.absent ? "is-absent" : "",
                          isFail ? "is-fail" : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <td className="mono">{i + 1}</td>
                        <td>
                          <Link
                            to={`/students/${r.srNumber}`}
                            style={{ textDecoration: "none", color: "inherit" }}
                          >
                            <b>{r.studentName}</b>
                            <div className="muted body-s">SR {padSr(r.srNumber)}</div>
                          </Link>
                        </td>
                        <td>
                          <input
                            className={`input input--sm marks-cell ${saving ? "is-saving" : ""} ${rowErr ? "is-error" : ""}`}
                            type="number"
                            step="0.5"
                            min={0}
                            max={maxMarks}
                            value={cell.marks}
                            disabled={cell.absent || isFinalized}
                            onChange={(e) => setCell(r.srNumber, { marks: e.target.value })}
                            onBlur={() => persistRow(r.srNumber)}
                            placeholder="—"
                            title={rowErr ?? undefined}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={cell.absent}
                            disabled={isFinalized}
                            onChange={(e) => setCell(r.srNumber, { absent: e.target.checked })}
                            style={{ accentColor: "var(--error)" }}
                          />
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {grade ? (
                            <span className={`pill ${grade.pillClass}`}>{grade.letter}</span>
                          ) : (
                            <span className="pill pill--neutral">—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {cell.absent && <span className="pill pill--error" style={{ fontSize: 10 }}>AB</span>}
                          {!cell.absent && isFail && <span className="pill pill--error" style={{ fontSize: 10 }}>FAIL</span>}
                          {!cell.absent && !isFail && hasValue && <span className="pill pill--success" style={{ fontSize: 10 }}>✓</span>}
                          {!hasValue && <span className="muted" style={{ fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`m-toast m-toast--${toast.kind}`} aria-live="polite">
          {toast.text}
        </div>
      )}

      <style>{MARKS_CSS}</style>
    </>
  );
}

const MARKS_CSS = `
  .data-table tbody tr.is-marked  { background: var(--white); }
  .data-table tbody tr.is-fail    { background: rgba(184,53,32,0.05); }
  .data-table tbody tr.is-absent  { background: rgba(184,53,32,0.08); opacity: 0.85; }
  .marks-cell { width: 100%; max-width: 110px; text-align: right; font-family: var(--font-mono); }
  .marks-cell.is-saving { background: var(--cream-soft); }
  .marks-cell.is-error  { border-color: var(--error); background: rgba(184,53,32,0.08); }
  .m-toast {
    position: fixed; right: 18px;
    bottom: calc(78px + env(safe-area-inset-bottom));
    background: var(--ink); color: var(--cream);
    padding: 10px 14px; border-radius: var(--r-3);
    font-size: 13px;
    box-shadow: var(--shadow-3);
    z-index: 50;
    animation: m-toast-in var(--t-fast) var(--ease) both;
  }
  .m-toast--err { background: var(--error); color: var(--cream); }
  @keyframes m-toast-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .field__hint { color: var(--ink-60); font-size: 11.5px; line-height: 1.4; }
`;
