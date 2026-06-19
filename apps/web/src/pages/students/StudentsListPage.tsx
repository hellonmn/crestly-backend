import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useStudents, useStudentBulk } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import type { Gender, Student, StudentAccom, StudentPaymentStatus } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers shared with the PHP page                                    */
/* ------------------------------------------------------------------ */

/** Two-letter initials used by the mobile-list avatar; mirrors PHP `initials()`. */
function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

/** Pad SR to 4 digits (e.g. 7 → "0007") for the desktop SR column. */
function padSr(n: number): string {
  return String(n).padStart(4, "0");
}

/** Map payment_status + due_amount → pill class + label, identical to PHP. */
function paymentPill(status: StudentPaymentStatus | null | undefined, due: number | undefined) {
  const dueN = due ?? 0;
  if (status === "paid")                     return { cls: "pill--success", label: "Paid"    };
  if (status === "partial")                  return { cls: "pill--info",    label: "Partial" };
  if (status === "overdue")                  return { cls: "pill--error",   label: "Overdue" };
  if (status === "pending" && dueN > 0)      return { cls: "pill--warn",    label: "Pending" };
  if (status === null || status === undefined) return { cls: "pill--neutral", label: "—"       };
  return { cls: "pill--neutral", label: (status as string).charAt(0).toUpperCase() + (status as string).slice(1) };
}

/** Format the page-head crumb date "SUN 22 MAY 2026" (uppercase). */
function crumbDate(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(d);
  // Intl gives "Fri, 22 May 2026" — drop the comma & uppercase.
  return fmt.replace(/,/g, "").toUpperCase();
}

const ACCOM_TABS: Array<{ key: ""; label: string } | { key: StudentAccom; label: string }> = [
  { key: "", label: "All" },
  { key: "day", label: "Day Scholars" },
  { key: "hostel", label: "Hostellers" },
];

const PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function StudentsListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  // URL is the source of truth for every filter (mirrors PHP GET-based flow).
  const q       = params.get("q") ?? "";
  const cls     = params.get("class") ?? "";
  const section = params.get("section") ?? "";
  const gender  = (params.get("gender") ?? "") as Gender | "";
  const status  = (params.get("status") ?? "active") as "active" | "inactive" | "all";
  const accom   = (params.get("accom") ?? "") as StudentAccom | "";
  const page    = Math.max(1, Number(params.get("page") ?? 1));

  const update = useCallback((patch: Record<string, string | null>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      // Filter or search changes always reset to page 1 (parity with PHP).
      if (Object.keys(patch).some((k) => k !== "page")) next.delete("page");
      return next;
    }, { replace: true });
  }, [setParams]);

  // Debounced search box, so typing doesn't fire a request per keystroke.
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== q) update({ q: qInput || null }); }, 250);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  // "/" focuses search, matching PHP keyboard shortcut.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      e.preventDefault();
      document.getElementById("q")?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Auth-driven gates. "Full access" = admin or principal in the PHP world.
  const role = user?.roleSlug ?? "";
  const isFullAccess = role === "admin" || role === "principal";
  const canManage = (user?.permissions ?? []).includes("students.manage");
  const canBulk = isFullAccess && canManage;

  const { data, isLoading, isFetching, error, refetch } = useStudents({
    q: q || undefined,
    class: cls || undefined,
    section: section || undefined,
    gender: (gender || undefined) as Gender | undefined,
    status,
    accom: (accom || undefined) as StudentAccom | undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  const showing = Math.min(PAGE_SIZE, Math.max(0, total - offset));
  const classes = data?.classes ?? [];
  const sections = data?.sections ?? [];

  const activeFilterCount =
    (cls !== "" ? 1 : 0) + (section !== "" ? 1 : 0) + (gender !== "" ? 1 : 0) + (status !== "active" ? 1 : 0);

  // ---------- selection / bulk ----------
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkFlash, setBulkFlash] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkM = useStudentBulk();

  // Clear selection when page/filter changes (rows just shifted).
  useEffect(() => { setSelected(new Set()); }, [page, cls, section, gender, status, accom, q]);

  function toggleOne(sr: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(sr)) next.delete(sr); else next.add(sr);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    if (!data) return;
    setSelected(checked ? new Set(data.items.map((r) => r.srNumber)) : new Set());
  }
  async function runBulk(op: "activate" | "deactivate" | "delete") {
    const srs = Array.from(selected);
    if (srs.length === 0) return;
    if (op === "delete" && !confirm(`Delete ${srs.length} student${srs.length > 1 ? "s" : ""} and all their records? This cannot be undone.`)) return;
    setBulkError(null); setBulkFlash(null);
    try {
      const { affected } = await bulkM.mutateAsync({ op, srs });
      const verb = op === "delete" ? "deleted" : op === "activate" ? "marked active" : "marked inactive";
      setBulkFlash(`${affected} student${affected > 1 ? "s" : ""} ${verb}.`);
      setSelected(new Set());
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Bulk action failed");
    }
  }

  // ---------- mobile filter sheet ----------
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mClass, setMClass] = useState(cls);
  const [mSection, setMSection] = useState(section);
  const [mGender, setMGender] = useState(gender);
  const [mStatus, setMStatus] = useState(status);
  useEffect(() => {
    if (sheetOpen) {
      setMClass(cls); setMSection(section); setMGender(gender); setMStatus(status);
      document.body.classList.add("has-drawer-open");
    } else {
      document.body.classList.remove("has-drawer-open");
    }
    return () => document.body.classList.remove("has-drawer-open");
  }, [sheetOpen, cls, section, gender, status]);
  // Esc closes the sheet.
  useEffect(() => {
    if (!sheetOpen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [sheetOpen]);
  function applySheet() {
    update({
      class: mClass || null,
      section: mSection || null,
      gender: mGender || null,
      status: mStatus === "active" ? null : mStatus,
    });
    setSheetOpen(false);
  }
  function resetAll() {
    setParams(new URLSearchParams(), { replace: true });
  }

  // ---------- pagination window (PHP: first, last, and ±2 around current) ----------
  const pageWindow = useMemo(() => {
    const w: number[] = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - page) <= 2) w.push(p);
    }
    return Array.from(new Set(w)).sort((a, b) => a - b);
  }, [page, totalPages]);

  return (
    <>
      <PageHead
        group="RECORDS"
        meta={crumbDate()}
        title="Students"
        lede={
          data
            ? `${total.toLocaleString("en-IN")} on record · current session`
            : "Loading…"
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="students" />

      {bulkFlash && <div className="banner banner--success"><span>{bulkFlash}</span></div>}
      {bulkError && <div className="banner banner--error"><span>{bulkError}</span></div>}

      {/* ---------- TOOLBAR ---------- */}
      <form
        className="toolbar card"
        id="students-filter-form"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); /* live AJAX already updates */ }}
      >
        <label className="search" htmlFor="q">
          <Icon name="search" size={14} />
          <input
            id="q"
            className="search__input"
            type="search"
            name="q"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name, father, SR…"
          />
          <span className="kbd">/</span>
        </label>

        {/* Mobile-only Filter chip */}
        <button
          type="button"
          className="btn btn--ghost btn--sm m-filter-btn"
          onClick={() => setSheetOpen(true)}
        >
          <Icon name="filter" size={14} />
          Filter{activeFilterCount > 0 && <span className="btn__count">{activeFilterCount}</span>}
        </button>

        {/* Desktop inline filters + actions */}
        <div className="toolbar__inline-filters">
          <select className="select" name="class" value={cls} onChange={(e) => update({ class: e.target.value || null })}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <select className="select" name="section" value={section} onChange={(e) => update({ section: e.target.value || null })}>
            <option value="">All sections</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="select" name="gender" value={gender} onChange={(e) => update({ gender: e.target.value || null })}>
            <option value="">Any gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>

          <select
            className="select"
            name="status"
            value={status}
            onChange={(e) => update({ status: e.target.value === "active" ? null : e.target.value })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>

          <div className="spacer" />

          <button type="submit" className="btn btn--ghost btn--sm">Apply</button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetAll}>Reset</button>
          {isFullAccess && (
            <>
              <Link to="/import?type=student" className="btn btn--ink btn--sm" title="Bulk import students from CSV">
                <Icon name="download" size={14} />
                Import
              </Link>
              <Link to="/students/new" className="btn btn--primary btn--sm">
                <Icon name="plus" size={14} />
                Add Student
              </Link>
            </>
          )}
        </div>
      </form>

      {/* ---------- Mobile filter bottom sheet ---------- */}
      <div
        className={`m-sheet-backdrop ${sheetOpen ? "is-open" : ""}`}
        aria-hidden={!sheetOpen}
        onClick={() => setSheetOpen(false)}
      />
      <aside
        className={`m-sheet ${sheetOpen ? "is-open" : ""}`}
        role="dialog"
        aria-label="Filter students"
        aria-hidden={!sheetOpen}
      >
        <div className="m-sheet__handle" />
        <div className="m-sheet__head">
          <div className="m-sheet__title">Filter</div>
          <button type="button" className="m-sheet__close" aria-label="Close" onClick={() => setSheetOpen(false)}>
            <Icon name="x" size={14} />
          </button>
        </div>
        <div className="m-sheet__body">
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="m-class">Class</label>
              <select id="m-class" className="select" value={mClass} onChange={(e) => setMClass(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="m-section">Section</label>
              <select id="m-section" className="select" value={mSection} onChange={(e) => setMSection(e.target.value)}>
                <option value="">All sections</option>
                {sections.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="m-gender">Gender</label>
              <select id="m-gender" className="select" value={mGender} onChange={(e) => setMGender(e.target.value as Gender | "")}>
                <option value="">Any gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="m-status">Status</label>
              <select id="m-status" className="select" value={mStatus} onChange={(e) => setMStatus(e.target.value as typeof mStatus)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>
        <div className="m-sheet__actions">
          <button type="button" className="btn btn--ghost" onClick={resetAll}>Reset</button>
          <button type="button" className="btn btn--primary" onClick={applySheet}>Apply</button>
        </div>
      </aside>

      {/* ---------- AJAX-replaceable results block ---------- */}
      <div id="students-results" className={isFetching && !isLoading ? "is-loading" : ""}>
        {canBulk && selected.size > 0 && (
          <div
            id="bulk-bar"
            className="card"
            style={{
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              marginBottom: 14, padding: "12px 16px",
              position: "sticky", top: 8, zIndex: 6, borderColor: "var(--orange)",
            }}
          >
            <strong style={{ fontSize: 14 }}>{selected.size} selected</strong>
            <div style={{ flex: 1 }} />
            <button type="button" className="btn btn--ghost btn--sm" disabled={bulkM.isPending} onClick={() => runBulk("activate")}>Mark Active</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={bulkM.isPending} onClick={() => runBulk("deactivate")}>Mark Inactive</button>
            <button type="button" className="btn btn--danger btn--sm" disabled={bulkM.isPending} onClick={() => runBulk("delete")}>Delete</button>
            <button type="button" className="btn btn--ink btn--sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {/* DESKTOP TABLE — hidden on mobile (.m-hide) */}
        <div className="table-card m-hide">
          <div className="table-card__head">
            <div>
              <h3 className="table-card__title">Students List<BrandDot /></h3>
              <div className="table-card__sub">
                Showing {showing.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
                {" · "}page {page} / {totalPages}
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {canBulk && <span className="muted body-s">Tick rows for bulk actions</span>}
          </div>

          {/* Accommodation tabs */}
          <div
            className="accom-tabs"
            style={{ display: "flex", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}
          >
            {ACCOM_TABS.map((t) => (
              <button
                key={t.key || "all"}
                type="button"
                className={`pill ${accom === t.key ? "pill--wheat" : "pill--neutral"}`}
                onClick={() => update({ accom: t.key || null })}
                style={{ padding: "5px 14px", border: 0, cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="table-head">
            <span>
              {canBulk && (
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  ref={(el) => {
                    if (!el || !data) return;
                    const t = data.items.length;
                    const n = selected.size;
                    el.indeterminate = n > 0 && n < t;
                  }}
                  checked={!!data && data.items.length > 0 && selected.size === data.items.length}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              )}
            </span>
            <span>SR</span>
            <span>NAME</span>
            <span>CLASS</span>
            <span>FATHER</span>
            <span>PICKUP</span>
            <span>STATUS</span>
          </div>

          {isLoading ? (
            <Skeleton.Table rows={8} cols={7} />
          ) : data && data.items.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
              <div className="muted">No students match the current filter.</div>
            </div>
          ) : (
            data?.items.map((r) => {
              const m = paymentPill(r.paymentStatus, r.dueAmount);
              return (
                <div className="table-row" key={r.srNumber}>
                  <span>
                    {canBulk ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.studentName}`}
                        checked={selected.has(r.srNumber)}
                        onChange={() => toggleOne(r.srNumber)}
                      />
                    ) : null}
                  </span>
                  <span className="td-sr mono">{padSr(r.srNumber)}</span>
                  <span className="td-name">
                    <Link to={`/students/${r.srNumber}`} style={{ textDecoration: "none", color: "inherit" }}>
                      {r.studentName}
                    </Link>
                    {r.familyId && <span className="pill pill--neutral" style={{ marginLeft: 6, fontSize: 9.5, padding: "1px 7px" }}>SIB</span>}
                    {r.isHostel && <span className="pill pill--info" style={{ marginLeft: 6, fontSize: 9.5, padding: "1px 7px" }}>HOSTEL</span>}
                  </span>
                  <span><span className="cls-pill">{r.class}-{r.section}</span></span>
                  <span className="muted">{r.fatherName || "—"}</span>
                  <span className="muted">{r.pickupName || "Self"}</span>
                  <span>
                    <span className={`pill ${m.cls}`}>
                      {m.label !== "—" && <span className="pill__dot" />}
                      {m.label}
                    </span>
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* ---------- MOBILE LIST ---------- */}
        <div className="m-show">
          <div className="m-list-head">
            <span className="m-list-head__title">Students<BrandDot /></span>
            <span className="m-list-head__sub">{total.toLocaleString("en-IN")} · page {page}/{totalPages}</span>
          </div>
          <div className="accom-tabs" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {ACCOM_TABS.map((t) => (
              <button
                key={t.key || "all"}
                type="button"
                className={`pill ${accom === t.key ? "pill--wheat" : "pill--neutral"}`}
                onClick={() => update({ accom: t.key || null })}
                style={{ padding: "5px 14px", border: 0, cursor: "pointer" }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <Skeleton.Table rows={6} cols={3} />
          ) : data && data.items.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "36px 18px" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
              <div className="muted body-s">No students match the current filter.</div>
            </div>
          ) : (
            <div className="m-list">
              {data?.items.map((r) => <MobileRow key={r.srNumber} r={r} />)}
            </div>
          )}
        </div>

        {/* ---------- PAGINATION ---------- */}
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
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function MobileRow({ r }: { r: Student }) {
  const m = paymentPill(r.paymentStatus, r.dueAmount);
  const tone = r.familyId ? "orange" : "wheat";
  return (
    <Link className="m-list__item" to={`/students/${r.srNumber}`}>
      <div className={`m-list__avi m-list__avi--${tone}`}>{initials(r.studentName)}</div>
      <div className="m-list__body">
        <div className="m-list__title">
          {r.studentName}
          {r.isHostel && (
            <span className="pill pill--info" style={{ marginLeft: 4, fontSize: 9, padding: "1px 6px" }}>H</span>
          )}
        </div>
        <div className="m-list__sub">
          <span className="cls-pill">{r.class}-{r.section}</span>
          <span>· {r.fatherName || "—"}</span>
        </div>
      </div>
      <div className="m-list__meta">
        <span className={`pill ${m.cls}`}>
          {m.label !== "—" && <span className="pill__dot" />}
          {m.label}
        </span>
        <span className="body-s muted mono" style={{ fontSize: 10 }}>SR {r.srNumber}</span>
      </div>
      <Icon name="chev-right" size={14} />
    </Link>
  );
}
