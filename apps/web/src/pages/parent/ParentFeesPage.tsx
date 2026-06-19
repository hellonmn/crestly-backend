import { KidPills, useActiveSr } from "./_layout/KidPills";
import { useParentFees, useParentHome } from "./hooks";
import { Icon } from "@crestly/icons";

function rs(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }

const STATUS_TONE: Record<string, string> = {
  paid:    "pill--success",
  partial: "pill--warn",
  pending: "pill--info",
  overdue: "pill--error",
};

export function ParentFeesPage() {
  const { data: home } = useParentHome();
  const kids = home?.kids ?? [];
  const sr = useActiveSr(kids);
  const { data, isLoading } = useParentFees(sr);

  const pct = data && data.totalCharged > 0
    ? Math.round((data.paidAmount / data.totalCharged) * 100)
    : 0;

  return (
    <div className="pf">
      <h1 className="pf__title">Fees</h1>
      <KidPills kids={kids} />

      {isLoading && <div className="muted">Loading…</div>}

      {data && (
        <>
          <section className="pf__summary">
            <Icon name="rupee" size={20} />
            <div className="pf__sum-body">
              <div className="muted body-s">
                {data.dueAmount > 0 ? "Outstanding due" : "Status"}
              </div>
              <div className="pf__sum-amt">
                {data.dueAmount > 0 ? rs(data.dueAmount) : "All clear ✓"}
              </div>
              <span className={`pill ${STATUS_TONE[data.status] ?? "pill--neutral"}`}>
                {data.status.toUpperCase()}
              </span>
            </div>
          </section>

          <div className="pf__progress">
            <div className="pf__progress-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div className="muted body-s pf__progress-label">
              {rs(data.paidAmount)} paid of {rs(data.totalCharged)} ({pct}%)
            </div>
          </div>

          {data.breakdown.length > 0 && (
            <section className="pf__sec">
              <h2 className="pf__h">Fee breakdown</h2>
              {data.breakdown.map((b) => (
                <div key={b.label} className="pf__row">
                  <span>{b.label}</span>
                  <span className="mono">{rs(b.amount)}</span>
                </div>
              ))}
              <div className="pf__row pf__row--total">
                <span>Total charged</span>
                <span className="mono">{rs(data.totalCharged)}</span>
              </div>
            </section>
          )}

          <section className="pf__sec">
            <h2 className="pf__h">Payment history</h2>
            {data.payments.length === 0 ? (
              <div className="muted body-s">No payments recorded yet.</div>
            ) : (
              data.payments.map((p) => (
                <div key={p.id} className="pf__pay">
                  <Icon name="check" size={14} />
                  <div className="pf__pay-body">
                    <div className="pf__pay-amt">{rs(p.amount)}</div>
                    <div className="muted body-s">
                      {p.receiptNo} · {fmtDate(p.paidOn)} · {p.method.replace("_", " ")}
                      {p.recordedBy && ` · by ${p.recordedBy}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      <style>{PF_CSS}</style>
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const PF_CSS = `
  .pf { max-width: 720px; margin: 0 auto; padding: 22px 18px 32px; }
  .pf__title { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; letter-spacing: -.02em; margin: 0 0 14px; }
  .pf__h { font-family: var(--font-mono, monospace); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-60); margin: 0 0 10px; }

  .pf__summary {
    display: flex; align-items: center; gap: 14px;
    background: var(--white); border: 1px solid var(--rule); border-radius: 14px;
    padding: 16px; margin-bottom: 12px;
  }
  .pf__summary > svg { color: var(--orange-deep, var(--orange)); flex-shrink: 0; }
  .pf__sum-amt { font-family: var(--font-display, system-ui); font-weight: 800; font-size: 22px; }

  .pf__progress { margin-bottom: 18px; }
  .pf__progress-bar { background: var(--cream-soft); border-radius: 999px; height: 8px; overflow: hidden; }
  .pf__progress-bar span { display: block; height: 100%; background: var(--orange); border-radius: 999px; transition: width .3s ease; }
  .pf__progress-label { margin-top: 6px; }

  .pf__sec { background: var(--white); border: 1px solid var(--rule); border-radius: 14px; padding: 14px; margin-bottom: 12px; }
  .pf__row {
    display: flex; justify-content: space-between;
    padding: 8px 0; border-bottom: 1px dashed var(--rule-soft);
    font-size: 13px;
  }
  .pf__row:last-of-type { border-bottom: 0; }
  .pf__row--total {
    margin-top: 4px; border-top: 1px solid var(--rule); border-bottom: 0;
    font-weight: 700; padding-top: 10px;
  }
  .pf__pay {
    display: flex; gap: 10px; align-items: center;
    padding: 10px 0; border-bottom: 1px dashed var(--rule-soft);
  }
  .pf__pay:last-child { border-bottom: 0; }
  .pf__pay > svg { color: var(--success, #16a34a); flex-shrink: 0; }
  .pf__pay-amt { font-weight: 700; color: var(--success, #16a34a); }
`;
