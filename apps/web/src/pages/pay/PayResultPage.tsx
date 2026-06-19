import { useSearchParams } from "react-router-dom";
import { CrestlyLogo } from "@crestly/icons";
import { Anim } from "@/components/Anim";

/* ============================================================
   Parent-facing payment result pages.
   Standalone — no AppShell, no auth required. HDFC's return URL
   redirects here after success/failure.
   ============================================================ */

export function PaySuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  return (
    <Shell title="Payment received">
      <div style={{ textAlign: "center" }}>
        <Anim name="payment-success" size={160} />
        <h1 style={{ fontSize: 26, margin: "8px 0 8px", fontFamily: "var(--font-display)" }}>
          Payment received
        </h1>
        <p className="muted" style={{ margin: "0 auto", maxWidth: 360, fontSize: 14, lineHeight: 1.5 }}>
          Thank you. Your payment has been credited to the student's account and
          a receipt will be sent on WhatsApp shortly.
        </p>
        {orderId && (
          <div style={refStyle}>
            <div className="label" style={{ color: "var(--ink-40)", marginBottom: 4 }}>REFERENCE</div>
            <div className="mono" style={{ fontSize: 13 }}>{orderId}</div>
          </div>
        )}
        <p className="muted body-s" style={{ marginTop: 18 }}>
          You can close this tab now.
        </p>
      </div>
    </Shell>
  );
}

export function PayFailurePage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  const status  = params.get("status");
  const reason  = params.get("reason");
  return (
    <Shell title="Payment didn't go through">
      <div style={{ textAlign: "center" }}>
        <Anim name="payment-failed" size={160} />
        <h1 style={{ fontSize: 26, margin: "8px 0 8px", fontFamily: "var(--font-display)" }}>
          Payment didn't go through
        </h1>
        <p className="muted" style={{ margin: "0 auto", maxWidth: 380, fontSize: 14, lineHeight: 1.5 }}>
          {reason === "bad-signature"
            ? "We couldn't verify the response from the bank. Please contact the school office and they'll send you a fresh payment link."
            : reason === "missing-order" || reason === "unknown-order"
            ? "The payment link couldn't be matched to an order. It may have expired. Please contact the school office for a fresh link."
            : "Don't worry — no money has been taken. The bank reported the payment as " + (status?.toLowerCase() ?? "failed") + ". You can try again from the school's WhatsApp link."}
        </p>
        {orderId && (
          <div style={refStyle}>
            <div className="label" style={{ color: "var(--ink-40)", marginBottom: 4 }}>REFERENCE</div>
            <div className="mono" style={{ fontSize: 13 }}>{orderId}</div>
          </div>
        )}
        <p className="muted body-s" style={{ marginTop: 18 }}>
          If you're stuck, please contact the school office.
        </p>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* Minimal shell                                                       */
/* ------------------------------------------------------------------ */

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  if (typeof document !== "undefined") document.title = `${title} · Crestly`;
  return (
    <>
      <div style={shellStyle}>
        <div style={cardStyle}>
          <div style={brandStyle}>
            <CrestlyLogo width={28} height={28} />
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, marginLeft: 8 }}>
              Crestly<span style={{ color: "var(--orange)" }}>.</span>
            </span>
          </div>
          {children}
        </div>
      </div>
      <style>{PAY_CSS}</style>
    </>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "20px 16px",
  background: "var(--cream-soft, #FAF6EE)",
  fontFamily: "Geist, system-ui, sans-serif",
};
const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 440,
  background: "#fff",
  border: "1px solid var(--rule, rgba(16,13,10,0.08))",
  borderRadius: 16,
  padding: "32px 28px",
  boxShadow: "0 10px 32px rgba(16,13,10,0.08)",
};
const brandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 24,
  paddingBottom: 18,
  borderBottom: "1px solid var(--rule)",
};
const refStyle: React.CSSProperties = {
  marginTop: 18,
  display: "inline-block",
  padding: "10px 14px",
  background: "var(--cream-soft)",
  border: "1px solid var(--rule)",
  borderRadius: 8,
};

const PAY_CSS = `
  /* Re-import minimal vars so this page renders OK even when the AppShell
     CSS wasn't loaded (e.g. when the user lands here from email). */
  :root {
    --cream-soft: #FAF6EE;
    --rule: rgba(16,13,10,0.08);
    --orange: #F25C19;
    --ink: #100D0A;
    --ink-40: rgba(16,13,10,0.4);
    --success: #1F6F4A;
    --font-display: 'Geist', system-ui, sans-serif;
    --font-mono: ui-monospace, 'Geist Mono', monospace;
  }
  body { margin: 0; }
  .label { font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; }
  .muted { color: var(--ink-40); }
  .body-s { font-size: 12.5px; }
  .mono { font-family: var(--font-mono); }
`;
