import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useClasses } from "@/pages/classes/hooks";
import { useCoGrid, useExamTerms, useSaveCoGrade } from "./hooks";
import { getErrorMessage } from "@/lib/api";

type CoGrade = "A" | "B" | "C";

function padSr(n: number): string { return String(n).padStart(4, "0"); }

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamCoScholasticPage() {
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

  // Auto-pick first term once they load.
  useEffect(() => {
    if (!termId && terms && terms.length > 0) {
      update({ term: String(terms[0]!.id) });
    }
  }, [termId, terms, update]);

  const sectionOptions = useMemo(() => {
    if (!classSlug || !classes) return [] as string[];
    const c = classes.find((x) => x.slug === classSlug);
    return c?.sections.map((s) => s.code) ?? [];
  }, [classSlug, classes]);

  const picked = !!(termId && classSlug && section);
  const { data, isLoading: gridLoading } = useCoGrid(
    termId,
    classSlug,
    section,
  );
  const save = useSaveCoGrade();

  /* ----- Local drafts + toast ----- */
  // Local cache so the UI updates instantly when a teacher taps a pill.
  const [drafts, setDrafts] = useState<Record<string, CoGrade>>({});
  const [toast, setToast]   = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  // Clear drafts when context changes.
  const queryKey = `${termId}-${classSlug}-${section}`;
  useEffect(() => { setDrafts({}); }, [queryKey]);

  function showToast(kind: "ok" | "err", text: string) {
    setToast({ kind, text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  }

  function cellKey(sr: number, aid: number): string { return `${sr}-${aid}`; }
  function getGrade(sr: number, aid: number, fallback: CoGrade | null): CoGrade {
    return drafts[cellKey(sr, aid)] ?? (fallback ?? "A");
  }

  async function setGrade(sr: number, aid: number, g: CoGrade) {
    if (!termId) return;
    const prev = drafts[cellKey(sr, aid)];
    setDrafts((d) => ({ ...d, [cellKey(sr, aid)]: g }));
    try {
      await save.mutateAsync({ termId, srNumber: sr, areaId: aid, grade: g });
    } catch (e) {
      // Rollback on error.
      setDrafts((d) => {
        const next = { ...d };
        if (prev) next[cellKey(sr, aid)] = prev;
        else delete next[cellKey(sr, aid)];
        return next;
      });
      showToast("err", getErrorMessage(e, "Save failed"));
    }
  }

  const isFinalized = data?.term.isFinalized ?? false;

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="CO-SCHOLASTIC"
        title="Co-Scholastic Grades"
        lede={
          <>
            Grade Work Education, Art, Health &amp; PE, and Discipline on a 3-point scale (A / B / C).
            Cells auto-save on tap. Default is <b>A</b> unless a teacher marks otherwise.
          </>
        }
        actions={
          <Link to="/exams" className="btn btn--ghost btn--sm">
            <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
          </Link>
        }
      />

      {/* Pickers */}
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
            onChange={(e) => update({ class: e.target.value || null, section: null })}
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
      </form>

      {!picked ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6 }}>PICK TERM &amp; CLASS</div>
          <div className="muted body-s">Co-scholastic grades load once you pick a term, class &amp; section.</div>
        </div>
      ) : gridLoading || !data ? (
        <div className="card"><Skeleton.Table rows={6} cols={5} /></div>
      ) : data.students.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6 }}>NO STUDENTS</div>
          <div className="muted body-s">No active students in {classSlug}-{section}.</div>
        </div>
      ) : (
        <>
          {isFinalized && (
            <div className="banner banner--warn">
              <Icon name="alert" size={16} />
              <span>
                This term is finalized — co-scholastic grades are locked. Un-finalize under{" "}
                <Link to="/exams/terms">Terms</Link> to edit.
              </span>
            </div>
          )}

          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Student</th>
                  {data.areas.map((a) => (
                    <th key={a.id} style={{ textAlign: "center", minWidth: 140 }}>
                      {a.name}
                      {a.description && (
                        <div
                          className="muted body-s"
                          style={{
                            fontWeight: 400,
                            textTransform: "none",
                            letterSpacing: 0,
                            fontSize: 10.5,
                            marginTop: 2,
                          }}
                        >
                          {a.description}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.students.map((st, i) => (
                  <tr key={st.srNumber}>
                    <td className="mono">{i + 1}</td>
                    <td>
                      <Link
                        to={`/students/${st.srNumber}`}
                        style={{ textDecoration: "none", color: "inherit" }}
                      >
                        <b>{st.studentName}</b>
                        <div className="muted body-s">SR {padSr(st.srNumber)}</div>
                      </Link>
                    </td>
                    {data.areas.map((a) => {
                      const current = getGrade(st.srNumber, a.id, st.grades[a.id] ?? null);
                      return (
                        <td key={a.id} style={{ textAlign: "center" }}>
                          <div className="co-toggle" role="radiogroup" aria-label={a.name}>
                            {(["A", "B", "C"] as const).map((gv) => (
                              <button
                                key={gv}
                                type="button"
                                className={`co-pill co-pill--${gv.toLowerCase()} ${current === gv ? "is-selected" : ""}`}
                                onClick={() => current !== gv && setGrade(st.srNumber, a.id, gv)}
                                disabled={isFinalized}
                                aria-checked={current === gv}
                                role="radio"
                              >
                                {gv}
                              </button>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {toast && (
        <div className={`m-toast m-toast--${toast.kind}`} aria-live="polite">
          {toast.text}
        </div>
      )}

      <style>{CO_CSS}</style>
    </>
  );
}

const CO_CSS = `
  .co-toggle {
    display: inline-flex; background: var(--cream-soft);
    border: 1px solid var(--rule);
    border-radius: var(--r-pill);
    padding: 3px; gap: 2px;
  }
  .co-pill {
    appearance: none; background: transparent; border: 0;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 30px; height: 28px;
    border-radius: var(--r-pill);
    font-family: var(--font-display); font-weight: 700; font-size: 13px;
    color: var(--ink-60); cursor: pointer;
    transition: background var(--t-fast) var(--ease), color var(--t-fast) var(--ease);
  }
  .co-pill:hover    { color: var(--ink); }
  .co-pill:disabled { cursor: not-allowed; opacity: 0.6; }
  .co-pill.is-selected { color: var(--white); }
  .co-pill--a.is-selected { background: var(--success); }
  .co-pill--b.is-selected { background: var(--info); }
  .co-pill--c.is-selected { background: var(--warn); }
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
`;
