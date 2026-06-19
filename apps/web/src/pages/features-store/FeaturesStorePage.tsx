import { useEffect, useMemo, useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import { useCreateFeatureOrder, useFeaturesCatalog, useVerifyFeaturePayment } from "./hooks";

declare global {
  interface Window { Razorpay?: any }
}

const RZP_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

/**
 * Per-school "Upgrade Plan" page. Lists every catalog feature; admins can
 * purchase one via Razorpay Checkout. After verify, the feature flips on
 * for this school and the gated nav entries appear.
 */
export function FeaturesStorePage() {
  const { user } = useAuth();
  const isAdmin = user?.roleSlug === "admin";
  const { data, isLoading } = useFeaturesCatalog();
  const createOrder = useCreateFeatureOrder();
  const verify = useVerifyFeaturePayment();

  const [scriptReady, setScriptReady] = useState(typeof window !== "undefined" && !!window.Razorpay);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (scriptReady) return;
    if (document.querySelector(`script[src="${RZP_SCRIPT}"]`)) { setScriptReady(true); return; }
    const s = document.createElement("script");
    s.src = RZP_SCRIPT;
    s.async = true;
    s.onload = () => setScriptReady(true);
    document.head.appendChild(s);
  }, [scriptReady]);

  const grouped = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>["features"]>();
    for (const f of data?.features ?? []) {
      const arr = m.get(f.category) ?? [];
      arr.push(f);
      m.set(f.category, arr);
    }
    return Array.from(m.entries());
  }, [data]);

  async function buy(featureKey: string) {
    setErr(null); setMsg(null);
    if (!scriptReady || !window.Razorpay) {
      setErr("Payment script is still loading. Try again in a moment.");
      return;
    }
    setBusyKey(featureKey);
    try {
      const order = await createOrder.mutateAsync(featureKey);
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Crestly",
        description: order.featureLabel,
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await verify.mutateAsync({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            setMsg(`Enabled ${order.featureLabel}.`);
          } catch (e) { setErr(getErrorMessage(e, "Payment verification failed")); }
          finally { setBusyKey(null); }
        },
        modal: { ondismiss: () => setBusyKey(null) },
      });
      rzp.open();
    } catch (e) {
      setErr(getErrorMessage(e, "Could not start checkout"));
      setBusyKey(null);
    }
  }

  return (
    <>
      <PageHead
        group="SYSTEM"
        title="Upgrade Plan"
        lede={data ? `${data.features.filter((f) => f.enabled).length} active modules · ${fmt(data.monthlyTotal)}/month` : "Loading…"}
      />

      {!isAdmin && (
        <div className="banner banner--info">
          <Icon name="info" size={16} />
          <span>Only admins can purchase modules. You can still see what's available.</span>
        </div>
      )}

      {msg && <div className="banner banner--success"><Icon name="check" size={16} /><span>{msg}</span></div>}
      {err && <div className="banner banner--error"><Icon name="alert" size={16} /><span>{err}</span></div>}

      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile tint="mustard" icon="features" label="ACTIVE MODULES" value={String(data?.features.filter((f) => f.enabled).length ?? "—")} delta={data?.managed ? "managed" : "grandfathered"} />
        <StatTile tint="rose" icon="rupee" label="MONTHLY TOTAL" value={data ? fmt(data.monthlyTotal) : "—"} delta="non-core" />
        <StatTile tint="mint" icon="check" label="CORE (FREE)" value={String(data?.features.filter((f) => f.isCore).length ?? "—")} delta="always on" />
      </div>

      {isLoading && <p className="muted">Loading…</p>}

      {grouped.map(([category, list]) => (
        <div key={category}>
          <div className="label" style={{ marginTop: 12, marginBottom: 8, color: "var(--ink-40)" }}>{category.toUpperCase()}</div>
          <div className="grid grid--cols-3 grid--gap-sm">
            {list.map((f) => (
              <div key={f.featureKey} className="card">
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <div className="display-s" style={{ fontSize: 16 }}>{f.label}</div>
                  {f.isCore && <span className="pill pill--success">CORE</span>}
                </div>
                {f.description && <p className="muted body-s" style={{ marginTop: 0 }}>{f.description}</p>}
                {f.benefit && <p className="body-s" style={{ marginTop: 4 }}>💡 {f.benefit}</p>}
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className="mono">
                    {f.isCore ? "Free" : `${fmt(f.monthlyPrice)}/mo`}
                  </span>
                  {f.enabled ? (
                    <span className="pill pill--success"><span className="pill__dot" />ACTIVE</span>
                  ) : isAdmin && !f.isCore ? (
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => buy(f.featureKey)}
                      disabled={busyKey === f.featureKey}
                    >
                      {busyKey === f.featureKey ? "Opening…" : "Enable & pay"}
                    </button>
                  ) : (
                    <span className="muted body-s">disabled</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
