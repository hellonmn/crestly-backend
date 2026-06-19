import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useVouchers } from "./hooks";
import type { VoucherPaymentStatus, VoucherStatus } from "@crestly/shared";

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
function shortDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}
function longDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function monthStart(): string {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function today(): string { return new Date().toISOString().slice(0, 10); }

/** Mirrors PHP `voucher_status_pill($status, $payment_status)` mapping. */
function statusPill(status: VoucherStatus, payment: VoucherPaymentStatus): { cls: string; label: string } {
  if (status === "rejected")          return { cls: "pill--error",   label: "Rejected" };
  if (status === "cancelled")         return { cls: "pill--neutral", label: "Cancelled" };
  if (status === "draft")             return { cls: "pill--neutral", label: "Draft" };
  if (status === "pending_approval")  return { cls: "pill--warn",    label: "Pending" };
  // status === "approved"
  if (payment === "paid")             return { cls: "pill--success", label: "Paid" };
  if (payment === "partial")          return { cls: "pill--info",    label: "Partial" };
  return                                     { cls: "pill--info",    label: "Approved" };
}

const PAGE_SIZE = 200;   // PHP caps results at 200 too

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function VouchersListPage() {
  const [params, setParams] = useSearchParams();

  const q       = params.get("q") ?? "";
  const status  = (params.get("status") ?? "") as VoucherStatus | "";
  const pay     = (params.get("pay") ?? "")   as VoucherPaymentStatus | "";
  const cat     = params.get("cat") ?? "";
  const from    = params.get("from") ?? monthStart();
  const to      = params.get("to")   ?? today();

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  // Debounced search box.
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== q) update({ q: qInput || null }); }, 250);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  const { data, isLoading, isFetching, error, refetch } = useVouchers({
    q: q || undefined,
    status: (status || undefined) as VoucherStatus | undefined,
    payment: (pay || undefined) as VoucherPaymentStatus | undefined,
    category: cat || undefined,
    from, to,
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const items     = data?.items ?? [];
  const categories = data?.categories ?? [];

  function resetAll() { setParams(new URLSearchParams(), { replace: true }); }

  return (
    <>
      <style>{VOUCHERS_CSS}</style>

      <PageHead
        group="FINANCE"
        meta="VOUCHERS"
        title="Expense Vouchers"
        lede="Daily school expenses with approval flow + digital attachments. Credit bills stay as approved-but-unpaid until the accountant marks them paid."
        actions={
          <Link to="/vouchers/new" className="btn btn--primary btn--sm">
            <Icon name="plus" size={14} /> New voucher
          </Link>
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="vouchers" />

      {/* ===== Stat tiles ===== */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-rose"><Icon name="rupee" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Total expense</div>
              <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.totalAmount ?? 0)}</div>
              <div className="stat-tile__delta">{(data?.total ?? 0).toLocaleString("en-IN")} vouchers</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint"><Icon name="check" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Paid</div>
              <div className="stat-tile__value" style={{ fontSize: 22, color: "var(--success)" }}>
                {compact(data?.paidAmount ?? 0)}
              </div>
              <div className="stat-tile__delta">cleared this range</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mustard"><Icon name="alert" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Credit unpaid</div>
              <div className="stat-tile__value" style={{ fontSize: 22, color: "var(--warn)" }}>
                {compact(data?.creditUnpaid ?? 0)}
              </div>
              <div className="stat-tile__delta">to pay later</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-wheat"><Icon name="alert" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Pending approval</div>
              <div className="stat-tile__value">{(data?.pendingApproval ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">awaiting sign-off</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Filter form ===== */}
      <form
        className="toolbar card"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); }}
      >
        <label className="search" htmlFor="vo-q">
          <Icon name="search" size={14} />
          <input
            id="vo-q"
            className="search__input"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search title, voucher no, vendor…"
          />
        </label>
        <div className="toolbar__inline-filters">
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => update({ from: e.target.value || null })}
            style={{ maxWidth: 140 }}
          />
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => update({ to: e.target.value || null })}
            style={{ maxWidth: 140 }}
          />
          <select
            className="select"
            value={status}
            onChange={(e) => update({ status: e.target.value || null })}
          >
            <option value="">Any status</option>
            <option value="pending_approval">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="select"
            value={pay}
            onChange={(e) => update({ pay: e.target.value || null })}
          >
            <option value="">Any payment</option>
            <option value="unpaid">Unpaid / credit</option>
            <option value="paid">Paid</option>
          </select>
          <select
            className="select"
            value={cat}
            onChange={(e) => update({ cat: e.target.value || null })}
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="spacer" style={{ flex: 1 }} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetAll}>Reset</button>
          <Link to="/vouchers/new" className="btn btn--primary btn--sm m-hide">
            <Icon name="plus" size={14} /> New voucher
          </Link>
        </div>
      </form>

      {/* ===== Desktop table ===== */}
      <div id="vo-results" className={isFetching && !isLoading ? "is-loading" : ""}>
        <div className="table-card m-hide">
          <div className="table-card__head">
            <div>
              <h3 className="table-card__title">Vouchers<BrandDot /></h3>
              <div className="table-card__sub">
                {items.length.toLocaleString("en-IN")} rows · {longDay(from)} → {longDay(to)}
              </div>
            </div>
          </div>
          <div className="vo-head">
            <span>VOUCHER</span>
            <span>TITLE</span>
            <span>CATEGORY</span>
            <span>VENDOR</span>
            <span style={{ textAlign: "right" }}>AMOUNT</span>
            <span style={{ textAlign: "center" }}>STATUS</span>
            <span></span>
          </div>
          {isLoading ? (
            <Skeleton.Table rows={6} cols={7} />
          ) : items.length === 0 ? (
            <div style={{ padding: "40px 24px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO VOUCHERS</div>
              <div className="muted body-s">No vouchers in this range. Adjust the filters or create a new one.</div>
            </div>
          ) : (
            items.map((v) => {
              const pill = statusPill(v.status, v.paymentStatus);
              return (
                <Link key={v.id} to={`/vouchers/${v.id}`} className="vo-row" id={`voucher-${v.id}`}>
                  <span className="mono body-s">
                    <b>{v.voucherNo}</b>
                    <div className="muted body-s" style={{ fontSize: 10.5 }}>{shortDay(v.voucherDate)}</div>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {v.title}
                    </b>
                    <div className="muted body-s" style={{ fontSize: 11 }}>by {v.createdByName ?? "—"}</div>
                  </span>
                  <span className="muted body-s">{v.category || "—"}</span>
                  <span className="muted body-s">{v.vendorName || "—"}</span>
                  <span className="mono" style={{ textAlign: "right", fontWeight: 700 }}>{money(v.amount)}</span>
                  <span style={{ textAlign: "center" }}>
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                    {v.isCreditBill && (
                      <div className="muted body-s" style={{ fontSize: 10, marginTop: 2 }}>credit</div>
                    )}
                  </span>
                  <span className="muted" style={{ textAlign: "right" }} aria-hidden>›</span>
                </Link>
              );
            })
          )}
        </div>

        {/* ===== Mobile cards ===== */}
        <div className="m-show">
          <div className="m-list-head">
            <span className="m-list-head__title">Vouchers<BrandDot /></span>
            <span className="m-list-head__sub">{items.length.toLocaleString("en-IN")} rows</span>
          </div>
          {isLoading ? (
            <Skeleton.Table rows={4} cols={2} />
          ) : items.length === 0 ? (
            <div className="card" style={{ padding: "28px 18px", textAlign: "center" }}>
              <div className="muted body-s">No vouchers.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((v) => {
                const pill = statusPill(v.status, v.paymentStatus);
                return (
                  <Link
                    key={v.id}
                    to={`/vouchers/${v.id}`}
                    className="card"
                    style={{ display: "block", padding: "12px 14px", textDecoration: "none", color: "inherit" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "baseline" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {v.title}
                        </div>
                        <div className="muted body-s mono" style={{ fontSize: 11 }}>
                          {v.voucherNo} · {shortDay(v.voucherDate)}
                        </div>
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, textAlign: "right" }}>
                        {money(v.amount)}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
                      <span className={`pill ${pill.cls}`} style={{ fontSize: 9.5, padding: "1px 7px" }}>{pill.label}</span>
                      <span className="muted body-s" style={{ fontSize: 11 }}>
                        {v.vendorName || v.category || "—"}
                      </span>
                      {v.isCreditBill && (
                        <span className="pill pill--info" style={{ fontSize: 9, padding: "1px 6px" }}>CREDIT</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const VOUCHERS_CSS = `
  .vo-head, .vo-row {
    display: grid;
    grid-template-columns: 110px 1.4fr 1fr 1fr 110px 130px 20px;
    gap: 14px; padding: 12px 18px; align-items: center;
  }
  .vo-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .vo-row {
    border-bottom: 1px solid var(--rule-soft);
    font-size: 13px;
    text-decoration: none; color: inherit;
  }
  .vo-row:last-child { border-bottom: 0; }
  .vo-row:hover { background: var(--cream-soft); }
  @media (max-width: 1100px) {
    .vo-head, .vo-row {
      grid-template-columns: 100px 1.4fr 1fr 1fr 100px 110px 20px;
      padding: 12px; gap: 10px;
    }
  }
  #vo-results.is-loading {
    opacity: 0.55; pointer-events: none;
    transition: opacity var(--t-fast) var(--ease);
  }
`;
