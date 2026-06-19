import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import {
  useCancelVoucher, useDecideVoucher, useMarkVoucherPaid, useVoucher,
} from "./hooks";
import type { VoucherApprover, VoucherPaymentMethod, VoucherPaymentStatus, VoucherStatus } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function money(n: number): string { return `₹${n.toLocaleString("en-IN")}`; }
function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtDayTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date}, ${time}`;
}
function fmtMonthYear(ym: string): string {
  const d = new Date(ym + "-01T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(d);
}
function methodLabel(m: VoucherPaymentMethod): string {
  switch (m) {
    case "cash":          return "Cash";
    case "upi":           return "UPI";
    case "bank_transfer": return "Bank transfer";
    case "cheque":        return "Cheque";
    case "card":          return "Card";
    case "other":         return "Other";
  }
}
function today(): string { return new Date().toISOString().slice(0, 10); }
function statusPill(status: VoucherStatus, payment: VoucherPaymentStatus): { cls: string; label: string } {
  if (status === "rejected")          return { cls: "pill--error",   label: "Rejected" };
  if (status === "cancelled")         return { cls: "pill--neutral", label: "Cancelled" };
  if (status === "draft")             return { cls: "pill--neutral", label: "Draft" };
  if (status === "pending_approval")  return { cls: "pill--warn",    label: "Pending" };
  if (payment === "paid")             return { cls: "pill--success", label: "Paid" };
  if (payment === "partial")          return { cls: "pill--info",    label: "Partial" };
  return                                     { cls: "pill--info",    label: "Approved" };
}
function approverPill(s: VoucherApprover["status"]): string {
  if (s === "approved") return "pill--success";
  if (s === "rejected") return "pill--error";
  return "pill--warn";
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function VoucherViewPage() {
  const { id } = useParams<{ id: string }>();
  const voucherId = Number(id);
  const { data, isLoading, error } = useVoucher(voucherId);
  const { user } = useAuth();
  const decide = useDecideVoucher(voucherId);
  const markPaid = useMarkVoucherPaid(voucherId);
  const cancel = useCancelVoucher(voucherId);

  const [openForm, setOpenForm] = useState<"approve" | "reject" | "pay" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [payMethod, setPayMethod] = useState<VoucherPaymentMethod>("bank_transfer");
  const [payDate, setPayDate] = useState(today());
  const [payRef, setPayRef] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHead group="FINANCE" meta="VOUCHERS" title="Loading…" />
        <div className="card"><Skeleton.Title width="50%" /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="FINANCE" meta="VOUCHERS" title="Not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span>No voucher with id #{voucherId}.</span>
        </div>
        <Link to="/vouchers" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>← Back</Link>
      </>
    );
  }

  const me = data.approvers.find((a) => a.approverUserId === user?.id);
  const isCreator = data.createdBy === user?.id;
  const isApprover = !!me;
  const canApprove = isApprover && me?.status === "pending" && data.status === "pending_approval";
  const canPay = data.status === "approved" && data.paymentStatus !== "paid" && !!user?.permissions.includes("vouchers.pay");
  const canCancel = isCreator && data.status === "pending_approval";
  const canEdit = isCreator && data.status === "pending_approval";

  async function onDecide(decision: "approve" | "reject") {
    if (!data) return;
    if (decision === "reject" && !remarks.trim()) { setErr("Reason required to reject."); return; }
    setErr(null);
    try {
      await decide.mutateAsync({ decision, remarks: remarks || null });
      setRemarks(""); setOpenForm(null);
      setFlash(decision === "approve" ? "Approved. Vote recorded." : "Rejected. Voucher closed.");
    } catch (e) { setErr(getErrorMessage(e, "Decision failed")); }
  }

  async function onMarkPaid() {
    setErr(null);
    try {
      await markPaid.mutateAsync({ paymentMethod: payMethod, paymentDate: payDate, paymentRef: payRef || null });
      setPayRef(""); setOpenForm(null);
      setFlash("Marked paid. Creator and approvers notified.");
    } catch (e) { setErr(getErrorMessage(e, "Payment failed")); }
  }

  async function onCancel() {
    if (!confirm("Cancel this voucher?")) return;
    setErr(null);
    try {
      await cancel.mutateAsync();
      setFlash("Cancelled.");
    } catch (e) { setErr(getErrorMessage(e, "Cancel failed")); }
  }

  const pill = statusPill(data.status, data.paymentStatus);

  return (
    <>
      <style>{VIEW_CSS}</style>

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}
      {err && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} /><span><b>Action failed:</b> {err}</span>
        </div>
      )}

      <PageHead
        group="FINANCE"
        meta={`VOUCHERS · ${data.voucherNo}`}
        title={data.title}
        lede={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <span className={`pill ${pill.cls}`}>{pill.label}</span>
            {data.isCreditBill && <span className="pill pill--warn">Credit bill</span>}
            <span className="muted body-s">
              {fmtDay(data.voucherDate)}
              {data.category && <> · {data.category}</>}
              {" "}· by {data.createdByName ?? "—"}
            </span>
          </div>
        }
      />

      {/* ===== Action toolbar ===== */}
      <div className="toolbar card" style={{ padding: "12px 16px" }}>
        <Link to="/vouchers" className="btn btn--ghost btn--sm">← Back</Link>

        {canApprove && (
          <>
            <button type="button" className="btn btn--success btn--sm" onClick={() => { setOpenForm("approve"); setRemarks(""); }}>
              Approve
            </button>
            <button type="button" className="btn btn--danger btn--sm" onClick={() => { setOpenForm("reject"); setRemarks(""); }}>
              Reject
            </button>
          </>
        )}

        {canPay && (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpenForm("pay")}>
            Mark as paid
          </button>
        )}

        <div className="spacer" style={{ flex: 1 }} />

        {canEdit && (
          <Link to={`/vouchers/${data.id}/edit`} className="btn btn--ghost btn--sm">
            <Icon name="edit" size={14} /> Edit
          </Link>
        )}
        {canCancel && (
          <button type="button" className="btn btn--ghost btn--sm" style={{ color: "var(--error)" }} onClick={onCancel}>
            Cancel voucher
          </button>
        )}
      </div>

      {/* ===== Inline action forms ===== */}
      {openForm === "approve" && (
        <form
          className="card"
          style={{ padding: "16px 18px", borderColor: "var(--success)" }}
          onSubmit={(e) => { e.preventDefault(); onDecide("approve"); }}
        >
          <div className="label" style={{ marginBottom: 8 }}>APPROVE · OPTIONAL REMARKS</div>
          <input
            type="text"
            className="input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={255}
            placeholder="Looks good — please pay by 25th"
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn--success" disabled={decide.isPending}>Confirm approve</button>
            <button type="button" className="btn btn--ghost" onClick={() => setOpenForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {openForm === "reject" && (
        <form
          className="card"
          style={{ padding: "16px 18px", borderColor: "var(--error)" }}
          onSubmit={(e) => { e.preventDefault(); onDecide("reject"); }}
        >
          <div className="label" style={{ marginBottom: 8 }}>REJECT · REASON REQUIRED</div>
          <input
            type="text"
            className="input"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={255}
            placeholder="Amount looks too high · need vendor quote"
            required
            autoFocus
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn--danger" disabled={decide.isPending}>Confirm reject</button>
            <button type="button" className="btn btn--ghost" onClick={() => setOpenForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {openForm === "pay" && (
        <form
          className="card"
          style={{ padding: "16px 18px", borderColor: "var(--orange)" }}
          onSubmit={(e) => { e.preventDefault(); onMarkPaid(); }}
        >
          <div className="label" style={{ marginBottom: 8 }}>MARK AS PAID</div>
          <div className="form-grid">
            <div className="field">
              <label className="field__label field__label--req" htmlFor="pm">Method</label>
              <select id="pm" className="select" value={payMethod} onChange={(e) => setPayMethod(e.target.value as VoucherPaymentMethod)}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label field__label--req" htmlFor="pd">Paid on</label>
              <input id="pd" className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} max={today()} />
            </div>
            <div className="field span-2">
              <label className="field__label" htmlFor="pr">Reference</label>
              <input id="pr" className="input" type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} maxLength={80} placeholder="UTR / cheque no / txn id" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="submit" className="btn btn--primary" disabled={markPaid.isPending}>Confirm paid</button>
            <button type="button" className="btn btn--ghost" onClick={() => setOpenForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {/* ===== Two-column body ===== */}
      <div className="grid grid--split grid--gap-lg" style={{ alignItems: "start" }}>

        {/* LEFT: Voucher detail */}
        <div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
              <div>
                <div className="label">AMOUNT</div>
                <div className="display-m" style={{ marginTop: 2, fontSize: 34 }}>{money(data.amount)}<span className="brand-dot">.</span></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">VOUCHER</div>
                <div className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{data.voucherNo}</div>
              </div>
            </div>

            <div className="detail-list">
              {data.description && (
                <div className="detail-row" style={{ gridTemplateColumns: "1fr", gap: 4 }}>
                  <span className="detail-row__k">Description</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {data.description}
                  </span>
                </div>
              )}
              <Row k="Category" v={data.category || "—"} />
              {data.salaryUserId && data.salaryMonth && (
                <div className="detail-row">
                  <span className="detail-row__k">Salary for</span>
                  <span className="detail-row__v">
                    <b>{data.salaryUserName ?? "—"}</b>
                    <div className="muted body-s" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {fmtMonthYear(data.salaryMonth)}
                      {" · "}
                      <Link to={`/salary?userId=${data.salaryUserId}&month=${data.salaryMonth}`} style={{ color: "var(--orange)" }}>
                        View daily ledger →
                      </Link>
                    </div>
                  </span>
                </div>
              )}
              <Row k="Vendor" v={data.vendorName || "—"} />
              {data.vendorContact && (
                <div className="detail-row">
                  <span className="detail-row__k">Vendor phone</span>
                  <span className="detail-row__v">
                    <span className="mono">{data.vendorContact}</span>
                    <a href={`tel:+91${data.vendorContact.replace(/\D+/g, "")}`} className="chip" style={{ padding: "3px 8px", fontSize: 11, marginLeft: 6 }}>Call</a>
                    <a
                      href={`https://wa.me/91${data.vendorContact.replace(/\D+/g, "")}`}
                      target="_blank" rel="noopener noreferrer"
                      className="chip"
                      style={{ padding: "3px 8px", fontSize: 11, marginLeft: 4 }}
                    >
                      WhatsApp
                    </a>
                  </span>
                </div>
              )}
              <Row k="Expense date" v={fmtDay(data.voucherDate)} />
              <Row
                k="Created by"
                v={
                  <>
                    {data.createdByName ?? "—"}
                    {" · "}{fmtDayTime(data.createdAt)}
                  </>
                }
              />
              {data.notes && (
                <div className="detail-row" style={{ gridTemplateColumns: "1fr", gap: 4 }}>
                  <span className="detail-row__k">Notes</span>
                  <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {data.notes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Attachments */}
          {data.attachments.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="label" style={{ marginBottom: 8 }}>
                SUPPORTING DOCUMENTS · {data.attachments.length}
              </div>
              <div className="vo-att-grid">
                {data.attachments.map((a) => {
                  const url = `/uploads/${a.filePath}`;
                  const isImage = (a.mimeType ?? "").startsWith("image/");
                  return (
                    <a key={a.id} href={url} target="_blank" rel="noopener noreferrer" className="vo-att">
                      {isImage ? (
                        <img src={url} alt="" />
                      ) : (
                        <div className="vo-att__icon">PDF</div>
                      )}
                      <div className="vo-att__name">{a.originalName ?? a.filePath.split("/").pop()}</div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Approval flow + payment + rejection note */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>APPROVAL FLOW</div>
          <div className="detail-list" style={{ marginBottom: 18 }}>
            {data.approvers.length === 0 ? (
              <div className="card" style={{ padding: 14, textAlign: "center" }}>
                <div className="muted body-s">No approvers assigned.</div>
              </div>
            ) : (
              data.approvers.map((ar) => {
                const isMe = ar.approverUserId === user?.id;
                const vc = approverPill(ar.status);
                return (
                  <div key={ar.id} className="detail-row" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div>
                      <b>{ar.approverName}</b>
                      {isMe && (
                        <span className="pill pill--neutral" style={{ fontSize: 9.5, padding: "1px 7px", marginLeft: 4 }}>YOU</span>
                      )}
                      <div className="muted body-s" style={{ fontSize: 11.5 }}>
                        {ar.actionAt && <>{fmtDayTime(ar.actionAt)}</>}
                        {!ar.actionAt && <>awaiting decision</>}
                      </div>
                      {ar.remarks && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-60)" }}>
                          &ldquo;{ar.remarks}&rdquo;
                        </div>
                      )}
                    </div>
                    <span className={`pill ${vc}`}>{ar.status.charAt(0).toUpperCase() + ar.status.slice(1)}</span>
                  </div>
                );
              })
            )}
          </div>

          {data.paymentStatus === "paid" && (
            <>
              <div className="label" style={{ marginBottom: 8 }}>PAYMENT</div>
              <div className="detail-list">
                <Row k="Method" v={data.paymentMethod ? methodLabel(data.paymentMethod) : "—"} />
                <Row k="Paid on" v={data.paymentDate ? fmtDay(data.paymentDate) : "—"} />
                {data.paymentRef && <Row k="Reference" v={<span className="mono">{data.paymentRef}</span>} />}
                <Row
                  k="Paid by"
                  v={
                    <>
                      {data.paidByName ?? "—"}
                      {data.paidAt && <> · {fmtDayTime(data.paidAt)}</>}
                    </>
                  }
                />
              </div>
            </>
          )}

          {data.status === "rejected" && data.rejectedReason && (
            <div className="card" style={{ padding: "14px 16px", borderColor: "var(--error)", background: "var(--error-soft)", marginTop: 14 }}>
              <div className="label" style={{ color: "var(--error)", marginBottom: 6 }}>
                REJECTED BY {(data.rejectedByName ?? "—").toUpperCase()}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)" }}>{data.rejectedReason}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="detail-row">
      <span className="detail-row__k">{k}</span>
      <span className="detail-row__v">{v ?? <span className="muted">—</span>}</span>
    </div>
  );
}

const VIEW_CSS = `
  .vo-att-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 10px;
  }
  .vo-att {
    display: block;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    overflow: hidden;
    text-decoration: none; color: inherit;
    transition: border-color var(--t-fast);
  }
  .vo-att:hover { border-color: var(--orange); }
  .vo-att img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
  .vo-att__icon {
    aspect-ratio: 4/3;
    display: grid; place-items: center;
    background: var(--cream); color: var(--ink-60);
    font-family: var(--font-display); font-weight: 800; font-size: 22px;
  }
  .vo-att__name {
    padding: 8px 10px; font-size: 12px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .field__label--req::after { content: ' *'; color: var(--error); font-weight: 700; }
`;
