import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { HdfcSettings, HdfcSettingsUpdate } from "@crestly/shared";

function useHdfcSettings() {
  return useQuery({
    queryKey: ["pg", "hdfc"],
    queryFn: async () => (await api.get<HdfcSettings>("/settings/payment-gateway")).data,
  });
}
function useSaveHdfcSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: HdfcSettingsUpdate) =>
      (await api.put<HdfcSettings>("/settings/payment-gateway", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pg", "hdfc"] }),
  });
}
function useClearHdfcKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<HdfcSettings>("/settings/payment-gateway/clear-key")).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pg", "hdfc"] }),
  });
}

export function PaymentGatewaySettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleSlug === "admin";
  const { data, isLoading } = useHdfcSettings();
  const save = useSaveHdfcSettings();
  const clearKey = useClearHdfcKey();

  const [form, setForm] = useState<HdfcSettingsUpdate>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled,
        environment: data.environment,
        merchantId: data.merchantId ?? "",
        apiKey: data.apiKey ?? "",
        endpointProd: data.endpointProd ?? "",
        endpointSandbox: data.endpointSandbox ?? "",
        returnPath: data.returnPath ?? "",
        webhookPath: data.webhookPath ?? "",
      });
    }
  }, [data]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    try {
      const patch = { ...form };
      // Skip the masked key — only send when user typed a new value.
      if (typeof patch.apiKey === "string" && patch.apiKey.startsWith("****")) {
        delete patch.apiKey;
      }
      await save.mutateAsync(patch);
      setMsg("Saved.");
    } catch (e) { setErr(getErrorMessage(e, "Save failed")); }
  }

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!isAdmin) {
    return (
      <div className="banner banner--warn">
        <Icon name="alert" size={16} />
        <span>Admins only.</span>
      </div>
    );
  }

  return (
    <>
      <PageHead
        group="SYSTEM"
        title="Payment Gateway"
        lede="HDFC SmartGateway for online fee collection. Parent-side checkout lands in the parent portal."
      />

      {msg && <div className="banner banner--success"><Icon name="check" size={16} /><span>{msg}</span></div>}
      {err && <div className="banner banner--error"><Icon name="alert" size={16} /><span>{err}</span></div>}

      <form className="card" onSubmit={onSubmit}>
        <div className="form-section">
          <div className="form-section__head"><span className="form-section__num">01</span><span className="form-section__title">Credentials</span></div>
          <div className="form-grid form-grid--2">
            <Field label="Enabled" fullWidth>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                Accept online fee payments
              </label>
            </Field>
            <Field label="Environment">
              <select className="select" value={form.environment ?? "sandbox"} onChange={(e) => setForm({ ...form, environment: e.target.value as "sandbox" | "production" })}>
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </Field>
            <Field label="Merchant ID">
              <input className="input mono" value={form.merchantId ?? ""} onChange={(e) => setForm({ ...form, merchantId: e.target.value })} />
            </Field>
            <Field label="API key" fullWidth>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="input mono" style={{ flex: 1 }} value={form.apiKey ?? ""} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={data?.apiKey ?? ""} />
                <button type="button" className="btn btn--ghost btn--sm" onClick={async () => { await clearKey.mutateAsync(); setForm({ ...form, apiKey: "" }); }}>
                  Clear key
                </button>
              </div>
              <span className="field__hint">Stored encrypted (AES-256-CBC) at rest. Leave the masked value to keep the existing key.</span>
            </Field>
          </div>
        </div>

        <details className="form-section">
          <summary style={{ cursor: "pointer", marginBottom: 12 }}>
            <span className="form-section__num">02</span>
            <span className="form-section__title" style={{ marginLeft: 8 }}>Advanced (endpoints + paths)</span>
          </summary>
          <div className="form-grid form-grid--2">
            <Field label="Production endpoint" fullWidth>
              <input className="input mono" value={form.endpointProd ?? ""} onChange={(e) => setForm({ ...form, endpointProd: e.target.value })} />
            </Field>
            <Field label="Sandbox endpoint" fullWidth>
              <input className="input mono" value={form.endpointSandbox ?? ""} onChange={(e) => setForm({ ...form, endpointSandbox: e.target.value })} />
            </Field>
            <Field label="Return path">
              <input className="input mono" value={form.returnPath ?? ""} onChange={(e) => setForm({ ...form, returnPath: e.target.value })} />
            </Field>
            <Field label="Webhook path">
              <input className="input mono" value={form.webhookPath ?? ""} onChange={(e) => setForm({ ...form, webhookPath: e.target.value })} />
            </Field>
          </div>
        </details>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>

      <div className="card">
        <div className="display-s" style={{ marginBottom: 12, fontSize: 18 }}>What this does</div>
        <ul className="muted body-s" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Lets parents pay fees from the parent portal via UPI / card / netbanking.</li>
          <li>Settlement goes directly to your bank account (Crestly is the integration, never custodian).</li>
          <li>API key is encrypted at rest with a server-held KEK; rotating it requires a fresh "Save".</li>
        </ul>
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
