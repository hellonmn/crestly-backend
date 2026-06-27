import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useActiveSr } from "./_layout/KidPills";
import { useParentHome, useParentTestDetail, useSubmitParentTest } from "./hooks";
import { getParentErrorMessage } from "@/lib/parent-api";
import type { TestSubmitResult } from "@crestly/shared";

/* ============================================================
   Attempt a test — render questions (MCQ checkboxes / fill-blank
   text), submit, then show the auto-graded result with the
   correct answers revealed.
   ============================================================ */

export function ParentTestAttemptPage() {
  const params = useParams();
  const id = Number(params.id);
  const navigate = useNavigate();
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data: test, isLoading, error } = useParentTestDetail(id, sr);
  const submit = useSubmitParentTest(id);

  // answers: questionId → { selected:number[] } | { text:string }
  const [mcq, setMcq] = useState<Record<number, number[]>>({});
  const [fill, setFill] = useState<Record<number, string>>({});
  const [result, setResult] = useState<TestSubmitResult | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  function toggleOpt(qid: number, idx: number) {
    setMcq((m) => {
      const cur = m[qid] ?? [];
      return { ...m, [qid]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] };
    });
  }

  async function onSubmit() {
    if (!test) return;
    setSubmitErr(null);
    const answers = test.questions.map((q) =>
      q.type === "mcq"
        ? { questionId: q.id, selectedOptions: mcq[q.id] ?? [] }
        : { questionId: q.id, responseText: fill[q.id] ?? "" },
    );
    try {
      setResult(await submit.mutateAsync({ sr, answers }));
    } catch (e) {
      setSubmitErr(getParentErrorMessage(e, "Could not submit. Try again."));
    }
  }

  if (isLoading) return <div className="pta"><div className="muted">Loading…</div></div>;
  if (error || !test) {
    return (
      <div className="pta">
        <div className="muted">This test isn't available.</div>
        <button className="btn btn--ghost btn--sm" style={{ marginTop: 12 }} onClick={() => navigate(`/parent/tests?sr=${sr}`)}>Back to tests</button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="pta">
        <div className="pta__score-card">
          <div className="muted body-s">YOUR SCORE</div>
          <div className="pta__big">{result.score}<span className="muted">/{result.maxScore}</span></div>
          <div className="pta__pct">{result.percent}%</div>
          {result.passed != null && (
            <div className={`pta__pf ${result.passed ? "is-pass" : "is-fail"}`}>
              {result.passed ? "PASSED" : "FAILED"}{result.passMarks != null ? ` · pass mark ${result.passMarks}` : ""}
            </div>
          )}
        </div>
        {result.answers.map((a, i) => (
          <div key={a.questionId} className={`pta__q ${a.isCorrect ? "is-right" : "is-wrong"}`}>
            <div className="pta__qhead">
              <span className="pta__qn">Q{i + 1}</span>
              <span className={`pta__verdict ${a.isCorrect ? "ok" : "no"}`}>{a.isCorrect ? "Correct" : "Wrong"} · {a.awardedMarks}/{a.marks}</span>
            </div>
            <div className="pta__prompt">{a.prompt}</div>
            {a.type === "fill_blank" ? (
              <div className="muted body-s">
                You wrote: <b>{a.responseText || "—"}</b>
                {!a.isCorrect && a.acceptedAnswers && <> · Accepted: {a.acceptedAnswers.join(", ")}</>}
              </div>
            ) : (
              <div className="muted body-s">Correct option(s): {(a.correctOptions ?? []).map((n) => n + 1).join(", ")}</div>
            )}
          </div>
        ))}
        <button className="btn btn--primary" style={{ width: "100%", marginTop: 14 }} onClick={() => navigate(`/parent/tests?sr=${sr}`)}>Done</button>
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div className="pta">
      <h1 className="pta__title">{test.title}</h1>
      {test.instructions && <p className="muted body-s">{test.instructions}</p>}
      <div className="muted body-s" style={{ marginBottom: 14 }}>
        {test.questions.length} questions · {test.totalMarks} marks{test.durationMin ? ` · ${test.durationMin} min` : ""}
      </div>

      {test.questions.map((q, i) => (
        <div key={q.id} className="pta__q">
          <div className="pta__qhead"><span className="pta__qn">Q{i + 1}</span><span className="muted body-s">{q.marks} mark{q.marks === 1 ? "" : "s"}</span></div>
          <div className="pta__prompt">{q.prompt}</div>
          {q.type === "mcq" ? (
            <div className="pta__opts">
              {(q.options ?? []).map((o, idx) => (
                <label key={idx} className={`pta__opt ${(mcq[q.id] ?? []).includes(idx) ? "is-sel" : ""}`}>
                  <input type="checkbox" checked={(mcq[q.id] ?? []).includes(idx)} onChange={() => toggleOpt(q.id, idx)} />
                  <span>{o.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <input className="input" value={fill[q.id] ?? ""} onChange={(e) => setFill((f) => ({ ...f, [q.id]: e.target.value }))} placeholder="Your answer…" />
          )}
        </div>
      ))}

      {submitErr && <div className="banner banner--error" style={{ marginTop: 12 }}>{submitErr}</div>}

      <button className="btn btn--primary" style={{ width: "100%", marginTop: 16 }} onClick={onSubmit} disabled={submit.isPending}>
        {submit.isPending ? "Submitting…" : "Submit test"}
      </button>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
  .pta { max-width: 720px; margin: 0 auto; padding: 22px 18px 40px; }
  .pta__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 20px; margin: 0 0 6px; }
  .pta__q { background: var(--white); border: 1px solid var(--rule); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
  .pta__q.is-right { border-color: rgba(22,101,52,.4); }
  .pta__q.is-wrong { border-color: rgba(220,38,38,.4); }
  .pta__qhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .pta__qn { font-family: var(--font-mono, monospace); font-weight: 800; font-size: 12px; color: var(--ink-60); }
  .pta__prompt { font-weight: 600; font-size: 14px; margin-bottom: 10px; }
  .pta__opts { display: flex; flex-direction: column; gap: 6px; }
  .pta__opt { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 10px; cursor: pointer; }
  .pta__opt.is-sel { border-color: var(--orange); background: var(--tint-wheat, #fcebd6); }
  .pta__verdict { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .pta__verdict.ok { background: #dcfce7; color: #166534; }
  .pta__verdict.no { background: rgba(220,38,38,.12); color: #dc2626; }
  .pta__score-card { background: var(--ink); color: var(--cream); border-radius: 16px; padding: 22px; text-align: center; margin-bottom: 16px; }
  .pta__big { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 40px; line-height: 1; margin: 6px 0; }
  .pta__big .muted { color: rgba(248,240,226,.5); font-size: 22px; }
  .pta__pct { font-family: var(--font-mono, monospace); color: var(--orange); font-weight: 700; }
  .pta__pf { display: inline-block; margin-top: 10px; font-size: 12px; font-weight: 800; letter-spacing: .04em; padding: 4px 12px; border-radius: 999px; }
  .pta__pf.is-pass { background: #dcfce7; color: #166534; }
  .pta__pf.is-fail { background: rgba(220,38,38,.18); color: #fecaca; }
`;
