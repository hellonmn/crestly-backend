import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { useHostelBoarders } from "./hooks";
import type { HostelBlock } from "@crestly/shared";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

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

const CLASS_OPTIONS = ["6th", "7th", "8th", "9th", "10th", "11th", "12th"];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function HostelBoardersPage() {
  const [params, setParams] = useSearchParams();
  const q     = params.get("q") ?? "";
  const block = (params.get("block") ?? "") as HostelBlock | "";
  const cls   = params.get("class") ?? "";

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

  // Debounced search.
  const [qInput, setQInput] = useState(q);
  useEffect(() => { setQInput(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => { if (qInput !== q) update({ q: qInput || null }); }, 250);
    return () => clearTimeout(t);
  }, [qInput, q, update]);

  const { data, isLoading, error, refetch, isFetching } = useHostelBoarders({
    q: q || undefined,
    block: (block || undefined) as HostelBlock | undefined,
    class: cls || undefined,
  });

  const rows = data ?? [];

  return (
    <>
      <style>{BOARDERS_CSS}</style>

      <Link to="/hostel" className="m-back-link">
        <Icon name="chev-right" size={14} style={{ transform: "rotate(180deg)" }} />
        <span>Hostel</span>
      </Link>

      <PageHead
        group="HOSTEL"
        meta="BOARDERS"
        title="Boarders"
        lede={isLoading
          ? "Loading…"
          : `${rows.length.toLocaleString("en-IN")} hostellers. Search by name, father, SR; filter by block / class.`}
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="boarders" />

      <form
        className="toolbar card"
        style={{ padding: "12px 16px" }}
        onSubmit={(e) => { e.preventDefault(); }}
      >
        <label className="search" htmlFor="bd-q">
          <Icon name="search" size={14} />
          <input
            id="bd-q"
            className="search__input"
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search name, father, SR…"
          />
        </label>
        <div className="toolbar__inline-filters">
          <select
            className="select"
            value={block}
            onChange={(e) => update({ block: e.target.value || null })}
          >
            <option value="">All blocks</option>
            <option value="Boys">Boys</option>
            <option value="Girls">Girls</option>
          </select>
          <select
            className="select"
            value={cls}
            onChange={(e) => update({ class: e.target.value || null })}
          >
            <option value="">All classes</option>
            {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
            <h3 className="table-card__title">Boarders<BrandDot /></h3>
            <div className="table-card__sub">{rows.length.toLocaleString("en-IN")} matching</div>
          </div>
        </div>
        <div className="boarder-head">
          <span>SR</span>
          <span>NAME</span>
          <span>CLASS</span>
          <span>ROOM</span>
          <span>GUARDIAN</span>
          <span>HOME CITY</span>
          <span></span>
        </div>
        {isLoading ? (
          <Skeleton.Table rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO MATCHES</div>
            <div className="muted body-s">No boarders match the current filter.</div>
          </div>
        ) : (
          rows.map((r) => (
            <div className="boarder-row" key={r.srNumber}>
              <span className="td-sr mono">{padSr(r.srNumber)}</span>
              <span className="td-name">
                <Link to={`/students/${r.srNumber}`} style={{ textDecoration: "none", color: "inherit", fontWeight: 600 }}>
                  {r.studentName}
                </Link>
                <div className="muted body-s" style={{ fontSize: 11.5, marginTop: 2 }}>
                  {r.fatherName || "—"}
                </div>
              </span>
              <span><span className="cls-pill">{r.class}-{r.section}</span></span>
              <span className="mono" style={{ fontSize: 12 }}>
                {r.roomNo ? (
                  <>
                    {r.roomNo}
                    {r.roomType && (
                      <span className="muted body-s" style={{ fontSize: 10.5 }}> · {r.roomType}</span>
                    )}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </span>
              <span className="body-s">
                {r.localGuardianName ? (
                  <>
                    {r.localGuardianName}
                    {r.localGuardianContact && (
                      <div className="muted mono" style={{ fontSize: 11 }}>{r.localGuardianContact}</div>
                    )}
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </span>
              <span className="muted body-s">
                {r.homeCity || "—"}
                {r.homeState && <div style={{ fontSize: 10.5 }}>{r.homeState}</div>}
              </span>
              <span style={{ textAlign: "right" }}>
                <Link to={`/students/${r.srNumber}`} className="btn btn--ghost btn--sm">View →</Link>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Mobile cards */}
      <div className="m-show">
        {rows.length === 0 && !isLoading ? (
          <div className="card" style={{ textAlign: "center", padding: "28px 18px" }}>
            <div className="muted body-s">No boarders match the current filter.</div>
          </div>
        ) : (
          <div className="m-list">
            {rows.map((r) => (
              <Link
                key={r.srNumber}
                to={`/students/${r.srNumber}`}
                className="m-list__item"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className={`m-list__avi m-list__avi--${r.block === "Boys" ? "sky" : "rose"}`}>
                  {initials(r.studentName)}
                </div>
                <div className="m-list__body">
                  <div className="m-list__title">{r.studentName}</div>
                  <div className="m-list__sub">
                    <span className="cls-pill" style={{ padding: "1px 7px", fontSize: 10 }}>
                      {r.class}-{r.section}
                    </span>
                    {r.roomNo && <> · <span className="mono">{r.roomNo}</span></>}
                  </div>
                  <div className="muted body-s" style={{ fontSize: 11, marginTop: 2 }}>
                    {r.homeCity || "—"} · {r.localGuardianName || "no guardian"}
                  </div>
                </div>
                {r.block && (
                  <span
                    className={`pill ${r.block === "Boys" ? "pill--info" : "pill--neutral"}`}
                    style={{ flexShrink: 0 }}
                  >
                    {r.block}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const BOARDERS_CSS = `
  .boarder-head, .boarder-row {
    display: grid;
    grid-template-columns: 60px 1.5fr 100px 130px 1.3fr 100px 80px;
    gap: 14px; padding: 12px 20px; align-items: center;
  }
  .boarder-head {
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
    font-family: var(--font-mono); font-size: 10.5px;
    letter-spacing: 0.14em; color: var(--ink-60);
  }
  .boarder-row { border-bottom: 1px solid var(--rule-soft); font-size: 13px; }
  .boarder-row:last-child { border-bottom: 0; }
  .boarder-row:hover { background: var(--cream-soft); }
`;
