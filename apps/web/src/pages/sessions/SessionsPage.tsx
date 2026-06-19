import { useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Modal } from "@/components/Modal";
import { useSaveSession, useSessions, useSetCurrentSession } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { AcademicSession } from "@crestly/shared";

export function SessionsPage() {
  const { data: sessions, isLoading } = useSessions();
  const [editing, setEditing] = useState<AcademicSession | "new" | null>(null);
  const setCurrent = useSetCurrentSession();

  return (
    <>
      <PageHead
        group="SYSTEM"
        title="Academic Sessions"
        lede="Manage academic years. Exactly one session is current at a time."
        actions={
          <button className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
            <Icon name="plus" size={14} /> New session
          </button>
        }
      />

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Label</th>
              <th>Started</th>
              <th>Ended</th>
              <th>Current?</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>
            )}
            {sessions?.map((s) => (
              <tr key={s.code}>
                <td className="mono">{s.code}</td>
                <td className="td-name">{s.label}</td>
                <td className="mono muted">{s.startedAt}</td>
                <td className="mono muted">{s.endedAt}</td>
                <td>
                  {s.isCurrent ? (
                    <span className="pill pill--success"><span className="pill__dot" />CURRENT</span>
                  ) : (
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        if (!confirm(`Make ${s.label} the current session?`)) return;
                        setCurrent.mutate(s.code);
                      }}
                    >
                      Make current
                    </button>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing(s)}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <SessionEditModal initial={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SessionEditModal({ initial, onClose }: { initial: AcademicSession | null; onClose: () => void }) {
  const isNew = !initial;
  const [code, setCode] = useState(initial?.code ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [startedAt, setStartedAt] = useState(initial?.startedAt ?? "");
  const [endedAt, setEndedAt] = useState(initial?.endedAt ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveSession(initial?.code);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ code, label, startedAt, endedAt });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save session"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "New academic session" : `Edit ${initial?.code}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="session-edit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="session-edit" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field">
          <label className="field__label">Code *</label>
          <input className="input" placeholder="2026-27" value={code} onChange={(e) => setCode(e.target.value)} disabled={!isNew} required />
        </div>
        <div className="field">
          <label className="field__label">Label *</label>
          <input className="input" placeholder="Academic Session 2026-27" value={label} onChange={(e) => setLabel(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label">Started on *</label>
          <input className="input" type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label">Ended on *</label>
          <input className="input" type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} required />
        </div>
        {error && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
