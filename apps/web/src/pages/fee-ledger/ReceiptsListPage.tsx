import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useReceipts } from "./hooks";
import type { FeePaymentMethod } from "@crestly/shared";
import { openWhatsappShare, receiptMessage } from "@/lib/whatsapp-share";

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
function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}
function fmtDayLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtDayShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
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

const METHODS: FeePaymentMethod[] = ["cash", "upi", "bank_transfer", "cheque", "card", "other"];
const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function ReceiptsListPage() {
  const [params, setParams] = useSearchParams();
  const q          = params.get("q") ?? "";
  const sessionUrl = params.get("session") ?? "";
  const method     = (params.get("method") ?? "") as FeePaymentMethod | "";
  const from       = params.get("from") ?? "";
  const to         = params.get("to") ?? "";
  const showVoided = params.get("voided") === "1";
  const page       = Math.max(1, Number(params.get("page") ?? 1));

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (Object.keys(patch).some((k) => k !== "page")) next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);

  // Debounced search.
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== q) update({ q: qInput || null }); }, 250);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  const { data, isLoading, isFetching, error, refetch } = useReceipts({
    q: q || undefined,
    sessionCode: sessionUrl || undefined,
    method: (method || undefined) as FeePaymentMethod | undefined,
    from: from || undefined,
    to:   to   || undefined,
    showVoided,
    page,
    pageSize: PAGE_SIZE,
  });

  const total      = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset     = (page - 1) * PAGE_SIZE;
  const showing    = Math.min(PAGE_SIZE, Math.max(0, total - offset));

  const pageWindow = useMemo(() => {
    const w: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) w.push(p);
    }
    return Array.from(new Set(w)).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <>
      <style>{RECEIPTS_CSS}</style>

      <Link to="/fee-ledger" className="m-back-link">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Fee Ledger</span>
      </Link>

      <PageHead
        group="FINANCE · LEDGER"
        meta="RECEIPTS"
        title="Receipts"
        lede="Every payment recorded, newest first. Search by receipt #, student name, or SR. Voided rows are kept for audit — toggle below to see them."
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="receipts" />

      {/* Summary tiles */}
      {isLoading ? (
        <Skeleton.StatRow count={3} />
      ) : (
        <div className="grid grid--cols-3 grid--gap-sm">
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-mint"><Icon name="ledger" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Receipts in view</div>
              <div className="stat-tile__value">{total.toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">
                session {data?.sessionCode ?? "—"}
                {method && <> · {methodLabel(method)}</>}
              </div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-wheat"><Icon name="rupee" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Collected</div>
              <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.totalAmount ?? 0)}</div>
              <div className="stat-tile__delta">sum of {total.toLocaleString("en-IN")} receipts</div>
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-tile__icon icon-tint-sky"><Icon name="calendar" size={20} /></div>
            <div className="stat-tile__body">
              <div className="stat-tile__label">Today</div>
              <div className="stat-tile__value">{(data?.todayCount ?? 0).toLocaleString("en-IN")}</div>
              <div className="stat-tile__delta">{compact(data?.todayAmount ?? 0)} today</div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <form
        className="toolbar card"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); }}
      >
        <label className="search" htmlFor="rcpt-q">
          <Icon name="search" size={14} />
          <input
            id="rcpt-q"
            className="search__input"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Receipt #, name, SR…"
          />
        </label>
        <div className="toolbar__inline-filters">
          <select
            className="select"
            value={data?.sessionCode ?? sessionUrl}
            onChange={(e) => update({ session: e.target.value || null })}
          >
            {(data?.sessions ?? [sessionUrl].filter(Boolean)).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="select"
            value={method}
            onChange={(e) => update({ method: e.target.value || null })}
          >
            <option value="">All methods</option>
            {METHODS.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
          </select>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => update({ from: e.target.value || null })}
            style={{ minWidth: 140 }}
            title="From date"
          />
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => update({ to: e.target.value || null })}
            style={{ minWidth: 140 }}
            title="To date"
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-60)", whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={showVoided}
              onChange={(e) => update({ voided: e.target.checked ? "1" : null })}
            />
            Show voided
          </label>
          <div className="spacer" style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
          >
            Reset
          </button>
        </div>
      </form>

      {/* Desktop table */}
      <div className="table-card m-hide">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Receipts<BrandDot /></h3>
            <div className="table-card__sub">
              Showing {showing.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
              {" · "}page {page} / {totalPages}
            </div>
          </div>
        </div>
        <div className="rcpt-head">
          <span>RECEIPT</span>
          <span>STUDENT</span>
          <span>CLASS</span>
          <span>DATE</span>
          <span>METHOD</span>
          <span style={{ textAlign: "right" }}>AMOUNT</span>
          <span></span>
        </div>

        {isLoading ? (
          <Skeleton.Table rows={8} cols={7} />
        ) : (data?.items.length ?? 0) === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO RECEIPTS</div>
            <div className="muted body-s">No payments match the current filter.</div>
          </div>
        ) : (
          data?.items.map((p) => (
            <div key={p.id} className={`rcpt-row ${p.isVoided ? "is-voided" : ""}`}>
              <span className="mono" style={{ fontSize: 11.5, fontWeight: 600 }}>
                {p.receiptNo}
                {p.isVoided && (
                  <span className="pill pill--error" style={{ fontSize: 9, padding: "1px 6px", marginLeft: 4 }}>VOID</span>
                )}
              </span>
              <span>
                <Link to={`/students/${p.srNumber}`} style={{ textDecoration: "none", color: "inherit", fontWeight: 600 }}>
                  {p.studentName}
                </Link>
                {p.isHostel && (
                  <span className="pill pill--info" style={{ fontSize: 9, padding: "1px 6px", marginLeft: 4 }}>HOSTEL</span>
                )}
                <div className="muted body-s" style={{ fontSize: 10.5, fontFamily: "var(--font-mono)" }}>
                  SR {padSr(p.srNumber)}
                </div>
              </span>
              <span><span className="cls-pill">{p.class}-{p.section}</span></span>
              <span className="muted body-s">{fmtDayLong(p.paidOn)}</span>
              <span className="body-s">
                {methodLabel(p.method)}
                {p.reference && (
                  <div className="muted body-s" style={{ fontSize: 10.5 }}>{p.reference}</div>
                )}
              </span>
              <span
                className="mono"
                style={{
                  textAlign: "right", fontWeight: 600,
                  ...(p.isVoided
                    ? { textDecoration: "line-through", color: "var(--ink-40)" }
                    : { color: "var(--success)" }),
                }}
              >
                {money(p.amount)}
              </span>
              <span style={{ textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                {!p.isVoided && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    title="Share receipt on WhatsApp"
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      openWhatsappShare({
                        message: receiptMessage({
                          studentName: p.studentName,
                          className: `${p.class}-${p.section}`,
                          receiptNo: p.receiptNo,
                          amountRs: p.amount,
                          paidOn: p.paidOn,
                          method: methodLabel(p.method),
                        }),
                      });
                    }}
                  >
                    <Icon name="whatsapp" size={13} />
                  </button>
                )}
                <a
                  href={`/print/receipt/${p.id}?auto=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--primary btn--sm"
                  title="Print receipt"
                >
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x={6} y={3} width={12} height={6} />
                    <rect x={4} y={9} width={16} height={9} rx={1.5} />
                    <rect x={7} y={14} width={10} height={7} />
                  </svg>
                </a>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Mobile cards */}
      <div className="m-show">
        {(data?.items.length ?? 0) === 0 && !isLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "36px 18px" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO RECEIPTS</div>
            <div className="muted body-s">No payments match the current filter.</div>
          </div>
        ) : (
          <div className="m-list">
            {data?.items.map((p) => (
              <Link
                key={p.id}
                to={`/fee-ledger/student/${p.srNumber}`}
                className="m-list__item"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className={`m-list__avi m-list__avi--${p.isVoided ? "wheat" : "mint"}`}>
                  {initials(p.studentName)}
                </div>
                <div className="m-list__body">
                  <div className="m-list__title">
                    {p.studentName}
                    {p.isVoided && (
                      <span className="pill pill--error" style={{ fontSize: 9, padding: "1px 6px", marginLeft: 4 }}>VOID</span>
                    )}
                  </div>
                  <div className="m-list__sub">
                    <span className="mono" style={{ fontSize: 11 }}>{p.receiptNo}</span>
                    {" · "}{methodLabel(p.method)}{" · "}{fmtDayShort(p.paidOn)}
                  </div>
                </div>
                <div className="m-list__meta" style={{ textAlign: "right" }}>
                  <span
                    className="mono"
                    style={{
                      fontWeight: 600,
                      ...(p.isVoided
                        ? { textDecoration: "line-through", color: "var(--ink-40)" }
                        : { color: "var(--success)" }),
                    }}
                  >
                    {money(p.amount)}
                  </span>
                  <span className="cls-pill" style={{ padding: "1px 7px", fontSize: 10, marginTop: 4 }}>
                    {p.class}-{p.section}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="pager">
          <button
            type="button"
            className={`pager__btn ${page <= 1 ? "is-disabled" : ""}`}
            disabled={page <= 1}
            onClick={() => update({ page: String(page - 1) })}
          >‹ Prev</button>
          {pageWindow.map((p, i) => (
            <span key={p} style={{ display: "contents" }}>
              {i > 0 && p - (pageWindow[i - 1] ?? 0) > 1 && <span className="pager__gap">…</span>}
              <button
                type="button"
                className={`pager__btn ${p === page ? "is-active" : ""}`}
                onClick={() => update({ page: String(p) })}
              >{p}</button>
            </span>
          ))}
          <button
            type="button"
            className={`pager__btn ${page >= totalPages ? "is-disabled" : ""}`}
            disabled={page >= totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >Next ›</button>
        </nav>
      )}

      {/* Translucency veil while refetching after a filter change */}
      {isFetching && !isLoading && (
        <div style={{ position: "fixed", top: 8, right: 16, fontSize: 11, color: "var(--ink-40)" }}>updating…</div>
      )}
    </>
  );
}

const RECEIPTS_CSS = `
  .rcpt-head, .rcpt-row {
    display: grid;
    grid-template-columns: 130px 1.6fr 90px 110px 130px 110px 80px;
    gap: 14px; padding: 12px 20px; align-items: center;
  }
  .rcpt-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .rcpt-row {
    border-bottom: 1px solid var(--rule-soft);
    font-size: 13px;
  }
  .rcpt-row:last-child { border-bottom: 0; }
  .rcpt-row:hover { background: var(--cream-soft); }
  .rcpt-row.is-voided { background: rgba(196,40,40,0.03); }
`;
