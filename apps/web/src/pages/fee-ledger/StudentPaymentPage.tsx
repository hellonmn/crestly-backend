import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useCreateCheckout, useRecordPayment, useStudentFee, useVoidPayment } from "./hooks";
import type { CheckoutSession } from "@crestly/shared";
import { getErrorMessage } from "@/lib/api";
import type { FeePaymentMethod, FeePaymentStatus } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2).replace(/\.?0+$/, "")} Cr`;
  if (a >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2).replace(/\.?0+$/, "")} L`;
  if (a >= 1_000)       return `₹${(n / 1_000).toFixed(1).replace(/\.?0+$/, "")} K`;
  return money(n);
}
function padSr(n: number): string { return String(n).padStart(4, "0"); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}
function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function pctOf(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10;
}
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
function statusMeta(pay: FeePaymentStatus, due: number): { cls: string; label: string } {
  if (pay === "paid")                       return { cls: "pill--success", label: "Paid" };
  if (pay === "partial")                    return { cls: "pill--info",    label: "Partial" };
  if (pay === "overdue")                    return { cls: "pill--error",   label: "Overdue" };
  if (pay === "pending" && due > 0)         return { cls: "pill--warn",    label: "Pending" };
  return { cls: "pill--neutral", label: pay.charAt(0).toUpperCase() + pay.slice(1) };
}

const METHODS: FeePaymentMethod[] = ["cash", "upi", "bank_transfer", "cheque", "card", "other"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StudentPaymentPage() {
  const { srNumber } = useParams<{ srNumber: string }>();
  const sr = Number(srNumber);
  const { data, isLoading, error } = useStudentFee(sr);
  const record = useRecordPayment(sr);
  const voidPayment = useVoidPayment(sr);

  // Form state
  const [amount, setAmount]       = useState("");
  const [paidOn, setPaidOn]       = useState(today());
  const [method, setMethod]       = useState<FeePaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes]         = useState("");
  const [recordedBy, setRecordedBy] = useState("Admin");

  // Field-level errors mirror PHP's $errors map.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalErr, setGlobalErr]     = useState<string | null>(null);
  const [flash, setFlash]             = useState<string | null>(null);

  // Mark <body> so the mobile sticky-cta CSS reserves bottom space.
  useEffect(() => {
    document.body.classList.add("has-sticky-cta");
    return () => { document.body.classList.remove("has-sticky-cta"); };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const errs: Record<string, string> = {};
    const n = Number(amount.replace(/[^0-9]/g, ""));
    if (!n || n <= 0)                          errs.amount  = "Enter an amount > 0.";
    else if (n > data.dueAmount + 1000)        errs.amount  = "Amount exceeds due by more than ₹1,000. Reduce or split.";
    if (!paidOn || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn))  errs.paid_on = "Invalid date.";
    if (!METHODS.includes(method))             errs.method  = "Pick a method.";
    if (reference.length > 64)                 errs.reference = "Max 64 chars.";
    if (notes.length > 255)                    errs.notes     = "Max 255 chars.";

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setGlobalErr(null);
      return;
    }
    setFieldErrors({});
    setGlobalErr(null);
    setFlash(null);
    try {
      await record.mutateAsync({
        amount: n,
        paidOn,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      setFlash(`Payment of ${money(n)} recorded. Receipt generated below.`);
      setAmount("");
      setReference("");
      setNotes("");
    } catch (e) {
      setGlobalErr(getErrorMessage(e, "Save failed"));
    }
  }

  async function onVoid(paymentId: number, receiptNo: string, amt: number) {
    if (!confirm(`Void payment ${receiptNo} for ${money(amt)}?\n\nTotals will be recomputed. The row stays in history for audit.`)) return;
    const reason = prompt("Reason (optional)", "") ?? "";
    try {
      await voidPayment.mutateAsync({ paymentId, reason: reason || undefined });
      setFlash(`Payment ${receiptNo} voided. Totals recomputed automatically.`);
    } catch (e) {
      setGlobalErr(getErrorMessage(e, "Void failed"));
    }
  }

  // Derived values
  const pct = useMemo(() => pctOf(data?.paidAmount ?? 0, data?.totalThisYear ?? 0), [data]);
  const status = data ? statusMeta(data.paymentStatus, data.dueAmount) : null;
  const activePayments = data?.payments.filter((p) => !p.isVoided).length ?? 0;
  const voidedPayments = data?.payments.filter((p) =>  p.isVoided).length ?? 0;

  // Quick-amount chips: distinct positive values from quarterly / monthly / due.
  const quickAmts = useMemo(() => {
    if (!data) return [] as number[];
    const seen = new Set<number>();
    const out: number[] = [];
    [data.quarterlyInstallment, data.monthlyEmi, data.dueAmount].forEach((v) => {
      const n = Math.max(0, Math.round(v));
      if (n > 0 && !seen.has(n)) { seen.add(n); out.push(n); }
    });
    return out;
  }, [data]);

  if (isLoading) {
    return (
      <>
        <PageHead group="FINANCE" meta="FEE LEDGER" title="Loading…" />
        <div className="card"><Skeleton.Title width="50%" /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="FINANCE" meta="FEE LEDGER" title="Not found" lede={`No student with SR #${padSr(sr)}.`} />
        <Link to="/fee-ledger" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to ledger
        </Link>
      </>
    );
  }

  return (
    <>
      <style>{PAY_CSS}</style>

      {globalErr && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span><b>Save failed:</b> {globalErr}</span>
        </div>
      )}
      {Object.keys(fieldErrors).length > 0 && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>
            <b>Check the highlighted fields</b> — {Object.keys(fieldErrors).length} issue
            {Object.keys(fieldErrors).length > 1 ? "s" : ""}.
          </span>
        </div>
      )}
      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} />
          <span>{flash}</span>
        </div>
      )}

      {/* Mobile back chip */}
      <Link to="/fee-ledger" className="m-back-link m-show">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Ledger</span>
      </Link>

      {/* Desktop page head */}
      <div className="m-hide">
        <PageHead
          group="FINANCE"
          meta={`FEE LEDGER · SR ${padSr(sr)}`}
          title={data.studentName}
          lede={
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
              <span className="cls-pill">{data.class}-{data.section}</span>
              {status && (
                <span className={`pill ${status.cls}`}><span className="pill__dot" />{status.label}</span>
              )}
              <Link to={`/students/${sr}`} className="muted body-s" style={{ textDecoration: "underline" }}>
                View student profile →
              </Link>
            </div>
          }
        />
      </div>

      {/* Mobile hero */}
      <div className="m-hero m-show">
        <div className="m-hero__avi">{initials(data.studentName)}</div>
        <h1 className="m-hero__name">{data.studentName}<BrandDot /></h1>
        <div className="m-hero__meta">
          <span className="cls-pill">{data.class}-{data.section}</span>
          {status && (
            <span className={`pill ${status.cls}`}><span className="pill__dot" />{status.label}</span>
          )}
        </div>
        <div className="muted body-s" style={{ marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em" }}>
          SR {padSr(sr)}
        </div>
      </div>

      {/* ===== Two-column body ===== */}
      <div className="grid grid--split grid--gap-lg" style={{ alignItems: "start" }}>

        {/* LEFT: Form + History */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <form
            id="payment-form"
            className="card"
            style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 18 }}
            onSubmit={onSubmit}
            noValidate
          >
            <div
              className="form-section__head"
              style={{ borderBottom: "1px solid var(--rule-soft)", paddingBottom: 10, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
            >
              <span className="form-section__num" style={{
                background: "var(--ink)", color: "var(--cream)",
                width: 24, height: 24, borderRadius: 6, display: "inline-grid", placeItems: "center",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              }}>01</span>
              <h3 className="form-section__title" style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, flex: 1 }}>
                Record payment
              </h3>
              {data.dueAmount > 0 ? (
                <span className="muted body-s">Due <b style={{ color: "var(--error)" }}>{money(data.dueAmount)}</b></span>
              ) : (
                <span className="muted body-s">Fully paid — extra credit will go to next session.</span>
              )}
            </div>

            <div className="form-grid">
              <div className={`field ${fieldErrors.amount ? "field--error" : ""}`}>
                <label className="field__label field__label--req" htmlFor="amount">Amount (₹)</label>
                <input
                  id="amount"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder={data.dueAmount > 0 ? String(data.dueAmount) : "0"}
                  autoFocus
                />
                {quickAmts.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {quickAmts.map((qa) => (
                      <button
                        type="button"
                        key={qa}
                        className="chip pay-quick"
                        onClick={() => { setAmount(String(qa)); document.getElementById("amount")?.focus(); }}
                      >
                        {money(qa)}
                      </button>
                    ))}
                  </div>
                )}
                {fieldErrors.amount && <span className="field__error">{fieldErrors.amount}</span>}
              </div>

              <div className={`field ${fieldErrors.paid_on ? "field--error" : ""}`}>
                <label className="field__label field__label--req" htmlFor="paid_on">Paid on</label>
                <input
                  id="paid_on"
                  className="input"
                  type="date"
                  value={paidOn}
                  onChange={(e) => setPaidOn(e.target.value)}
                  max={today()}
                />
                {fieldErrors.paid_on && <span className="field__error">{fieldErrors.paid_on}</span>}
              </div>

              <div className={`field ${fieldErrors.method ? "field--error" : ""}`}>
                <label className="field__label field__label--req" htmlFor="method">Method</label>
                <select id="method" className="select" value={method} onChange={(e) => setMethod(e.target.value as FeePaymentMethod)}>
                  {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
                </select>
                {fieldErrors.method && <span className="field__error">{fieldErrors.method}</span>}
              </div>

              <div className={`field ${fieldErrors.reference ? "field--error" : ""}`}>
                <label className="field__label" htmlFor="reference">Reference</label>
                <input
                  id="reference"
                  className="input"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={64}
                  placeholder="UTR / cheque no / txn id"
                />
                {fieldErrors.reference && <span className="field__error">{fieldErrors.reference}</span>}
              </div>

              <div className={`field span-2 ${fieldErrors.notes ? "field--error" : ""}`}>
                <label className="field__label" htmlFor="notes">Notes</label>
                <input
                  id="notes"
                  className="input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={255}
                  placeholder="e.g. Q1 tuition + transport · Apr 2025"
                />
                {fieldErrors.notes && <span className="field__error">{fieldErrors.notes}</span>}
              </div>

              <div className="field">
                <label className="field__label" htmlFor="recorded_by">Recorded by</label>
                <input
                  id="recorded_by"
                  className="input"
                  type="text"
                  value={recordedBy}
                  onChange={(e) => setRecordedBy(e.target.value)}
                  maxLength={64}
                />
              </div>
            </div>

            <div className="m-hide" style={{ display: "flex", gap: 10, paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
              <button type="submit" className="btn btn--success" disabled={record.isPending}>
                {record.isPending ? "Saving…" : "Save payment"}
              </button>
              <Link to="/fee-ledger" className="btn btn--ghost">Cancel</Link>
            </div>
          </form>

          {/* HDFC checkout — let the parent pay online */}
          {data.dueAmount > 0 && (
            <ParentCheckoutPanel sr={sr} dueAmount={data.dueAmount} />
          )}

          {/* History */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <div className="label">PAYMENT HISTORY · {data.sessionCode}</div>
              <span className="muted body-s">
                {activePayments.toLocaleString("en-IN")} active{voidedPayments > 0 && ` · ${voidedPayments} voided`}
              </span>
            </div>

            {data.payments.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: "28px 18px" }}>
                <div className="muted body-s">No payments recorded yet for this session.</div>
              </div>
            ) : (
              <div className="detail-list" style={{ overflow: "visible" }}>
                {data.payments.map((p) => (
                  <div key={p.id} className={`payment-row ${p.isVoided ? "is-voided" : ""}`}>
                    <div className="payment-row__main">
                      <div className="payment-row__amt">
                        {money(p.amount)}
                        {p.isVoided && (
                          <span className="pill pill--neutral" style={{ fontSize: 9, padding: "1px 6px" }}>VOID</span>
                        )}
                      </div>
                      <div className="payment-row__meta">
                        <span>{fmtDay(p.paidOn)}</span>
                        <span>·</span>
                        <span>{methodLabel(p.method)}</span>
                        {p.reference && (<><span>·</span><span className="mono">{p.reference}</span></>)}
                      </div>
                      {p.notes && <div className="payment-row__notes">{p.notes}</div>}
                    </div>
                    <div className="payment-row__side">
                      <div className="mono body-s muted">{p.receiptNo}</div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4, flexWrap: "wrap" }}>
                        <a
                          href={`/print/receipt/${p.id}?auto=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="chip"
                          style={{ fontSize: 10.5, padding: "3px 8px", color: "var(--ink)", textDecoration: "none" }}
                          title="Print receipt"
                        >
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -1 }}>
                            <rect x={6} y={3} width={12} height={6} />
                            <rect x={4} y={9} width={16} height={9} rx={1.5} />
                            <rect x={7} y={14} width={10} height={7} />
                          </svg>{" "}Print
                        </a>
                        {!p.isVoided ? (
                          <button
                            type="button"
                            className="chip"
                            style={{ fontSize: 10.5, padding: "3px 8px", color: "var(--error)" }}
                            onClick={() => onVoid(p.id, p.receiptNo, p.amount)}
                          >
                            Void
                          </button>
                        ) : (
                          <span className="muted body-s" style={{ fontSize: 10.5 }}>
                            voided {p.voidedAt ? fmtDay(p.voidedAt.slice(0, 10)) : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Summary + installments */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>FEE · {data.sessionCode}</div>
            <div className="display-m" style={{ margin: "4px 0", fontSize: 30 }}>
              {compact(data.totalThisYear)}<BrandDot />
            </div>
            <div className="muted body-s" style={{ marginBottom: 14 }}>
              {data.admissionStatus}
              {data.siblingDiscountPct > 0 && (
                <> · {String(data.siblingDiscountPct).replace(/\.?0+$/, "")}% sibling off</>
              )}
            </div>

            <div style={{ height: 8, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginBottom: 14 }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <SummaryStat label="COLLECTED" value={money(data.paidAmount)} color="var(--success)" />
              <SummaryStat label="DUE"       value={money(data.dueAmount)}  color="var(--error)" />
              <SummaryStat label="PROGRESS"  value={`${pct.toFixed(1)}%`} />
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="card">
            <div className="label" style={{ marginBottom: 10 }}>FEE BREAKDOWN</div>
            <div className="detail-list">
              <Row k="Tuition (payable)" v={money(data.tuitionPayable)} mono />
              {data.tuitionDiscount > 0 && (
                <Row k="— Sibling discount" v={`−${money(data.tuitionDiscount)}`} mono />
              )}
              <Row k="Annual charges"  v={money(data.annualCharges)} mono />
              <Row k="Activity fee"    v={money(data.activityFee)}   mono />
              <Row k="Exam fee"        v={money(data.examFee)}       mono />
              <Row
                k="Transport"
                v={data.transportFee > 0 ? `${data.transportSlab ?? "—"} · ${money(data.transportFee)}` : "—"}
              />
              {(data.hostelLodging > 0 || data.hostelMess > 0 || data.hostelCommon > 0 || data.hostelOneTime > 0) && (
                <Row
                  k="Hostel"
                  v={money(data.hostelLodging + data.hostelMess + data.hostelCommon + data.hostelOneTime)}
                  mono
                />
              )}
              {(data.registrationFee + data.admissionFee + data.cautionMoney + data.firstYearExtras) > 0 && (
                <Row
                  k="One-time joining"
                  v={money(data.registrationFee + data.admissionFee + data.cautionMoney + data.firstYearExtras)}
                  mono
                />
              )}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 8 }}>INSTALLMENT OPTIONS</div>
            <div className="grid grid--cols-2 grid--gap-sm">
              <div className="stat-tile" style={{ padding: 12 }}>
                <div className="stat-tile__icon icon-tint-wheat" style={{ width: 32, height: 32 }}>
                  <Icon name="calendar" size={16} />
                </div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Quarterly</div>
                  <div className="stat-tile__value" style={{ fontSize: 16 }}>{money(data.quarterlyInstallment)}</div>
                  <div className="stat-tile__delta">× 4 quarters</div>
                </div>
              </div>
              <div className="stat-tile" style={{ padding: 12 }}>
                <div className="stat-tile__icon icon-tint-mint" style={{ width: 32, height: 32 }}>
                  <Icon name="check" size={16} />
                </div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Monthly EMI</div>
                  <div className="stat-tile__value" style={{ fontSize: 16 }}>{money(data.monthlyEmi)}</div>
                  <div className="stat-tile__delta">× 10 months</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky save bar */}
      <div className="m-sticky-cta m-show">
        <Link to="/fee-ledger" className="btn btn--ghost">Back</Link>
        <button type="submit" form="payment-form" className="btn btn--success" disabled={record.isPending}>
          {record.isPending ? "Saving…" : "Save payment"}
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Parent-checkout panel — admin generates an HDFC pay link            */
/* ------------------------------------------------------------------ */

function ParentCheckoutPanel({ sr, dueAmount }: { sr: number; dueAmount: number }) {
  const create = useCreateCheckout(sr);
  const [amount, setAmount] = useState<string>(String(dueAmount));
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSession(null);
    setCopied(false);
    const n = Number(amount.replace(/[^0-9]/g, ""));
    if (!n || n <= 0) { setErr("Enter an amount > 0."); return; }
    if (n > dueAmount) { setErr(`Amount exceeds outstanding ₹${dueAmount.toLocaleString("en-IN")}.`); return; }
    try {
      const s = await create.mutateAsync({ amount: n, notes: null });
      setSession(s);
    } catch (e) {
      setErr(getErrorMessage(e, "Couldn't create checkout"));
    }
  }

  async function copyLink() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(session.checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers — fall back to manual selection.
    }
  }

  return (
    <div className="card" style={{ padding: 20, marginTop: 16, borderColor: "var(--orange)", background: "rgba(242, 92, 25, 0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Icon name="rupee" size={18} />
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>
          Send parent an online-pay link
        </h3>
        <span className="muted body-s" style={{ marginLeft: "auto" }}>
          HDFC SmartGateway
        </span>
      </div>
      <p className="muted body-s" style={{ margin: "0 0 12px", lineHeight: 1.5 }}>
        Generate a one-tap checkout URL and share it on WhatsApp. The link expires in 15 minutes.
        On successful payment the receipt is created automatically and a WhatsApp confirmation
        is sent to the parent.
      </p>

      {!session && (
        <form onSubmit={onGenerate} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "1 1 200px", minWidth: 180 }}>
            <label className="field__label">Amount (₹)</label>
            <input
              className="input mono"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder={String(dueAmount)}
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={create.isPending}>
            {create.isPending ? "Generating…" : "Generate link"}
          </button>
        </form>
      )}

      {err && (
        <div className="banner banner--error" style={{ marginTop: 10 }}>
          <Icon name="alert" size={14} /><span>{err}</span>
        </div>
      )}

      {session && (
        <div style={{ marginTop: 4, padding: 14, background: "var(--white)", border: "1px solid var(--rule)", borderRadius: 10 }}>
          <div className="label" style={{ marginBottom: 6 }}>CHECKOUT LINK</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code
              className="mono"
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 12px",
                background: "var(--cream-soft)",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                fontSize: 11.5,
                wordBreak: "break-all",
                lineHeight: 1.4,
              }}
            >
              {session.checkoutUrl}
            </code>
            <button type="button" className="btn btn--ghost btn--sm" onClick={copyLink}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <a href={session.checkoutUrl} target="_blank" rel="noopener" className="btn btn--ghost btn--sm">
              Open
            </a>
          </div>
          <div className="muted body-s" style={{ marginTop: 8, fontSize: 11 }}>
            Order <span className="mono">{session.orderId}</span> · expires{" "}
            {new Date(session.expiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
          </div>

          {session.whatsappShareUrl && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a
                href={session.whatsappShareUrl}
                target="_blank"
                rel="noopener"
                className="btn btn--success btn--sm"
              >
                <Icon name="msg" size={14} /> Share on WhatsApp
              </a>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => { setSession(null); setAmount(String(dueAmount)); }}
              >
                Generate another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="detail-row">
      <div className="detail-row__k">{k}</div>
      <div className={`detail-row__v ${mono ? "mono" : ""}`}>{v ?? <span className="muted">—</span>}</div>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, marginTop: 2, color }}>
        {value}
      </div>
    </div>
  );
}

/* Inline CSS — verbatim of erp/fee-ledger/payment.php. */
const PAY_CSS = `
  .payment-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    padding: 12px 14px;
    background: var(--white);
    border: 1px solid var(--rule-soft);
    border-radius: var(--r-3);
    margin-bottom: 6px;
  }
  .payment-row.is-voided { opacity: 0.55; background: var(--cream-soft); }
  .payment-row__amt {
    font-family: var(--font-display); font-weight: 700; font-size: 18px;
    display: flex; align-items: center; gap: 8px;
  }
  .payment-row__meta {
    display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
    font-size: 12px; color: var(--ink-60); margin-top: 2px;
  }
  .payment-row__notes {
    font-size: 12.5px; color: var(--ink-60); margin-top: 4px;
    line-height: 1.5;
  }
  .payment-row__side {
    text-align: right; display: flex; flex-direction: column; align-items: flex-end;
  }
  .pay-quick {
    cursor: pointer; font-size: 11.5px; padding: 5px 10px;
    border: 1px dashed var(--rule-strong); background: var(--cream-soft);
    color: var(--ink); font-family: var(--font-mono);
    border-radius: var(--r-pill);
  }
  .pay-quick:hover { background: var(--orange-tint); border-color: var(--orange); color: var(--orange-deep); }
  .field--error .input,
  .field--error .select { border-color: var(--error); }
  .field__error {
    color: var(--error); font-size: 11.5px; margin-top: 4px; display: inline-block;
  }
  .field__label--req::after {
    content: ' *'; color: var(--error); font-weight: 700;
  }
  @media (max-width: 600px) {
    .payment-row { grid-template-columns: 1fr; }
    .payment-row__side {
      text-align: left; align-items: flex-start;
      flex-direction: row; gap: 12px; justify-content: space-between;
    }
  }
`;
