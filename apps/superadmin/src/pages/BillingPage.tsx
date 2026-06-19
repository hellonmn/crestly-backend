import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type { PlatformBilling, PlatformBillingUpdate, FeaturePurchaseRow, PlatformLedgerOverview } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function BillingPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["super", "billing"],
    queryFn: async () => (await api.get<PlatformBilling>("/superadmin/billing")).data,
  });
  const recent = useQuery({
    queryKey: ["super", "ledger"],
    queryFn: async () => (await api.get<PlatformLedgerOverview>("/superadmin/ledger")).data,
  });
  const save = useMutation({
    mutationFn: async (input: PlatformBillingUpdate) =>
      (await api.put<PlatformBilling>("/superadmin/billing", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "billing"] }),
  });

  const [form, setForm] = useState<PlatformBillingUpdate>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm({
      enabled: data.enabled,
      keyId: data.keyId ?? "",
      keySecret: data.keySecret ?? "",
      gstRate: data.gstRate,
      invoicePrefix: data.invoicePrefix,
    });
  }, [data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      const patch = { ...form };
      if (typeof patch.keySecret === "string" && patch.keySecret.startsWith("****")) delete patch.keySecret;
      await save.mutateAsync(patch);
      setMsg("Saved.");
    } catch (e) { setErr(getErrorMessage(e, "Save failed")); }
  }

  return (
    <>
      <PageHead group="REVENUE" title="Billing" lede="Razorpay credentials + invoice numbering." />

      {msg && <div className="banner banner--success"><Icon name="check" size={14} /><span>{msg}</span></div>}
      {err && <div className="banner banner--error"><Icon name="alert" size={14} /><span>{err}</span></div>}

      <form className="card" onSubmit={onSubmit}>
        <div className="form-grid form-grid--2">
          <Field label="Enabled" fullWidth>
            <label className="check">
              <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              Accept Razorpay payments from school admins
            </label>
          </Field>
          <Field label="Key ID"><input className="input mono" value={form.keyId ?? ""} onChange={(e) => setForm({ ...form, keyId: e.target.value })} /></Field>
          <Field label="Key secret">
            <input className="input mono" value={form.keySecret ?? ""} onChange={(e) => setForm({ ...form, keySecret: e.target.value })} placeholder={data?.keySecret ?? ""} />
            <span className="field__hint">Leave the masked value to keep the existing secret.</span>
          </Field>
          <Field label="GST rate (%)"><input className="input mono" type="number" value={String(form.gstRate ?? 18)} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value || 0) })} /></Field>
          <Field label="Invoice prefix"><input className="input mono" value={form.invoicePrefix ?? "CR"} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>Recent purchases</div>
        {!recent.data || recent.data.recent.length === 0 ? (
          <p className="muted">No purchases yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>When</th><th>School</th><th>Feature</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {recent.data.recent.map((p) => <PurchaseRow key={p.id} p={p} />)}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function PurchaseRow({ p }: { p: FeaturePurchaseRow }) {
  return (
    <tr>
      <td className="mono" style={{ fontSize: 11 }}>{p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN") : "—"}</td>
      <td className="td-name">{p.schoolName}</td>
      <td className="mono">{p.featureKey}</td>
      <td className="mono">{fmt(p.amount)}</td>
      <td>
        <span className={`pill ${p.status === "paid" ? "pill--success" : p.status === "failed" ? "pill--error" : "pill--warn"}`}>
          <span className="pill__dot" />{p.status}
        </span>
      </td>
    </tr>
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
