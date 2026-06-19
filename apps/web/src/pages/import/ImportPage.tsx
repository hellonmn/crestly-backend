import { useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { useCommitImport, usePreviewImport } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { ImportPreviewResponse, ImportRowStatus, ImportType } from "@crestly/shared";

const ROW_PILL: Record<ImportRowStatus, string> = {
  insert: "pill--success",
  update: "pill--info",
  skip: "pill--neutral",
  error: "pill--error",
};

export function ImportPage() {
  const [type, setType] = useState<ImportType>("students");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const previewM = usePreviewImport();
  const commitM = useCommitImport();

  async function onPreview() {
    setErr(null);
    setCommitted(null);
    if (!file) {
      setErr("Pick a CSV file first.");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const csvBase64 = btoa(
        Array.from(new Uint8Array(buf)).map((b) => String.fromCharCode(b)).join(""),
      );
      const r = await previewM.mutateAsync({ type, csvBase64 });
      setPreview(r);
    } catch (e) {
      setErr(getErrorMessage(e, "Preview failed"));
    }
  }

  async function onCommit() {
    if (!preview) return;
    setErr(null);
    try {
      const r = await commitM.mutateAsync(preview.token);
      setCommitted(`Added ${r.added} · Updated ${r.updated} · Skipped ${r.skipped} · Errored ${r.errored}.`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      setErr(getErrorMessage(e, "Commit failed"));
    }
  }

  return (
    <>
      <PageHead
        group="HR"
        title="Import"
        lede="Two-step (Preview → Commit) CSV importer for students or staff."
      />

      {committed && <div className="banner banner--success"><Icon name="check" size={16} /><span>{committed}</span></div>}
      {err && <div className="banner banner--error"><Icon name="alert" size={16} /><span>{err}</span></div>}

      <div className="card">
        <div className="display-s" style={{ marginBottom: 16, fontSize: 18 }}>Step 1 · Upload</div>
        <div className="form-grid form-grid--2">
          <div className="field">
            <label className="field__label">Entity type</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as ImportType)}>
              <option value="students">Students</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label">CSV file</label>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }}
            />
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" onClick={onPreview} disabled={!file || previewM.isPending}>
            {previewM.isPending ? "Parsing…" : "Preview"}
          </button>
        </div>
        <p className="muted body-s" style={{ marginTop: 8, marginBottom: 0 }}>
          Required columns for <b>students</b>: sr_number, student_name, class, section.
          For <b>staff</b>: name, phone. Other columns auto-map via the legacy PHP alias dictionary.
        </p>
      </div>

      {preview && (
        <>
          <div className="grid grid--cols-4 grid--gap-sm">
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-mint"><Icon name="plus" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">TO INSERT</div>
                <div className="stat-tile__value">{preview.toInsert}</div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-sky"><Icon name="edit" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">TO UPDATE</div>
                <div className="stat-tile__value">{preview.toUpdate}</div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-wheat"><Icon name="info" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">TO SKIP</div>
                <div className="stat-tile__value">{preview.toSkip}</div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile__icon icon-tint-rose"><Icon name="alert" size={20} /></div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">ERRORS</div>
                <div className="stat-tile__value">{preview.errors}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
              <div className="display-s" style={{ fontSize: 18 }}>Step 2 · Review &amp; confirm</div>
              <button className="btn btn--primary" onClick={onCommit} disabled={commitM.isPending || preview.totalRows === preview.errors}>
                {commitM.isPending ? "Committing…" : `Confirm import (${preview.totalRows - preview.errors} rows)`}
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Status</th>
                  <th>Identifier</th>
                  <th>Summary</th>
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber}>
                    <td className="td-sr mono">{r.rowNumber}</td>
                    <td><span className={`pill ${ROW_PILL[r.status]}`}>{r.status}</span></td>
                    <td className="mono">{r.identifier}</td>
                    <td>{r.summary}</td>
                    <td className="muted body-s">
                      {r.errors.length > 0 ? r.errors.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
