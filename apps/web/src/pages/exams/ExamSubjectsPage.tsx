import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useClasses } from "@/pages/classes/hooks";
import {
  useDeleteSubject, useExamSubjects, useSaveSubject, useToggleSubjectClass,
} from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { ExamSubject } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamSubjectsPage() {
  const { data: subjects, isLoading, error, refetch, isFetching } = useExamSubjects();
  const { data: classes }             = useClasses();
  const [editing, setEditing]         = useState<ExamSubject | "new" | null>(null);
  const toggle                        = useToggleSubjectClass();
  const [flash, setFlash]             = useState<string | null>(null);
  const [err, setErr]                 = useState<string | null>(null);

  const totalAssigns = (subjects ?? []).reduce((s, x) => s + x.classes.length, 0);

  async function onToggle(subjectId: number, classSlug: string, enabled: boolean) {
    setErr(null);
    try {
      await toggle.mutateAsync({ classSlug, subjectId, enabled });
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to toggle"));
    }
  }

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="SUBJECTS"
        title="Subjects"
        lede="Edit the subject catalog and tick which classes sit for each subject. Removing a class assignment is blocked once marks have been entered — protects the marksheet's integrity."
        actions={
          <>
            <Link to="/exams" className="btn btn--ghost btn--sm">
              <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
            </Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
              <Icon name="plus" size={14} /> Add subject
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

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="exam subjects" />

      <div className="table-card" style={{ overflowX: "auto" }}>
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Subjects<BrandDot /></h3>
            <div className="table-card__sub">
              {(subjects?.length ?? 0).toLocaleString("en-IN")} subjects · {totalAssigns} class assignments
              {classes && classes.length > 0 && <> · {classes.length} classes</>}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={6} cols={6} /></div>
        ) : (subjects?.length ?? 0) === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO SUBJECTS</div>
            <div className="muted body-s">
              No subjects yet.
              {" "}
              <button
                type="button"
                onClick={() => setEditing("new")}
                style={{ background: "transparent", border: 0, color: "var(--orange)", cursor: "pointer", textDecoration: "underline" }}
              >
                Add your first subject
              </button>.
            </div>
          </div>
        ) : (
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, background: "var(--cream-soft)", zIndex: 2, minWidth: 180 }}>
                  Subject
                </th>
                <th>Code</th>
                <th>Lang?</th>
                <th style={{ textAlign: "right" }}>Classes</th>
                {classes?.map((c) => (
                  <th key={c.id} style={{ textAlign: "center", minWidth: 54 }}>
                    {c.slug}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subjects?.map((s) => (
                <tr key={s.id}>
                  <td
                    className="td-name"
                    style={{ position: "sticky", left: 0, background: "var(--white)", zIndex: 1 }}
                  >
                    {s.name}
                    <div className="muted body-s mono" style={{ fontSize: 11 }}>{s.slug}</div>
                  </td>
                  <td><span className="cls-pill">{s.shortCode}</span></td>
                  <td>
                    {s.isLanguage
                      ? <span className="pill pill--info">LANG</span>
                      : <span className="muted">—</span>}
                  </td>
                  <td
                    className="mono"
                    style={{
                      textAlign: "right",
                      color: s.classes.length > 0 ? "var(--success)" : "var(--ink-40)",
                      fontWeight: s.classes.length > 0 ? 600 : 400,
                    }}
                  >
                    {s.classes.length}
                  </td>
                  {classes?.map((c) => {
                    const on = s.classes.includes(c.slug);
                    return (
                      <td key={c.id} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => onToggle(s.id, c.slug, e.target.checked)}
                          style={{ accentColor: "var(--orange)" }}
                        />
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(s)}>
                      <Icon name="edit" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <SubjectModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(s, action) => {
            setFlash(action === "deleted" ? `${s.name} deleted.` : `${s.name} saved.`);
            setEditing(null);
          }}
        />
      )}

      <style>{SUBJ_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function SubjectModal({
  initial, onClose, onSaved,
}: {
  initial: ExamSubject | null;
  onClose: () => void;
  onSaved: (s: ExamSubject, action: "saved" | "deleted") => void;
}) {
  const isNew = !initial;
  const [slug, setSlug]               = useState(initial?.slug ?? "");
  const [name, setName]               = useState(initial?.name ?? "");
  const [shortCode, setShortCode]     = useState(initial?.shortCode ?? "");
  const [isLanguage, setIsLanguage]   = useState(initial?.isLanguage ?? false);
  const [sortOrder, setSortOrder]     = useState<string>(String(initial?.sortOrder ?? 100));
  const [err, setErr] = useState<string | null>(null);
  const save   = useSaveSubject(initial?.id);
  const remove = useDeleteSubject();

  function onShortCodeChange(v: string) {
    const up = v.toUpperCase();
    setShortCode(up);
    if (isNew && !slug) {
      setSlug(up.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const saved = await save.mutateAsync({
        slug: slug.trim(),
        name: name.trim(),
        shortCode: shortCode.trim(),
        isLanguage,
        sortOrder: Number(sortOrder),
      });
      onSaved(saved, "saved");
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!confirm(`Delete subject "${initial.name}"? Only allowed if no marks have been recorded.`)) return;
    setErr(null);
    try {
      await remove.mutateAsync(initial.id);
      onSaved(initial, "deleted");
    } catch (e) {
      setErr(getErrorMessage(e, "Delete failed"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Add subject" : `Edit ${initial?.name}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="subj-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Add subject" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="subj-form" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field span-2">
          <label className="field__label field__label--req" htmlFor="s-name">Subject name</label>
          <input
            id="s-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sanskrit"
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="s-code">Short code</label>
          <input
            id="s-code"
            className="input mono"
            value={shortCode}
            onChange={(e) => onShortCodeChange(e.target.value)}
            maxLength={8}
            placeholder="SKT"
            required
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="s-order">Sort order</label>
          <input
            id="s-order"
            className="input mono"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="field span-2">
          <label className="field__label" htmlFor="s-slug">Slug</label>
          <input
            id="s-slug"
            className="input mono"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto-derived from short code"
            required
          />
          <span className="field__hint">URL-safe identifier; auto-derived from short code if blank.</span>
        </div>
        <div className="field span-2">
          <label className="check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={isLanguage}
              onChange={(e) => setIsLanguage(e.target.checked)}
            />
            <span>Language subject — affects how marks/grades aggregate in reports.</span>
          </label>
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

const SUBJ_CSS = `
  .field__hint { color: var(--ink-60); font-size: 11.5px; line-height: 1.4; }
  .field__label--req::after { content: ' *'; color: var(--error); font-weight: 700; }
`;
