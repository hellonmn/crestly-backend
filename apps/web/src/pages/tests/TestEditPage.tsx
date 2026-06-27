import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { api, getErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Modal";
import { useTest, useSaveTest, useParseQuestions } from "./hooks";
import { useClasses } from "../classes/hooks";
import type { QuestionType, TestUpsert, TestQuestionUpsert } from "@crestly/shared";

/* ============================================================
   Create / edit a test — metadata + a question builder for
   MCQ and fill-in-the-blanks. Questions can't be edited once a
   test has attempts (the API enforces this too).
   ============================================================ */

interface QDraft {
  type: QuestionType;
  prompt: string;
  marks: number;
  options: string[];
  correct: number[];
  accepted: string[];
  caseSensitive: boolean;
}

function blankMcq(): QDraft {
  return { type: "mcq", prompt: "", marks: 1, options: ["", ""], correct: [], accepted: [], caseSensitive: false };
}
function blankFill(): QDraft {
  return { type: "fill_blank", prompt: "", marks: 1, options: [], correct: [], accepted: [""], caseSensitive: false };
}

/** Map a parsed/imported question into the editor's draft shape. */
function toDraft(q: TestQuestionUpsert): QDraft {
  return {
    type: q.type,
    prompt: q.prompt,
    marks: q.marks ?? 1,
    options: q.options?.map((o) => o.text) ?? ["", ""],
    correct: q.correctOptions ?? [],
    accepted: q.acceptedAnswers ?? [""],
    caseSensitive: q.caseSensitive ?? false,
  };
}

export function TestEditPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const { data: existing, isLoading } = useTest(id);
  const save = useSaveTest(id);

  const { data: subjects } = useQuery({
    queryKey: ["exam-subjects"],
    queryFn: async () => (await api.get<{ id: number; name: string }[]>("/exams/subjects")).data,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { data: classes } = useClasses();

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classSlug, setClassSlug] = useState("");
  const [sectionCode, setSectionCode] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [durationMin, setDurationMin] = useState<string>("");
  const [passMarks, setPassMarks] = useState<string>("");
  const [shuffle, setShuffle] = useState(false);
  const [questions, setQuestions] = useState<QDraft[]>([blankMcq()]);
  const [importOpen, setImportOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sectionsForClass = (classes ?? []).find((c) => c.slug === classSlug)?.sections ?? [];

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setInstructions(existing.instructions ?? "");
    setClassSlug(existing.classSlug);
    setSectionCode(existing.sectionCode ?? "");
    setSubjectId(existing.subjectId ? String(existing.subjectId) : "");
    setDurationMin(existing.durationMin ? String(existing.durationMin) : "");
    setPassMarks(existing.passMarks != null ? String(existing.passMarks) : "");
    setShuffle(existing.shuffle);
    setQuestions(existing.questions.map((q) => ({
      type: q.type,
      prompt: q.prompt,
      marks: q.marks,
      options: q.options?.map((o) => o.text) ?? ["", ""],
      correct: q.correctOptions ?? [],
      accepted: q.acceptedAnswers ?? [""],
      caseSensitive: q.caseSensitive,
    })));
  }, [existing]);

  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  function updateQ(i: number, patch: Partial<QDraft>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }
  function removeQ(i: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== i));
  }

  /** Append imported questions, replacing the initial blank if it's untouched. */
  function addImported(parsed: TestQuestionUpsert[]) {
    const drafts = parsed.map(toDraft);
    setQuestions((qs) => {
      const onlyBlank = qs.length === 1 && qs[0]!.prompt.trim() === "";
      return onlyBlank ? drafts : [...qs, ...drafts];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload: TestUpsert = {
      title: title.trim(),
      instructions: instructions.trim() || null,
      classSlug: classSlug.trim(),
      sectionCode: sectionCode.trim() || null,
      subjectId: subjectId ? Number(subjectId) : null,
      durationMin: durationMin ? Number(durationMin) : null,
      passMarks: passMarks ? Number(passMarks) : null,
      shuffle,
      questions: questions.map((q) => ({
        type: q.type,
        prompt: q.prompt.trim(),
        marks: Number(q.marks) || 1,
        caseSensitive: q.caseSensitive,
        ...(q.type === "mcq"
          ? { options: q.options.map((t) => ({ text: t.trim() })), correctOptions: q.correct }
          : { acceptedAnswers: q.accepted.map((a) => a.trim()).filter(Boolean) }),
      })),
    };
    try {
      await save.mutateAsync(payload);
      navigate("/tests");
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save test"));
    }
  }

  if (id !== undefined && isLoading) {
    return <div className="card" style={{ padding: 24 }}><Skeleton.Title width="30%" /></div>;
  }

  return (
    <>
      <PageHead
        group="ACADEMICS"
        meta={id ? "EDIT TEST" : "NEW TEST"}
        title={id ? "Edit test" : "Create test"}
        lede="MCQ questions auto-grade on exact option match (multi-correct supported). Fill-in-the-blanks accept any listed answer."
      />

      <form onSubmit={onSubmit} className="card" style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="form-grid form-grid--2">
          <div className="field span-2">
            <label className="field__label field__label--req">Title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required placeholder="Unit Test 1 — Fractions" />
          </div>
          <div className="field span-2">
            <label className="field__label">Instructions (optional)</label>
            <textarea className="input" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={2000} rows={2} />
          </div>
          <div className="field">
            <label className="field__label field__label--req">Class</label>
            <select
              className="select"
              value={classSlug}
              onChange={(e) => { setClassSlug(e.target.value); setSectionCode(""); }}
              required
            >
              <option value="">Select class</option>
              {(classes ?? []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Section</label>
            <select
              className="select"
              value={sectionCode}
              onChange={(e) => setSectionCode(e.target.value)}
              disabled={!classSlug}
            >
              <option value="">Whole class</option>
              {sectionsForClass.map((s) => <option key={s.id} value={s.code}>{s.code}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Subject (optional)</label>
            <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">—</option>
              {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Duration, min (optional)</label>
            <input className="input" type="number" min={1} max={600} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Total marks</label>
            <input className="input" value={`${totalMarks}`} readOnly disabled />
            <span className="field__hint">Auto — sum of question marks.</span>
          </div>
          <div className="field">
            <label className="field__label">Passing marks (optional)</label>
            <input
              className="input" type="number" min={0} max={totalMarks}
              value={passMarks} onChange={(e) => setPassMarks(e.target.value)}
              placeholder={`e.g. ${Math.ceil(totalMarks / 3)}`}
            />
            <span className="field__hint">Blank = no pass/fail line.</span>
          </div>
          <div className="field span-2">
            <label className="field__label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Shuffle question order for students
            </label>
          </div>
        </div>

        {existing && existing.status !== "draft" && (
          <div className="banner banner--info">
            <Icon name="info" size={14} /><span>This test is {existing.status}. Editing questions is blocked once students have attempted.</span>
          </div>
        )}

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Questions <span className="muted body-s">· {questions.length} · {totalMarks} marks</span></h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setImportOpen(true)}>
                <Icon name="import" size={13} /> Import
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuestions((q) => [...q, blankMcq()])}>+ MCQ</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setQuestions((q) => [...q, blankFill()])}>+ Fill-blank</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {questions.map((q, i) => (
              <QuestionEditor key={i} index={i} q={q} onChange={(p) => updateQ(i, p)} onRemove={() => removeQ(i)} canRemove={questions.length > 1} />
            ))}
          </div>
        </div>

        {err && (
          <div className="banner banner--error"><Icon name="alert" size={14} /><span>{err}</span></div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : id ? "Save changes" : "Create test"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/tests")}>Cancel</button>
        </div>
      </form>

      {importOpen && (
        <ImportQuestionsModal
          onClose={() => setImportOpen(false)}
          onImported={(qs) => { addImported(qs); setImportOpen(false); }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Import questions modal                                             */
/* ------------------------------------------------------------------ */

const IMPORT_SAMPLE = `What is 2 + 2? [1]
- 3
* 4
- 5

Capital of France is ___ [2]
= Paris
= paris`;

function ImportQuestionsModal({
  onClose, onImported,
}: {
  onClose: () => void;
  onImported: (qs: TestQuestionUpsert[]) => void;
}) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const parse = useParseQuestions();

  async function onParse() {
    setErrors([]); setCount(null);
    try {
      const res = await parse.mutateAsync({ text, format: "auto" });
      setCount(res.questions.length);
      setErrors(res.errors);
      if (res.questions.length > 0 && res.errors.length === 0) {
        onImported(res.questions);
      } else if (res.questions.length > 0) {
        // Keep modal open so the teacher can see which lines failed, but stash
        // the good ones on a confirm.
        if (confirm(`${res.questions.length} question(s) parsed, ${res.errors.length} skipped. Import the good ones?`)) {
          onImported(res.questions);
        }
      }
    } catch (e) {
      setErrors([getErrorMessage(e, "Couldn't parse the text")]);
    }
  }

  return (
    <Modal
      open
      title="Import questions"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={onParse} disabled={!text.trim() || parse.isPending}>
            {parse.isPending ? "Parsing…" : "Parse & add"}
          </button>
        </>
      }
    >
      <p className="muted body-s" style={{ marginTop: 0 }}>
        Paste questions copied from Google Docs / Word, or CSV. One question per block
        (blank line between). MCQ options start with <code>*</code> (correct) or <code>-</code>;
        fill-blank answers start with <code>=</code>; optional <code>[marks]</code> at the end of the prompt.
      </p>
      <textarea
        className="input mono"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={IMPORT_SAMPLE}
        style={{ width: "100%", fontSize: 12 }}
      />
      {count != null && (
        <div className={`banner ${errors.length ? "banner--info" : "banner--success"}`} style={{ marginTop: 10 }}>
          <span>{count} question(s) parsed{errors.length ? `, ${errors.length} skipped` : ""}.</span>
        </div>
      )}
      {errors.length > 0 && (
        <ul className="muted body-s" style={{ marginTop: 8 }}>
          {errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
    </Modal>
  );
}

function QuestionEditor({
  index, q, onChange, onRemove, canRemove,
}: {
  index: number;
  q: QDraft;
  onChange: (patch: Partial<QDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  function setOption(i: number, text: string) {
    onChange({ options: q.options.map((o, idx) => (idx === i ? text : o)) });
  }
  function toggleCorrect(i: number) {
    onChange({ correct: q.correct.includes(i) ? q.correct.filter((x) => x !== i) : [...q.correct, i] });
  }
  function setAccepted(i: number, text: string) {
    onChange({ accepted: q.accepted.map((a, idx) => (idx === i ? text : a)) });
  }

  return (
    <div className="card" style={{ padding: 14, background: "var(--cream-soft)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span className="chip chip--muted">Q{index + 1}</span>
        <select className="select" style={{ width: 150 }} value={q.type} onChange={(e) => onChange({ type: e.target.value as QuestionType })}>
          <option value="mcq">Multiple choice</option>
          <option value="fill_blank">Fill in the blank</option>
        </select>
        <div style={{ flex: 1 }} />
        <label className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Marks
          <input className="input" type="number" min={1} max={100} value={q.marks} onChange={(e) => onChange({ marks: Number(e.target.value) })} style={{ width: 64 }} />
        </label>
        {canRemove && (
          <button type="button" className="icon-btn" onClick={onRemove} title="Remove question"><Icon name="trash" size={14} /></button>
        )}
      </div>

      <div className="field" style={{ marginBottom: 10 }}>
        <textarea className="input" value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} rows={2} placeholder="Question text…" required />
      </div>

      {q.type === "mcq" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={q.correct.includes(i)} onChange={() => toggleCorrect(i)} title="Correct answer" />
              <input className="input" value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} style={{ flex: 1 }} />
              {q.options.length > 2 && (
                <button type="button" className="icon-btn" onClick={() => onChange({
                  options: q.options.filter((_, idx) => idx !== i),
                  correct: q.correct.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)),
                })} title="Remove option"><Icon name="trash" size={13} /></button>
              )}
            </div>
          ))}
          {q.options.length < 6 && (
            <button type="button" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange({ options: [...q.options, ""] })}>+ Option</button>
          )}
          <span className="field__hint">Tick the correct option(s).</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.accepted.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input className="input" value={a} onChange={(e) => setAccepted(i, e.target.value)} placeholder={`Accepted answer ${i + 1}`} style={{ flex: 1 }} />
              {q.accepted.length > 1 && (
                <button type="button" className="icon-btn" onClick={() => onChange({ accepted: q.accepted.filter((_, idx) => idx !== i) })} title="Remove"><Icon name="trash" size={13} /></button>
              )}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange({ accepted: [...q.accepted, ""] })}>+ Accepted answer</button>
            <label className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={q.caseSensitive} onChange={(e) => onChange({ caseSensitive: e.target.checked })} /> Case-sensitive
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
