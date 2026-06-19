import { useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useReceiptDetail } from "./hooks";
import type { FeePaymentMethod, ReceiptPrint } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function padSr(n: number): string { return String(n).padStart(4, "0"); }
function methodLabel(m: FeePaymentMethod): string {
  switch (m) {
    case "cash":          return "Cash";
    case "upi":           return "UPI";
    case "bank_transfer": return "Bank transfer";
    case "cheque":        return "Cheque";
    case "card":          return "Card";
    case "other":         return "Other";
  }
}
function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date}, ${time}`;
}

/** Convert paise/rupees integer to Indian-style English words. Mirrors PHP inr_words(). */
function inrWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
                "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
                "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const underHundred = (x: number): string => {
    if (x < 20) return ones[x] ?? "";
    const t = Math.floor(x / 10);
    const o = x % 10;
    return (tens[t] ?? "") + (o ? " " + ones[o] : "");
  };
  const underThousand = (x: number): string => {
    const h = Math.floor(x / 100);
    const r = x % 100;
    const out: string[] = [];
    if (h) out.push((ones[h] ?? "") + " Hundred");
    if (r) out.push(underHundred(r));
    return out.join(" ");
  };
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh  = Math.floor(n / 100_000);    n %= 100_000;
  const thou  = Math.floor(n / 1_000);      n %= 1_000;
  const rest  = n;
  const parts: string[] = [];
  if (crore) parts.push(underThousand(crore) + " Crore");
  if (lakh)  parts.push(underThousand(lakh)  + " Lakh");
  if (thou)  parts.push(underThousand(thou)  + " Thousand");
  if (rest)  parts.push(underThousand(rest));
  return parts.join(" ");
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const auto = params.get("auto") === "1";

  const paymentId = Number(id);
  const { data, isLoading, error } = useReceiptDetail(paymentId);

  // Auto-fire window.print once the data has loaded (matches PHP `?auto=1`).
  useEffect(() => {
    if (!auto || !data) return;
    const t = setTimeout(() => window.print(), 250);
    return () => clearTimeout(t);
  }, [auto, data]);

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "Geist, system-ui" }}>
        Loading receipt…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "Geist, system-ui" }}>
        <h2>Receipt not found</h2>
        <p>No payment with id #{paymentId}.</p>
        <Link to="/fee-ledger/receipts">← Back to receipts</Link>
      </div>
    );
  }

  return (
    <>
      <style>{RECEIPT_CSS}</style>

      {/* On-screen toolbar (hidden when printing) */}
      <div className="toolbar no-print">
        <div className="left">
          <Link className="btn" to="/fee-ledger/receipts">← Receipts</Link>
          <Link className="btn" to={`/fee-ledger/student/${data.srNumber}`}>View student</Link>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={() => window.print()}>
          <PrintIcon /> Print
        </button>
      </div>

      <div className="sheet">
        <Copy data={data} label="Parent copy" tag="parent" />
        <Copy data={data} label="School copy" tag="school" />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One A5 half — rendered twice on the sheet (parent + school)         */
/* ------------------------------------------------------------------ */

function Copy({ data, label, tag }: { data: ReceiptPrint; label: string; tag: "parent" | "school" }) {
  const cls = `${data.class}-${data.section}`;
  const amountWords = inrWords(data.amount) + " Rupees Only";

  return (
    <div className="copy">
      {data.isVoided && <div className="voided-stamp">VOIDED</div>}

      <div className="head">
        <BrandSvg />
        <div>
          <div className="head__name">{data.schoolName}</div>
          <div className="head__addr">
            {data.schoolAddress}
            {data.schoolBoard && <> · {data.schoolBoard}</>}
          </div>
        </div>
        <div className={`head__copy ${tag === "school" ? "head__copy--school" : ""}`}>{label}</div>
      </div>

      <div className="title">Fee Receipt · Session {data.sessionCode}</div>

      <div className="receipt-meta">
        <Meta k="Receipt no." v={<span className="mono">{data.receiptNo}</span>} />
        <Meta k="Date" v={fmtDay(data.paidOn)} />
        <Meta
          k="Student"
          v={
            <>
              {data.studentName}
              {data.isHostel && (
                <span style={{ background: "#dbeafe", color: "#1e40af", padding: "1px 6px", borderRadius: 3, fontSize: 9, fontWeight: 600, marginLeft: 4 }}>
                  HOSTEL
                </span>
              )}
            </>
          }
        />
        <Meta k="Class · SR" v={`${cls} · SR ${padSr(data.srNumber)}`} />
        {data.fatherName && <Meta k="Father" v={data.fatherName} />}
        <Meta
          k="Method"
          v={
            <>
              {methodLabel(data.method)}
              {data.reference && (
                <span className="mono" style={{ fontSize: 10, color: "rgba(16,13,10,0.55)", marginLeft: 4 }}>
                  · {data.reference}
                </span>
              )}
            </>
          }
        />
      </div>

      <table className="rcpt">
        <thead>
          <tr>
            <th>Description</th>
            <th style={{ textAlign: "right", width: 100 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Fee payment · Session {data.sessionCode}</td>
            <td className="amt">{money(data.amount)}</td>
          </tr>
          {data.notes && (
            <tr>
              <td colSpan={2} style={{ fontSize: 10, color: "rgba(16,13,10,0.6)" }}>{data.notes}</td>
            </tr>
          )}
          <tr className="total">
            <td>Total credited</td>
            <td className="amt">{money(data.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="words">
        <b>In words:</b> {amountWords}
      </div>

      <div className="running">
        <div>
          <div className="k">Annual total</div>
          <div className="v">{money(data.totalThisYear)}</div>
        </div>
        <div>
          <div className="k">Paid to date</div>
          <div className="v" style={{ color: "#1f6f4a" }}>{money(data.totalPaid)}</div>
        </div>
        <div>
          <div className="k">Outstanding</div>
          <div className="v" style={{ color: data.totalDue > 0 ? "#c42828" : "rgba(16,13,10,0.4)" }}>
            {money(data.totalDue)}
          </div>
        </div>
      </div>

      <div className="sign-block">
        <div className="sign-block__cell">Authorised signatory</div>
        <div className="sign-block__cell">{tag === "parent" ? "Parent / Guardian signature" : "Receiver signature"}</div>
      </div>

      <div className="footer-mark">
        Crestly ERP · auto-generated · {fmtDateTime(data.createdAt)}
        {data.recordedBy && <> · by {data.recordedBy}</>}
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="receipt-meta__k">{k}</div>
      <div className="receipt-meta__v">{v}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline assets                                                       */
/* ------------------------------------------------------------------ */

function BrandSvg() {
  return (
    <svg width={24} height={24} viewBox="0 0 100 100" aria-hidden="true">
      <rect width={100} height={100} rx={22} fill="#100D0A" />
      <path d="M 80 36 A 34 34 0 1 0 80 68 L 58.25 68 A 18 18 0 1 1 58.25 36 Z" fill="#F5EFE3" fillRule="evenodd" />
      <circle cx={72} cy={78} r={6.5} fill="#F25C19" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={6} y={3} width={12} height={6} />
      <rect x={4} y={9} width={16} height={9} rx={1.5} />
      <rect x={7} y={14} width={10} height={7} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* CSS — verbatim of erp/fee-ledger/receipt.php (scoped to this page) */
/* ------------------------------------------------------------------ */
const RECEIPT_CSS = `
  /* page setup — A5 landscape (210mm × 148mm), two A6 copies side-by-side */
  @page { size: A5 landscape; margin: 6mm; }
  body {
    margin: 0; padding: 14px;
    font-family: 'Geist', system-ui, sans-serif;
    color: #100D0A;
    background: #F5EFE3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Hide the app shell when on the print route — the layout below assumes
     it's the only visible chrome. */
  .app__nav, .app-credit, .topbar, .scrim { display: none !important; }
  .app, .app__main { display: block !important; padding: 0 !important; background: #F5EFE3 !important; }

  /* On-screen toolbar (hidden when printing) */
  .toolbar {
    max-width: 800px; margin: 0 auto 14px;
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  }
  .toolbar .left { display: flex; align-items: center; gap: 10px; }
  .toolbar a { text-decoration: none; color: #100D0A; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 999px;
    font-weight: 600; font-size: 13px;
    border: 1px solid rgba(16,13,10,0.15);
    background: #FFF; cursor: pointer;
  }
  .btn--primary { background: #F25C19; color: #FFF; border-color: #F25C19; }
  .btn--primary:hover { background: #d94f10; }
  .btn:hover { background: #f5efe3; }
  @media print {
    .toolbar, .no-print { display: none !important; }
    body { background: #FFF; padding: 0; }
  }

  /* A5 landscape sheet (2 columns) */
  .sheet {
    max-width: 297mm;
    margin: 0 auto;
    background: #FFF;
    box-shadow: 0 8px 24px -10px rgba(0,0,0,0.15);
    border-radius: 4px;
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  @media print {
    .sheet { box-shadow: none; max-width: none; border-radius: 0; }
  }

  .copy {
    padding: 6mm 7mm 5mm;
    page-break-inside: avoid;
    break-inside: avoid;
    position: relative;
  }
  .copy + .copy { border-left: 1px dashed rgba(16,13,10,0.35); }
  .copy + .copy::before {
    content: '✂';
    position: absolute;
    left: -7px; top: 50%;
    transform: translateY(-50%);
    background: #FFF; color: rgba(16,13,10,0.5);
    font-size: 11px; padding: 4px 0;
    writing-mode: horizontal-tb;
  }

  @media (max-width: 800px) {
    .sheet { grid-template-columns: 1fr; }
    .copy + .copy { border-left: 0; border-top: 1px dashed rgba(16,13,10,0.35); }
    .copy + .copy::before { left: 50%; top: -7px; transform: translateX(-50%); }
  }

  .head {
    display: grid;
    grid-template-columns: 24px 1fr auto;
    gap: 8px; align-items: center;
    padding-bottom: 5px; margin-bottom: 7px;
    border-bottom: 1.5px solid #100D0A;
  }
  .head svg { width: 24px; height: 24px; }
  .head__name { font-family: 'Geist', sans-serif; font-weight: 800; font-size: 12.5px; letter-spacing: -0.01em; line-height: 1.05; }
  .head__addr { font-size: 7.5px; color: rgba(16,13,10,0.6); margin-top: 1px; line-height: 1.25; }
  .head__copy {
    font-family: 'Geist Mono', monospace; font-size: 7.5px; letter-spacing: 0.14em;
    padding: 2px 6px; border: 1.25px solid #100D0A; border-radius: 2px;
    background: #F5EFE3; text-transform: uppercase; font-weight: 700;
  }
  .head__copy--school { background: #100D0A; color: #F5EFE3; }

  .receipt-meta {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px;
    margin-bottom: 6px;
  }
  .receipt-meta__k { color: rgba(16,13,10,0.55); font-family: 'Geist Mono', monospace; font-size: 7px; letter-spacing: 0.08em; text-transform: uppercase; }
  .receipt-meta__v { font-weight: 600; font-size: 10px; line-height: 1.2; }

  .title {
    font-family: 'Geist', sans-serif; font-weight: 700; font-size: 9.5px;
    text-align: center; letter-spacing: 0.2em; text-transform: uppercase;
    margin: 4px 0 6px;
    padding: 3px 0;
    background: #F5EFE3;
    border-radius: 2px;
  }

  table.rcpt {
    width: 100%; border-collapse: collapse; font-size: 10px;
    margin-top: 2px;
  }
  .rcpt th, .rcpt td {
    padding: 3px 5px; text-align: left;
    border-bottom: 1px solid rgba(16,13,10,0.1);
  }
  .rcpt th {
    font-family: 'Geist Mono', monospace; font-size: 7px;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(16,13,10,0.6); background: #F5EFE3;
  }
  .rcpt td.amt { text-align: right; font-family: 'Geist Mono', monospace; font-weight: 600; }
  .rcpt tr.total td {
    background: #100D0A; color: #F5EFE3;
    font-weight: 700; font-size: 11px;
    border-bottom: 0;
    padding: 4px 5px;
  }

  .words {
    margin-top: 5px; padding: 4px 8px;
    background: #F5EFE3;
    font-size: 9px;
    line-height: 1.3;
  }
  .words b { letter-spacing: 0.04em; }

  .running {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
    margin-top: 6px;
  }
  .running .k { color: rgba(16,13,10,0.55); font-family: 'Geist Mono', monospace; font-size: 7px; letter-spacing: 0.08em; text-transform: uppercase; }
  .running .v { font-weight: 600; font-size: 10px; margin-top: 1px; line-height: 1.1; }

  .sign-block {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin-top: 14px; padding-top: 6px;
    font-size: 7.5px; color: rgba(16,13,10,0.6);
  }
  .sign-block__cell { border-top: 1px solid rgba(16,13,10,0.3); padding-top: 3px; text-align: center; }

  .footer-mark {
    margin-top: 5px;
    font-size: 6.5px; color: rgba(16,13,10,0.5); text-align: center;
    font-family: 'Geist Mono', monospace; letter-spacing: 0.06em;
  }

  .voided-stamp {
    position: absolute;
    top: 38%; left: 50%;
    transform: translate(-50%, -50%) rotate(-14deg);
    font-family: 'Geist', sans-serif; font-weight: 800; font-size: 32px;
    color: rgba(196,40,40,0.2);
    border: 4px solid rgba(196,40,40,0.2); padding: 4px 18px;
    letter-spacing: 0.08em;
    pointer-events: none;
    z-index: 1;
  }
`;
