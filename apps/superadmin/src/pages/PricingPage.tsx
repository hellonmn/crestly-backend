import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { api, getErrorMessage } from "@/lib/api";
import type { PricingStrategy, PricingTier } from "@crestly/shared";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

const blankTier: PricingTier = {
  key: "", label: "", monthly: 0, description: null, features: [], highlighted: false,
};

export function PricingPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["super", "pricing"],
    queryFn: async () => (await api.get<PricingStrategy>("/superadmin/pricing-strategy")).data,
  });
  const save = useMutation({
    mutationFn: async (input: PricingStrategy) =>
      (await api.put<PricingStrategy>("/superadmin/pricing-strategy", input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["super", "pricing"] }),
  });

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (data) setTiers(data.tiers); }, [data]);

  function update(i: number, patch: Partial<PricingTier>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) { setTiers((prev) => prev.filter((_, idx) => idx !== i)); }
  function add() { setTiers((prev) => [...prev, { ...blankTier, key: `tier-${prev.length + 1}` }]); }

  async function onSave() {
    setMsg(null); setErr(null);
    try { await save.mutateAsync({ tiers }); setMsg("Saved."); }
    catch (e) { setErr(getErrorMessage(e, "Save failed")); }
  }

  return (
    <>
      <PageHead
        group="CATALOG"
        title="Pricing strategy"
        lede="Tier definitions for the public-facing pricing page."
        actions={
          <>
            <button className="btn btn--ghost btn--sm" onClick={add}>
              <Icon name="plus" size={14} /> Add tier
            </button>
            <button className="btn btn--primary btn--sm" disabled={save.isPending} onClick={onSave}>
              {save.isPending ? "Saving…" : "Save tiers"}
            </button>
          </>
        }
      />

      {msg && <div className="banner banner--success"><Icon name="check" size={14} /><span>{msg}</span></div>}
      {err && <div className="banner banner--error"><Icon name="alert" size={14} /><span>{err}</span></div>}

      <div className="grid grid--cols-3 grid--gap-sm">
        {tiers.map((t, i) => (
          <div key={i} className="card" style={{ borderColor: t.highlighted ? "var(--orange)" : "var(--rule)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <input
                className="display-s"
                value={t.label}
                onChange={(e) => update(i, { label: e.target.value })}
                style={{ fontSize: 22, border: 0, background: "transparent", padding: 0, outline: "none", width: "100%" }}
                placeholder="Tier name"
              />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(i)}>
                <Icon name="x" size={12} />
              </button>
            </div>
            <Field label="Key (slug)"><input className="input mono" value={t.key} onChange={(e) => update(i, { key: e.target.value })} /></Field>
            <Field label="Monthly (₹)">
              <input className="input mono" type="number" value={String(t.monthly)} onChange={(e) => update(i, { monthly: Number(e.target.value || 0) })} />
              <span className="field__hint">{fmt(t.monthly)} / month</span>
            </Field>
            <Field label="Tagline">
              <input className="input" value={t.description ?? ""} onChange={(e) => update(i, { description: e.target.value || null })} />
            </Field>
            <Field label="Features (comma-separated)">
              <input className="input mono" value={t.features.join(", ")} onChange={(e) => update(i, { features: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
            </Field>
            <label className="check">
              <input type="checkbox" checked={t.highlighted} onChange={(e) => update(i, { highlighted: e.target.checked })} />
              Highlight tier
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field" style={{ marginTop: 8 }}>
      <label className="field__label">{label}</label>
      {children}
    </div>
  );
}
