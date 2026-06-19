import { useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { useDailyReport } from "./hooks";

function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n: number) { return `₹${n.toLocaleString("en-IN")}`; }

export function DailyReportPage() {
  const [date, setDate] = useState(today());
  const { data, isLoading } = useDailyReport(date);

  function shift(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <>
      <PageHead
        group="FINANCE"
        meta={date}
        title="Daily Report"
        lede="Single-day cash position by payment method. Receipts in, vouchers out."
        actions={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(-1)}>‹ Prev</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDate(today())}>Today</button>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(1)}>Next ›</button>
            <button className="btn btn--primary btn--sm" onClick={() => window.print()}>
              <Icon name="print" size={14} /> Print
            </button>
          </>
        }
      />

      <div className="toolbar card">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 200 }} />
      </div>

      {isLoading && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="grid grid--cols-3 grid--gap-sm">
            <StatTile tint="mint" icon="rupee" label="COLLECTION" value={fmt(data.totalCollection)} delta={`${data.receipts.length} receipts`} />
            <StatTile tint="rose" icon="rupee" label="EXPENSES" value={fmt(data.totalExpenses)} delta={`${data.vouchers.length} vouchers`} />
            <StatTile tint="mustard" icon="rupee" label="NET FLOW" value={fmt(data.netFlow)} delta={data.netFlow >= 0 ? "surplus" : "deficit"} />
          </div>

          <div className="card">
            <div className="display-s" style={{ marginBottom: 12 }}>Cash position</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Opening</th>
                  <th>+ Collection</th>
                  <th>− Expenses</th>
                  <th>Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.cashPosition.map((r) => (
                  <tr key={r.method}>
                    <td>{r.method}</td>
                    <td className="mono">{fmt(r.opening)}</td>
                    <td className="mono" style={{ color: r.collection > 0 ? "var(--success)" : "var(--ink-40)" }}>{fmt(r.collection)}</td>
                    <td className="mono" style={{ color: r.expenses > 0 ? "var(--error)" : "var(--ink-40)" }}>{fmt(r.expenses)}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmt(r.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid--split grid--gap-lg">
            <div className="card">
              <div className="display-s" style={{ marginBottom: 12 }}>Fee receipts</div>
              {data.receipts.length === 0 ? (
                <p className="muted">No receipts today.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Receipt</th><th>Student</th><th>Method</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {data.receipts.map((r) => (
                      <tr key={r.receiptNo}>
                        <td className="mono">{r.receiptNo}</td>
                        <td>
                          <div className="td-name">{r.studentName}</div>
                          <div className="muted body-s"><span className="cls-pill">{r.class}-{r.section}</span></div>
                        </td>
                        <td className="muted">{r.method}{r.reference ? ` · ${r.reference}` : ""}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>{fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <div className="display-s" style={{ marginBottom: 12 }}>Vouchers paid</div>
              {data.vouchers.length === 0 ? (
                <p className="muted">No vouchers paid today.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>No.</th><th>Title</th><th>Vendor / Ref</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {data.vouchers.map((v) => (
                      <tr key={v.voucherNo}>
                        <td className="mono">{v.voucherNo}</td>
                        <td>{v.title}</td>
                        <td className="muted">{v.vendor ?? "—"} {v.reference ? `· ${v.reference}` : ""}</td>
                        <td className="mono" style={{ fontWeight: 600 }}>{fmt(v.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
