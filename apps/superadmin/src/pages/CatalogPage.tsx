import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type { CatalogUpsertInput, PlatformFeature } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

const blank: CatalogUpsertInput = {
  featureKey: "", label: "", description: null, benefit: null, category: "General",
  monthlyPrice: 0, isCore: false, sortOrder: 0,
};

export function CatalogPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["super", "catalog"],
    queryFn: async () => (await api.get<PlatformFeature[]>("/superadmin/catalog")).data,
  });

  const [editing, setEditing] = useState<CatalogUpsertInput | "new" | null>(null);

  const save = useMutation({
    mutationFn: async (input: CatalogUpsertInput & { isCreate: boolean }) => {
      if (input.isCreate) return (await api.post<PlatformFeature>("/superadmin/catalog", input)).data;
      return (await api.put<PlatformFeature>(`/superadmin/catalog/${encodeURIComponent(input.featureKey)}`, input)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["super", "catalog"] }); setEditing(null); },
  });

  const remove = useMutation({
    mutationFn: async (key: string) => (await api.delete<{ ok: true }>(`/superadmin/catalog/${encodeURIComponent(key)}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "catalog"] }),
  });

  return (
    <>
      <PageHead
        group="CATALOG"
        title="Features &amp; pricing"
        lede={data ? `${data.length} features · ${data.filter((f) => f.isCore).length} core` : "Loading…"}
        actions={
          <button className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
            <Icon name="plus" size={14} /> Add feature
          </button>
        }
      />

      <div className="table-card">
        <table className="data-table">
          <thead><tr><th>Key</th><th>Label</th><th>Category</th><th>Monthly</th><th>Core?</th><th></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {data?.map((f) => (
              <tr key={f.featureKey}>
                <td className="mono">{f.featureKey}</td>
                <td className="td-name">{f.label}<div className="muted body-s">{f.description ?? "—"}</div></td>
                <td>{f.category}</td>
                <td className="mono">{f.isCore ? "Free" : fmt(f.monthlyPrice)}</td>
                <td>{f.isCore ? <span className="pill pill--success">CORE</span> : <span className="muted">—</span>}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn btn--ghost btn--sm" onClick={() => setEditing({ ...f, description: f.description ?? null, benefit: f.benefit ?? null })}>
                    <Icon name="edit" size={12} /> Edit
                  </button>
                  <button
                    className="btn btn--danger btn--sm"
                    style={{ marginLeft: 4 }}
                    onClick={() => { if (confirm(`Delete ${f.label}?`)) remove.mutate(f.featureKey); }}
                  >
                    <Icon name="x" size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <CatalogEditorCard
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input, isCreate) => save.mutateAsync({ ...input, isCreate })}
          busy={save.isPending}
        />
      )}
    </>
  );
}

function CatalogEditorCard({
  initial, onClose, onSave, busy,
}: {
  initial: CatalogUpsertInput | null;
  onClose: () => void;
  onSave: (input: CatalogUpsertInput, isCreate: boolean) => Promise<unknown>;
  busy: boolean;
}) {
  const isNew = !initial;
  const [form, setForm] = useState<CatalogUpsertInput>(initial ?? blank);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try { await onSave(form, isNew); }
    catch (e) { setErr(getErrorMessage(e, "Save failed")); }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="display-s" style={{ fontSize: 18 }}>{isNew ? "Add feature" : `Edit ${initial?.featureKey}`}</div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}><Icon name="x" size={12} /></button>
      </div>
      <div className="form-grid form-grid--2">
        <Field label="Key (slug) *">
          <input className="input mono" value={form.featureKey} onChange={(e) => setForm({ ...form, featureKey: e.target.value })} required disabled={!isNew} />
        </Field>
        <Field label="Label *">
          <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        </Field>
        <Field label="Category"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        <Field label="Monthly price (₹)">
          <input className="input mono" type="number" value={String(form.monthlyPrice)} onChange={(e) => setForm({ ...form, monthlyPrice: Number(e.target.value || 0) })} />
        </Field>
        <Field label="Sort order">
          <input className="input mono" type="number" value={String(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value || 0) })} />
        </Field>
        <Field label="Core?">
          <label className="check">
            <input type="checkbox" checked={form.isCore} onChange={(e) => setForm({ ...form, isCore: e.target.checked })} />
            Always on; price ignored
          </label>
        </Field>
        <Field label="Description" fullWidth>
          <input className="input" value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value || null })} />
        </Field>
        <Field label="Why this module matters" fullWidth>
          <textarea className="input input--area" rows={3} value={form.benefit ?? ""} onChange={(e) => setForm({ ...form, benefit: e.target.value || null })} />
        </Field>
      </div>
      {err && <div className="banner banner--error" style={{ marginTop: 8 }}><span>{err}</span></div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : "Save feature"}</button>
      </div>
    </form>
  );
}

function Field({ label, fullWidth, children }: { label: string; fullWidth?: boolean; children: React.ReactNode }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : undefined}>
      <label className="field__label">{label}</label>
      {children}
    </div>
  );
}
