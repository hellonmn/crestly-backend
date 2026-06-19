import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useFeeLedger } from "./hooks";
import type { FeeLedgerStatusFilter, FeeLedgerSort } from "@crestly/shared";

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

/** Per-row pill helper — mirrors PHP $row_pill closure. */
function rowPill(pay: string, due: number): { cls: string; label: string } {
  if (pay === "paid")                      return { cls: "pill--success", label: "Paid" };
  if (pay === "partial")                   return { cls: "pill--info",    label: "Partial" };
  if (pay === "overdue")                   return { cls: "pill--error",   label: "Overdue" };
  if (pay === "pending" && due > 0)        return { cls: "pill--warn",    label: "Pending" };
  return { cls: "pill--neutral", label: pay.charAt(0).toUpperCase() + pay.slice(1) };
}

const PAGE_SIZE = 50;

const SORT_OPTIONS: Array<{ value: FeeLedgerSort; label: string }> = [
  { value: "due_desc",  label: "Due ▾" },
  { value: "due_asc",   label: "Due ▴" },
  { value: "paid_desc", label: "Paid ▾" },
  { value: "name_asc",  label: "Name A-Z" },
  { value: "class_asc", label: "Class" },
];

const STATUS_OPTIONS: Array<{ value: FeeLedgerStatusFilter | ""; label: string }> = [
  { value: "",             label: "Any status" },
  { value: "with_balance", label: "With balance" },
  { value: "overdue",      label: "Overdue" },
  { value: "pending",      label: "Pending" },
  { value: "partial",      label: "Partial" },
  { value: "paid",         label: "Paid" },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function FeeLedgerListPage() {
  const [params, setParams] = useSearchParams();
  const q       = params.get("q") ?? "";
  const cls     = params.get("class") ?? "";
  const section = params.get("section") ?? "";
  const status  = (params.get("status") ?? "") as FeeLedgerStatusFilter | "";
  const sort    = (params.get("sort") ?? "class_asc") as FeeLedgerSort;
  const page    = Math.max(1, Number(params.get("page") ?? 1));

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

  // Debounced search box.
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== q) update({ q: qInput || null }); }, 250);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  // "/" focuses search (PHP keyboard shortcut).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      e.preventDefault();
      document.getElementById("ledger-q")?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data, isLoading, isFetching, error, refetch } = useFeeLedger({
    q: q || undefined,
    class: cls || undefined,
    section: section || undefined,
    status: (status || undefined) as FeeLedgerStatusFilter | undefined,
    sort,
    page,
    pageSize: PAGE_SIZE,
  });

  const total       = data?.total ?? 0;
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset      = (page - 1) * PAGE_SIZE;
  const showing     = Math.min(PAGE_SIZE, Math.max(0, total - offset));
  const classes     = data?.classes  ?? [];
  const sections    = data?.sections ?? [];
  const collectionPct = (data && data.sessionTotal > 0)
    ? Math.round((data.collected / data.sessionTotal) * 1000) / 10
    : 0;

  const activeFilterCount =
    (cls !== "" ? 1 : 0) + (section !== "" ? 1 : 0) +
    (status !== "" ? 1 : 0) + (sort !== "class_asc" ? 1 : 0);

  // ---------- Mobile filter sheet ----------
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mClass, setMClass]     = useState(cls);
  const [mSection, setMSection] = useState(section);
  const [mStatus, setMStatus]   = useState(status);
  const [mSort, setMSort]       = useState(sort);
  useEffect(() => {
    if (sheetOpen) {
      setMClass(cls); setMSection(section); setMStatus(status); setMSort(sort);
      document.body.classList.add("has-drawer-open");
    } else {
      document.body.classList.remove("has-drawer-open");
    }
    return () => document.body.classList.remove("has-drawer-open");
  }, [sheetOpen, cls, section, status, sort]);
  useEffect(() => {
    if (!sheetOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [sheetOpen]);
  function applySheet() {
    update({
      class: mClass || null, section: mSection || null,
      status: mStatus || null,
      sort: mSort === "class_asc" ? null : mSort,
    });
    setSheetOpen(false);
  }
  function resetAll() { setParams(new URLSearchParams(), { replace: true }); }

  // ---------- Pagination window (first, last, ±2) ----------
  const pageWindow = useMemo(() => {
    const w: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) w.push(p);
    }
    return Array.from(new Set(w)).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <>
      <style>{LEDGER_CSS}</style>

      <PageHead
        group="FINANCE"
        meta={data?.sessionCode ? `SESSION ${data.sessionCode}` : undefined}
        title="Fee Ledger"
        lede="Collections, dues, and per-student fee status. Record payments and track overdue balances."
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="fee ledger" />

      {/* ===== STATS ===== */}
      <div id="ledger-stats" className={isFetching && !isLoading ? "is-loading" : ""}>
        {isLoading ? (
          <Skeleton.StatRow count={4} />
        ) : (
          <>
            <div className="grid grid--cols-4 grid--gap-sm">
              <div className="stat-tile">
                <div className="stat-tile__icon icon-tint-mint"><Icon name="check" size={20} /></div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Collected</div>
                  <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.collected ?? 0)}</div>
                  <div className="stat-tile__delta">
                    {collectionPct.toFixed(1)}% of {compact(data?.sessionTotal ?? 0)}
                  </div>
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile__icon icon-tint-rose"><Icon name="alert" size={20} /></div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Outstanding</div>
                  <div className="stat-tile__value" style={{ fontSize: 22 }}>{compact(data?.outstanding ?? 0)}</div>
                  <div className="stat-tile__delta">
                    {(data?.withBalanceCount ?? 0).toLocaleString("en-IN")} students with balance
                  </div>
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile__icon icon-tint-mustard"><Icon name="alert" size={20} /></div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Overdue</div>
                  <div className="stat-tile__value">{(data?.overdueCount ?? 0).toLocaleString("en-IN")}</div>
                  <div className="stat-tile__delta">past last installment</div>
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile__icon icon-tint-wheat"><Icon name="users" size={20} /></div>
                <div className="stat-tile__body">
                  <div className="stat-tile__label">Fully paid</div>
                  <div className="stat-tile__value">{(data?.fullyPaidCount ?? 0).toLocaleString("en-IN")}</div>
                  <div className="stat-tile__delta">
                    of {total.toLocaleString("en-IN")} in view
                  </div>
                </div>
              </div>
            </div>

            <div className="card card--tight">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="label">SESSION COLLECTION · {data?.sessionCode ?? "—"}</div>
                  <div className="display-m" style={{ marginTop: 4, fontSize: 28 }}>
                    {collectionPct.toFixed(1)}%<BrandDot />
                  </div>
                </div>
                <div className="muted body-s" style={{ textAlign: "right" }}>
                  <div><b style={{ color: "var(--ink)" }}>{compact(data?.collected ?? 0)}</b> collected</div>
                  <div>{compact(data?.outstanding ?? 0)} outstanding</div>
                </div>
              </div>
              <div style={{ height: 10, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${collectionPct}%`,
                  background: "var(--orange)", borderRadius: "var(--r-pill)",
                  transition: "width 180ms ease",
                }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== TOOLBAR ===== */}
      <form
        className="toolbar card"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); }}
      >
        <label className="search" htmlFor="ledger-q">
          <Icon name="search" size={14} />
          <input
            id="ledger-q"
            className="search__input"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name, father, SR…"
          />
          <span className="kbd">/</span>
        </label>

        <button
          type="button"
          className="btn btn--ghost btn--sm m-filter-btn"
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="filter" size={14} />
          Filter{activeFilterCount > 0 && <span className="btn__count">{activeFilterCount}</span>}
        </button>

        <div className="toolbar__inline-filters">
          <select className="select" value={cls} onChange={(e) => update({ class: e.target.value || null })}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={section} onChange={(e) => update({ section: e.target.value || null })}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className="select"
            value={status}
            onChange={(e) => update({ status: e.target.value || null })}
          >
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select
            className="select"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === "class_asc" ? null : e.target.value })}
          >
            {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <div className="spacer" />

          <button type="button" className="btn btn--ghost btn--sm" onClick={resetAll}>Reset</button>
          <Link to="/fee-ledger/receipts" className="btn btn--ink btn--sm">
            <Icon name="ledger" size={14} /> Receipts
          </Link>
        </div>
      </form>

      {/* ===== Mobile filter sheet ===== */}
      <div
        className={`m-sheet-backdrop ${sheetOpen ? "is-open" : ""}`}
        aria-hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />
      <aside
        className={`m-sheet ${sheetOpen ? "is-open" : ""}`}
        role="dialog"
        aria-label="Filter ledger"
        aria-hidden={!sheetOpen}
      >
        <div className="m-sheet__handle" />
        <div className="m-sheet__head">
          <div className="m-sheet__title">Filter &amp; sort</div>
          <button type="button" className="m-sheet__close" aria-label="Close" onClick={() => setSheetOpen(false)}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="m-sheet__body">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="ml-class">Class</label>
              <select id="ml-class" className="select" value={mClass} onChange={(e) => setMClass(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ml-section">Section</label>
              <select id="ml-section" className="select" value={mSection} onChange={(e) => setMSection(e.target.value)}>
                <option value="">All sections</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ml-status">Status</label>
              <select id="ml-status" className="select" value={mStatus} onChange={(e) => setMStatus(e.target.value as FeeLedgerStatusFilter | "")}>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ml-sort">Sort</label>
              <select id="ml-sort" className="select" value={mSort} onChange={(e) => setMSort(e.target.value as FeeLedgerSort)}>
                {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="m-sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={resetAll}>Reset</button>
          <button type="button" className="btn btn--primary" onClick={applySheet}>Apply</button>
        </div>
      </aside>

      {/* ===== RESULTS ===== */}
      <div id="ledger-results" className={isFetching && !isLoading ? "is-loading" : ""}>
        {/* Desktop table */}
        <div className="table-card m-hide">
          <div className="table-card__head">
            <div>
              <h3 className="table-card__title">Fee allotments<BrandDot /></h3>
              <div className="table-card__sub">
                Showing {showing.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
                {" · "}page {page} / {totalPages}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <span className="label" style={{ color: "var(--ink-40)" }}>CLICK ROW TO RECORD →</span>
          </div>

          <div className="ledger-head">
            <span>SR</span>
            <span>NAME</span>
            <span>CLASS</span>
            <span style={{ textAlign: "right" }}>TOTAL</span>
            <span style={{ textAlign: "right" }}>PAID</span>
            <span style={{ textAlign: "right" }}>DUE</span>
            <span style={{ textAlign: "center" }}>STATUS</span>
            <span></span>
          </div>

          {isLoading ? (
            <Skeleton.Table rows={8} cols={8} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
              <div className="muted">No fee allotments match the current filter.</div>
            </div>
          ) : (
            data?.items.map((r) => {
              const pill = rowPill(r.paymentStatus, r.dueAmount);
              const pct = r.totalThisYear > 0 ? Math.round((r.paidAmount / r.totalThisYear) * 100) : 0;
              return (
                <div className="ledger-row" key={r.srNumber}>
                  <span className="td-sr mono">{padSr(r.srNumber)}</span>
                  <span className="td-name">
                    <Link to={`/students/${r.srNumber}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {r.studentName}
                    </Link>
                    {r.familyId && (
                      <span className="pill pill--neutral" style={{ marginLeft: 6, fontSize: 9.5, padding: "1px 7px" }}>
                        SIB
                      </span>
                    )}
                    {r.siblingDiscountPct > 0 && (
                      <span className="pill pill--mint" style={{ marginLeft: 4, fontSize: 9.5, padding: "1px 7px" }}>
                        -{String(r.siblingDiscountPct).replace(/\.?0+$/, "")}%
                      </span>
                    )}
                    <div className="muted body-s" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {r.fatherName || "—"}
                    </div>
                  </span>
                  <span><span className="cls-pill">{r.class}-{r.section}</span></span>
                  <span className="ledger-num">{money(r.totalThisYear)}</span>
                  <span className="ledger-num" style={{ color: "var(--success)" }}>{money(r.paidAmount)}</span>
                  <span
                    className="ledger-num"
                    style={{ color: r.dueAmount > 0 ? "var(--error)" : "var(--ink-40)", fontWeight: r.dueAmount > 0 ? 600 : 400 }}
                  >
                    {money(r.dueAmount)}
                  </span>
                  <span style={{ textAlign: "center" }}>
                    <span className={`pill ${pill.cls}`}>
                      <span className="pill__dot" />{pill.label}
                    </span>
                    <div style={{ height: 4, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", marginTop: 4 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)" }} />
                    </div>
                  </span>
                  <span style={{ textAlign: "right" }}>
                    <Link
                      to={`/fee-ledger/student/${r.srNumber}`}
                      className={`btn btn--sm ${r.dueAmount > 0 ? "btn--primary" : "btn--ghost"}`}
                    >
                      {r.dueAmount > 0 ? "Pay" : "History"}
                    </Link>
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Mobile cards */}
        <div className="m-show">
          <div className="m-list-head">
            <span className="m-list-head__title">Allotments<BrandDot /></span>
            <span className="m-list-head__sub">{total.toLocaleString("en-IN")} · pg {page}/{totalPages}</span>
          </div>
          {isLoading ? (
            <Skeleton.Table rows={4} cols={3} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "36px 18px" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
              <div className="muted body-s">No fee allotments match the current filter.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data?.items.map((r) => {
                const pill = rowPill(r.paymentStatus, r.dueAmount);
                const pct = r.totalThisYear > 0 ? Math.round((r.paidAmount / r.totalThisYear) * 100) : 0;
                const sib = r.familyId != null;
                return (
                  <Link key={r.srNumber} to={`/fee-ledger/student/${r.srNumber}`}
                    className="card"
                    style={{ padding: 14, textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "center" }}>
                      <div className={`m-list__avi m-list__avi--${sib ? "orange" : "wheat"}`}>
                        {initials(r.studentName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.studentName}
                        </div>
                        <div className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                          <span className="cls-pill" style={{ padding: "1px 7px", fontSize: 10 }}>{r.class}-{r.section}</span>
                          <span>SR {r.srNumber}</span>
                        </div>
                      </div>
                      <span className={`pill ${pill.cls}`}>
                        <span className="pill__dot" />{pill.label}
                      </span>
                    </div>

                    <div style={{ height: 6, background: "var(--cream)", borderRadius: "var(--r-pill)", overflow: "hidden", margin: "12px 0 10px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)" }} />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 12 }}>
                      <div>
                        <div className="label" style={{ fontSize: 9 }}>PAID</div>
                        <div style={{ fontFamily: "var(--font-mono)", color: "var(--success)", fontWeight: 600, marginTop: 1 }}>
                          {money(r.paidAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="label" style={{ fontSize: 9 }}>DUE</div>
                        <div style={{
                          fontFamily: "var(--font-mono)",
                          color: r.dueAmount > 0 ? "var(--error)" : "var(--ink-40)",
                          fontWeight: 600, marginTop: 1,
                        }}>
                          {money(r.dueAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="label" style={{ fontSize: 9 }}>TOTAL</div>
                        <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600, marginTop: 1 }}>
                          {money(r.totalThisYear)}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="pager">
            <button type="button" className={`pager__btn ${page <= 1 ? "is-disabled" : ""}`} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
              ‹ Prev
            </button>
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
            <button type="button" className={`pager__btn ${page >= totalPages ? "is-disabled" : ""}`} disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
              Next ›
            </button>
          </nav>
        )}
      </div>
    </>
  );
}

/* Inline CSS — verbatim of erp/fee-ledger/index.php. */
const LEDGER_CSS = `
  .ledger-head, .ledger-row {
    display: grid;
    grid-template-columns: 60px 1.8fr 90px 110px 110px 110px 130px 80px;
    gap: 14px; padding: 12px 20px; align-items: center;
  }
  .ledger-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .ledger-row { border-bottom: 1px solid var(--rule-soft); font-size: 13px; }
  .ledger-row:last-child { border-bottom: 0; }
  .ledger-row:hover { background: var(--cream-soft); }
  .ledger-num { font-family: var(--font-mono); text-align: right; font-size: 12.5px; }
  @media (max-width: 1100px) {
    .ledger-head, .ledger-row {
      grid-template-columns: 50px 1.6fr 80px 100px 100px 100px 115px 70px;
      gap: 10px; padding: 12px 14px;
    }
  }
  #ledger-stats.is-loading, #ledger-results.is-loading {
    opacity: 0.55; transition: opacity 120ms ease; pointer-events: none;
  }
`;
