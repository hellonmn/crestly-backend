import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import { useSuperAuth } from "@/lib/auth-store";
import type { SuperAdminProfile, SuperAdminUpsert } from "@crestly/shared";

export function AdminsPage() {
  const qc = useQueryClient();
  const { admin: me } = useSuperAuth();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<SuperAdminUpsert>({ name: "", email: "", phone: null, status: "active" });
  const [err, setErr] = useState<string | null>(null);
  const [tempMsg, setTempMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["super", "admins"],
    queryFn: async () => (await api.get<SuperAdminProfile[]>("/superadmin/admins")).data,
  });
  const create = useMutation({
    mutationFn: async (body: SuperAdminUpsert) => (await api.post<SuperAdminProfile & { tempPassword: string }>("/superadmin/admins", body)).data,
    onSuccess: (r) => { setTempMsg(`Temp password for ${r.name}: ${r.tempPassword}`); setAdding(false); qc.invalidateQueries({ queryKey: ["super", "admins"] }); },
  });
  const updateOne = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SuperAdminUpsert }) =>
      (await api.put<SuperAdminProfile>(`/superadmin/admins/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "admins"] }),
  });
  const resetPw = useMutation({
    mutationFn: async (id: number) => (await api.post<{ ok: true; tempPassword: string }>(`/superadmin/admins/${id}/reset-password`)).data,
  });
  const remove = useMutation({
    mutationFn: async (id: number) => (await api.delete<{ ok: true }>(`/superadmin/admins/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "admins"] }),
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try { await create.mutateAsync(form); setForm({ name: "", email: "", phone: null, status: "active" }); }
    catch (e) { setErr(getErrorMessage(e, "Create failed")); }
  }

  return (
    <>
      <PageHead
        group="PLATFORM"
        title="Super-admins"
        lede={list.data ? `${list.data.length} platform admins` : "Loading…"}
        actions={
          <button className="btn btn--primary btn--sm" onClick={() => { setAdding((v) => !v); setErr(null); }}>
            <Icon name="plus" size={14} /> {adding ? "Cancel" : "Add admin"}
          </button>
        }
      />

      {tempMsg && (
        <div className="banner banner--success">
          <Icon name="check" size={14} /><span>{tempMsg}</span>
        </div>
      )}

      {adding && (
        <form className="card" onSubmit={onCreate}>
          <div className="form-grid form-grid--2">
            <Field label="Name *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
            <Field label="Email *"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
            <Field label="Phone"><input className="input mono" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} /></Field>
            <Field label="Status">
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "active" | "inactive" })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
          {err && <div className="banner banner--error"><span>{err}</span></div>}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn--primary" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create admin"}
            </button>
          </div>
        </form>
      )}

      <div className="table-card">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>
            {list.data?.map((a) => (
              <tr key={a.id} style={a.id === me?.id ? { background: "var(--cream-soft)" } : undefined}>
                <td className="td-name">{a.name}{a.id === me?.id && <span className="pill pill--mint" style={{ marginLeft: 6 }}>YOU</span>}</td>
                <td className="mono">{a.email}</td>
                <td className="mono muted">{a.phone ?? "—"}</td>
                <td>
                  <select
                    className="select"
                    value={a.status}
                    onChange={(e) => updateOne.mutate({ id: a.id, body: { name: a.name, email: a.email, phone: a.phone, status: e.target.value as "active" | "inactive" } })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </td>
                <td className="muted mono" style={{ fontSize: 11 }}>
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString("en-IN") : "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      if (!confirm(`Reset password for ${a.name}?`)) return;
                      try { const r = await resetPw.mutateAsync(a.id); setTempMsg(`Temp password for ${a.name}: ${r.tempPassword}`); }
                      catch (e) { alert(getErrorMessage(e, "Reset failed")); }
                    }}
                  >
                    Reset PW
                  </button>
                  {a.id !== me?.id && (
                    <button
                      className="btn btn--danger btn--sm"
                      style={{ marginLeft: 4 }}
                      onClick={() => { if (confirm(`Delete admin ${a.name}?`)) remove.mutate(a.id); }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
