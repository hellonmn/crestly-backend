import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useClasses } from "@/pages/classes/hooks";
import {
  useDatesheet, useDeleteDatesheet, useExamSubjects, useExamTerms,
  useSaveDatesheet,
} from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { ExamDatesheetRow } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d).replace(/,/g, "");
}
function fmtTime(t: string | null): string {
  if (!t) return "—";
  const [hh, mm] = t.split(":");
  if (!hh || !mm) return t;
  const h = Number(hh);
  const suf = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${suf}`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamDatesheetPage() {
  const { data: terms,    isLoading: termsLoading }    = useExamTerms();
  const { data: subjects, isLoading: subjectsLoading } = useExamSubjects();
  const { data: classes,  isLoading: classesLoading }  = useClasses();

  const [termId, setTermId]       = useState<number | "">("");
  const [classSlug, setClassSlug] = useState<string>("");
  const [editing, setEditing]     = useState<ExamDatesheetRow | "new" | null>(null);
  const [flash, setFlash]         = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);

  // Auto-select the first term once they load.
  useEffect(() => {
    if (!termId && terms && terms.length > 0) {
      setTermId(terms[0]!.id);
    }
  }, [terms, termId]);

  const { data: rows, isLoading: rowsLoading, error: rowsError, refetch: rowsRefetch, isFetching: rowsFetching } = useDatesheet(
    typeof termId === "number" ? termId : undefined,
    classSlug || undefined,
  );

  const remove = useDeleteDatesheet();
  const selectedTerm = terms?.find((t) => t.id === termId);

  // Group by class for display (when no class filter active).
  const byClass = useMemo(() => {
    const m = new Map<string, ExamDatesheetRow[]>();
    for (const r of rows ?? []) {
      const list = m.get(r.classSlug) ?? [];
      list.push(r);
      m.set(r.classSlug, list);
    }
    // Sort each class's papers by exam date asc.
    for (const list of m.values()) {
      list.sort((a, b) => a.examDate.localeCompare(b.examDate));
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  async function onDelete(r: ExamDatesheetRow) {
    const sub = subjects?.find((s) => s.id === r.subjectId);
    if (!confirm(`Delete ${r.classSlug} · ${sub?.name ?? r.subjectName} on ${fmtDay(r.examDate)}?`)) return;
    setErr(null);
    try {
      await remove.mutateAsync(r.id);
      setFlash("Paper removed.");
    } catch (e) {
      setErr(getErrorMessage(e, "Delete failed"));
    }
  }

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="DATE SHEET"
        title="Date Sheet"
        lede="Schedule every paper for each term — date, start time, max marks, syllabus headline. Drives the printable marksheet and parent-portal calendar."
        actions={
          <>
            <Link to="/exams" className="btn btn--ghost btn--sm">
              <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
            </Link>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setEditing("new")}
              disabled={!termId}
              title={!termId ? "Pick a term first" : ""}
            >
              <Icon name="plus" size={14} /> Add paper
            </button>
          </>
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}
      {err && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span>{err}</span>
        </div>
      )}

      <QueryError error={rowsError} refetch={rowsRefetch} isFetching={rowsFetching} label="date sheet" />

      <div className="toolbar card" style={{ padding: "12px 16px" }}>
        <div className="field" style={{ minWidth: 220 }}>
          <label className="field__label" htmlFor="ds-term">Term</label>
          <select
            id="ds-term"
            className="select"
            value={termId}
            onChange={(e) => setTermId(e.target.value ? Number(e.target.value) : "")}
            disabled={termsLoading}
          >
            {termsLoading && <option value="">Loading…</option>}
            {!termsLoading && (terms?.length ?? 0) === 0 && <option value="">No terms configured</option>}
            {terms?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode} · {t.name}{t.isFinalized ? " (finalized)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 180 }}>
          <label className="field__label" htmlFor="ds-class">Class filter</label>
          <select
            id="ds-class"
            className="select"
            value={classSlug}
            onChange={(e) => setClassSlug(e.target.value)}
            disabled={classesLoading}
          >
            <option value="">All classes</option>
            {classes?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => { setClassSlug(""); }}
          disabled={!classSlug}
        >
          Clear class filter
        </button>
      </div>

      {!termId ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>PICK A TERM</div>
          <div className="muted body-s">
            {(terms?.length ?? 0) === 0 ? (
              <>No exam terms configured yet. Add one under <Link to="/exams/terms">Terms</Link>.</>
            ) : (
              "Use the dropdown above to load the date sheet for a specific term."
            )}
          </div>
        </div>
      ) : rowsLoading || subjectsLoading ? (
        <div className="card"><Skeleton.Table rows={5} cols={5} /></div>
      ) : byClass.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>NO PAPERS</div>
          <div className="muted body-s">
            No papers scheduled for <b>{selectedTerm?.shortCode ?? "this term"}</b>
            {classSlug && <> in <b>{classSlug}</b></>}.
            {" "}
            <button
              type="button"
              onClick={() => setEditing("new")}
              style={{ background: "transparent", border: 0, color: "var(--orange)", cursor: "pointer", textDecoration: "underline" }}
            >
              Schedule the first paper
            </button>.
          </div>
        </div>
      ) : (
        byClass.map(([cls, papers]) => (
          <div key={cls} className="table-card">
            <div className="table-card__head">
              <div>
                <h3 className="table-card__title">
                  <span className="cls-pill" style={{ fontSize: 14, padding: "4px 12px" }}>{cls}</span>
                  <BrandDot />
                </h3>
                <div className="table-card__sub">
                  {papers.length} paper{papers.length === 1 ? "" : "s"} ·{" "}
                  {fmtDay(papers[0]!.examDate)} → {fmtDay(papers[papers.length - 1]!.examDate)}
                </div>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Time</th>
                  <th style={{ textAlign: "right" }}>Max</th>
                  <th style={{ textAlign: "right" }}>Pass</th>
                  <th>Syllabus</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {papers.map((r) => (
                  <tr key={r.id}>
                    <td className="mono body-s">{fmtDay(r.examDate)}</td>
                    <td className="td-name">{r.subjectName}</td>
                    <td className="mono body-s">
                      {fmtTime(r.startTime)}
                      {r.endTime && <> – {fmtTime(r.endTime)}</>}
                    </td>
                    <td className="mono" style={{ textAlign: "right" }}>{r.maxMarks}</td>
                    <td className="mono" style={{ textAlign: "right" }}>{r.passMarks}</td>
                    <td className="muted body-s" style={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.syllabusText || "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditing(r)}
                      >
                        <Icon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        style={{ marginLeft: 6 }}
                        onClick={() => onDelete(r)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {editing && termId && (
        <DatesheetModal
          initial={editing === "new" ? null : editing}
          termId={termId}
          defaultMax={selectedTerm?.defaultMaxMarks ?? 100}
          defaultClassSlug={classSlug || undefined}
          onClose={() => setEditing(null)}
          onSaved={() => { setFlash("Paper saved."); setEditing(null); }}
        />
      )}

      <style>{DS_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function DatesheetModal({
  initial, termId, defaultMax, defaultClassSlug, onClose, onSaved,
}: {
  initial: ExamDatesheetRow | null;
  termId: number;
  defaultMax: number;
  defaultClassSlug?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !initial;
  const { data: classes }  = useClasses();
  const { data: subjects } = useExamSubjects();

  const [classSlug, setClassSlug]     = useState(initial?.classSlug ?? defaultClassSlug ?? "");
  const [subjectId, setSubjectId]     = useState<string>(initial?.subjectId ? String(initial.subjectId) : "");
  const [examDate, setExamDate]       = useState(initial?.examDate ?? "");
  const [startTime, setStartTime]     = useState(initial?.startTime ?? "");
  const [endTime, setEndTime]         = useState(initial?.endTime ?? "");
  const [maxMarks, setMaxMarks]       = useState<string>(String(initial?.maxMarks ?? defaultMax));
  const [passMarks, setPassMarks]     = useState<string>(String(initial?.passMarks ?? Math.round((initial?.maxMarks ?? defaultMax) * 0.33)));
  const [syllabusText, setSyllabusText] = useState(initial?.syllabusText ?? "");
  const [err, setErr] = useState<string | null>(null);

  const save = useSaveDatesheet(initial?.id);

  // Subject options are filtered to those assigned to the selected class.
  const subjectOptions = useMemo(() => {
    if (!classSlug || !subjects) return [];
    return subjects.filter((s) => s.classes.includes(classSlug));
  }, [classSlug, subjects]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!classSlug)              { setErr("Pick a class."); return; }
    if (!subjectId)              { setErr("Pick a subject."); return; }
    if (!examDate)               { setErr("Pick the exam date."); return; }
    try {
      await save.mutateAsync({
        termId,
        classSlug,
        subjectId: Number(subjectId),
        examDate,
        startTime: startTime || null,
        endTime:   endTime   || null,
        maxMarks:  Number(maxMarks),
        passMarks: Number(passMarks),
        syllabusText: syllabusText.trim() || null,
      });
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, "Save failed"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Schedule paper" : "Edit paper"}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="ds-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Schedule" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="ds-form" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field">
          <label className="field__label field__label--req" htmlFor="ds-class">Class</label>
          <select
            id="ds-class"
            className="select"
            value={classSlug}
            onChange={(e) => { setClassSlug(e.target.value); setSubjectId(""); }}
            required
          >
            <option value="">— pick class —</option>
            {classes?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="ds-subject">Subject</label>
          <select
            id="ds-subject"
            className="select"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!classSlug}
            required
          >
            <option value="">{classSlug ? "— pick subject —" : "Pick class first"}</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.shortCode} · {s.name}</option>
            ))}
          </select>
          {classSlug && subjectOptions.length === 0 && (
            <span className="field__hint" style={{ color: "var(--warn)" }}>
              No subjects assigned to {classSlug}. Add some under <Link to="/exams/subjects">Subjects</Link>.
            </span>
          )}
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="ds-date">Exam date</label>
          <input
            id="ds-date"
            className="input"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ds-start">Start time</label>
          <input
            id="ds-start"
            className="input"
            type="time"
            value={startTime ?? ""}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ds-end">End time</label>
          <input
            id="ds-end"
            className="input"
            type="time"
            value={endTime ?? ""}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="ds-max">Max marks</label>
          <input
            id="ds-max"
            className="input mono"
            type="number"
            min="1"
            value={maxMarks}
            onChange={(e) => setMaxMarks(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="ds-pass">Pass marks</label>
          <input
            id="ds-pass"
            className="input mono"
            type="number"
            min="0"
            value={passMarks}
            onChange={(e) => setPassMarks(e.target.value)}
            required
          />
        </div>
        <div className="field span-2">
          <label className="field__label" htmlFor="ds-syllabus">Syllabus / chapters</label>
          <textarea
            id="ds-syllabus"
            className="input input--area"
            rows={2}
            value={syllabusText}
            onChange={(e) => setSyllabusText(e.target.value)}
            maxLength={500}
            placeholder="Ch 1-5 · Algebra · Quadratic equations"
          />
        </div>
        {err && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={16} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

const DS_CSS = `
  .field__hint { color: var(--ink-60); font-size: 11.5px; line-height: 1.4; }
  .field__label--req::after { content: ' *'; color: var(--error); font-weight: 700; }
`;
