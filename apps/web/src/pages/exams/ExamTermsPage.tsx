import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Modal } from "@/components/Modal";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useDeleteTerm, useExamTerms, useSaveTerm, useToggleFinalize } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { ExamTerm } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ExamTermsPage() {
  const { data: terms, isLoading, error, refetch, isFetching } = useExamTerms();
  const [editing, setEditing] = useState<ExamTerm | "new" | null>(null);
  const toggle = useToggleFinalize();
  const remove = useDeleteTerm();
  const [flash, setFlash] = useState<string | null>(null);
  const [err, setErr]     = useState<string | null>(null);

  const total = (terms ?? []).reduce((s, t) => s + t.weightPercent, 0);
  const weightOk = Math.abs(total - 100) < 0.01;

  // The session_code is consistent across all rows (terms are
  // session-scoped). Use the first row's session for the banner copy.
  const sessionCode = terms?.[0]?.sessionCode ?? "current session";

  async function onToggle(t: ExamTerm, finalize: boolean) {
    setErr(null);
    try {
      await toggle.mutateAsync({ id: t.id, finalize });
      setFlash(finalize ? `${t.name} finalized.` : `${t.name} unlocked.`);
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to toggle"));
    }
  }

  async function onDelete(t: ExamTerm) {
    if (!confirm(`Delete term "${t.name}"? Only allowed if no marks have been recorded.`)) return;
    setErr(null);
    try {
      await remove.mutateAsync(t.id);
      setFlash(`${t.name} deleted.`);
    } catch (e) {
      setErr(getErrorMessage(e, "Delete failed"));
    }
  }

  return (
    <>
      <PageHead
        group="EXAMS"
        meta="TERMS"
        title="Exam Terms"
        lede={
          <>
            Define the tests that make up a session. Each term carries a <b>weightage</b> that decides
            how it rolls into the final marksheet aggregate (eg. CBSE: PT1 10% + Half-Yearly 30% +
            PT2 10% + Annual 50%).
          </>
        }
        actions={
          <>
            <Link to="/exams" className="btn btn--ghost btn--sm">
              <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} /> Back
            </Link>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
              <Icon name="plus" size={14} /> Add term
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

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="exam terms" />

      {/* Total weight banner */}
      <div className={`banner ${weightOk ? "banner--success" : "banner--warn"}`}>
        <Icon name="info" size={16} />
        <span>
          Total weight for <b>{sessionCode}</b> = <b>{Number(total.toFixed(2))}%</b>.{" "}
          {weightOk
            ? "Perfect — adds up to 100."
            : "Should add up to 100 for clean aggregates."}
        </span>
      </div>

      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Terms<BrandDot /></h3>
            <div className="table-card__sub">
              {(terms?.length ?? 0).toLocaleString("en-IN")} configured
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton.Table rows={4} cols={9} />
        ) : (terms?.length ?? 0) === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO TERMS</div>
            <div className="muted body-s">
              No exam terms configured for this session.
              {" "}
              <button
                type="button"
                onClick={() => setEditing("new")}
                style={{ background: "transparent", border: 0, color: "var(--orange)", cursor: "pointer", textDecoration: "underline" }}
              >
                Add your first term
              </button>.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th style={{ textAlign: "right" }}>Weight %</th>
                <th style={{ textAlign: "right" }}>Default max</th>
                <th style={{ textAlign: "right" }}>Order</th>
                <th style={{ textAlign: "right" }}>Papers</th>
                <th style={{ textAlign: "right" }}>Marks</th>
                <th>Finalized</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terms?.map((t) => (
                <tr key={t.id}>
                  <td><span className="cls-pill">{t.shortCode}</span></td>
                  <td className="td-name">
                    {t.name}
                    <div className="muted body-s mono" style={{ fontSize: 11 }}>{t.slug}</div>
                  </td>
                  <td className="mono" style={{ textAlign: "right" }}>{t.weightPercent}%</td>
                  <td className="mono" style={{ textAlign: "right" }}>{t.defaultMaxMarks}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{t.sortOrder}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{t.papersCount ?? 0}</td>
                  <td
                    className="mono"
                    style={{
                      textAlign: "right",
                      color: (t.marksCount ?? 0) > 0 ? "var(--success)" : "var(--ink-40)",
                      fontWeight: (t.marksCount ?? 0) > 0 ? 600 : 400,
                    }}
                  >
                    {t.marksCount ?? 0}
                  </td>
                  <td>
                    <label className="switch" title={t.isFinalized ? "Locked — un-toggle to edit" : "Open for marks entry"}>
                      <input
                        type="checkbox"
                        checked={t.isFinalized}
                        onChange={(e) => onToggle(t, e.target.checked)}
                      />
                      <span className="switch__slider" />
                    </label>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditing(t)}
                      disabled={t.isFinalized}
                      title={t.isFinalized ? "Un-finalize first" : ""}
                    >
                      <Icon name="edit" size={14} /> Edit
                    </button>
                    {!t.isFinalized && (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        style={{ marginLeft: 6 }}
                        onClick={() => onDelete(t)}
                        title="Delete (only if no marks recorded)"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TermModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(t) => { setFlash(`${t.name} saved.`); setEditing(null); }}
        />
      )}

      <style>{SWITCH_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function TermModal({
  initial, onClose, onSaved,
}: {
  initial: ExamTerm | null;
  onClose: () => void;
  onSaved: (t: ExamTerm) => void;
}) {
  const isNew = !initial;
  const [slug, setSlug]             = useState(initial?.slug ?? "");
  const [name, setName]             = useState(initial?.name ?? "");
  const [shortCode, setShortCode]   = useState(initial?.shortCode ?? "");
  const [weight, setWeight]         = useState<string>(String(initial?.weightPercent ?? 10));
  const [defaultMax, setDefaultMax] = useState<string>(String(initial?.defaultMaxMarks ?? 100));
  const [sortOrder, setSortOrder]   = useState<string>(String(initial?.sortOrder ?? 50));
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveTerm(initial?.id);

  // Auto-generate slug from short code when adding new and slug is empty.
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
        weightPercent: Number(weight),
        defaultMaxMarks: Number(defaultMax),
        sortOrder: Number(sortOrder),
      });
      onSaved(saved);
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Add exam term" : `Edit ${initial?.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="term-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : isNew ? "Add term" : "Save changes"}
          </button>
        </>
      }
    >
      <form id="term-form" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field">
          <label className="field__label field__label--req" htmlFor="t-code">Short code</label>
          <input
            id="t-code"
            className="input mono"
            placeholder="PT1"
            value={shortCode}
            onChange={(e) => onShortCodeChange(e.target.value)}
            maxLength={8}
            required
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="t-order">Sort order</label>
          <input
            id="t-order"
            className="input mono"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
        <div className="field span-2">
          <label className="field__label field__label--req" htmlFor="t-name">Name</label>
          <input
            id="t-name"
            className="input"
            placeholder="1st Unit Test"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            required
          />
        </div>
        <div className="field span-2">
          <label className="field__label" htmlFor="t-slug">Slug</label>
          <input
            id="t-slug"
            className="input mono"
            placeholder="auto-derived from short code"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={40}
            required
          />
          <span className="field__hint">URL-safe identifier; auto-derived from short code if blank.</span>
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="t-weight">Weight %</label>
          <input
            id="t-weight"
            className="input mono"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="t-max">Default max marks</label>
          <input
            id="t-max"
            className="input mono"
            type="number"
            min="1"
            max="999"
            value={defaultMax}
            onChange={(e) => setDefaultMax(e.target.value)}
            required
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

/* ------------------------------------------------------------------ */
/* Inline CSS                                                          */
/* ------------------------------------------------------------------ */

const SWITCH_CSS = `
  .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .switch__slider {
    position: absolute; inset: 0; cursor: pointer;
    background: var(--rule-strong);
    border-radius: var(--r-pill);
    transition: background var(--t-fast) var(--ease);
  }
  .switch__slider::before {
    content: ''; position: absolute; left: 3px; top: 3px;
    width: 14px; height: 14px; border-radius: 50%;
    background: var(--white);
    transition: transform var(--t-fast) var(--ease);
  }
  .switch input:checked + .switch__slider { background: var(--success); }
  .switch input:checked + .switch__slider::before { transform: translateX(16px); }
  .field__hint { color: var(--ink-60); font-size: 11.5px; line-height: 1.4; }
  .field__label--req::after { content: ' *'; color: var(--error); font-weight: 700; }
`;
