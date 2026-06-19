import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { BrandDot } from "@/components/BrandDot";
import { Skeleton } from "@/components/Skeleton";
import { useEnquiries } from "./hooks";
import { useClasses } from "@/pages/classes/hooks";
import { useAuth } from "@/lib/auth-store";
import type { AdmissionEnquiry, EnquirySource, EnquiryStatus } from "@crestly/shared";

/* ============================================================
   Admissions list page — ports erp/admissions/index.php's full
   list view. 4 stat tiles (Total / Open / Admitted / Lost) with
   sub-stats matching PHP, filter toolbar, click-through rows.
   ============================================================ */

const STATUS_PILL: Record<EnquiryStatus, string> = {
  new:             "pill--info",
  contacted:       "pill--wheat",
  visit_scheduled: "pill--wheat",
  visited:         "pill--wheat",
  application:     "pill--info",
  admitted:        "pill--success",
  lost:            "pill--error",
};

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  new:             "New",
  contacted:       "Contacted",
  visit_scheduled: "Visit scheduled",
  visited:         "Visited",
  application:     "Application",
  admitted:        "Admitted",
  lost:            "Lost",
};

const SOURCE_LABEL: Record<EnquirySource, string> = {
  walk_in:   "Walk-in",
  phone:     "Phone",
  website:   "Website",
  referral:  "Referral",
  social:    "Social",
  newspaper: "Newspaper",
  hoarding:  "Hoarding",
  event:     "Event",
  other:     "Other",
};

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}
function padId(n: number): string { return String(n).padStart(4, "0"); }
function isDue(iso: string | null, status: EnquiryStatus): boolean {
  if (!iso) return false;
  if (status === "admitted" || status === "lost") return false;
  return iso <= new Date().toISOString().slice(0, 10);
}

export function AdmissionsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("admissions.manage");

  const [params, setParams] = useSearchParams();
  const q          = params.get("q") ?? "";
  const status     = (params.get("status") ?? "") as EnquiryStatus | "";
  const source     = (params.get("source") ?? "") as EnquirySource | "";
  const classSeek  = params.get("class") ?? "";
  const followups  = params.get("view") === "followups";

  const [qInput, setQInput] = useState(q);

  // Debounce search input → URL
  useMemo(() => {
    const t = setTimeout(() => {
      if (qInput === q) return;
      const next = new URLSearchParams(params);
      if (qInput) next.set("q", qInput); else next.delete("q");
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data: classes } = useClasses();

  const { data, isLoading, error, refetch, isFetching } = useEnquiries({
    q: q || undefined,
    status: status || undefined,
    source: source || undefined,
    followupsDue: followups || undefined,
    page: 1,
    pageSize: 200,
  });

  // Client-side class filter (PHP filters server-side; the schema doesn't expose
  // it yet — keeping the UI affordance, filtering in memory until the API gains
  // a `class` query param).
  const rows = useMemo(() => {
    if (!data) return [] as AdmissionEnquiry[];
    if (!classSeek) return data.items;
    return data.items.filter((e) => (e.classSeeking ?? "") === classSeek);
  }, [data, classSeek]);

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next, { replace: true });
  }
  function resetFilters() {
    setQInput("");
    setParams(new URLSearchParams(), { replace: true });
  }

  const t = data?.totals;

  return (
    <>
      <PageHead
        group="ADMISSION"
        meta="ENQUIRIES"
        title="Admission Enquiries"
        lede="Every parent enquiry — walk-in, phone, website, referral — captured in one place and tracked through the pipeline so no lead slips through."
        actions={
          canManage ? (
            <Link to="/admissions/new" className="btn btn--primary btn--sm">
              <Icon name="plus" size={14} /> New enquiry
            </Link>
          ) : undefined
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="enquiries" />

      {/* Stat tiles — match PHP order: Total / Open / Admitted / Lost */}
      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile
          tint="wheat"
          icon="admissions"
          label="TOTAL ENQUIRIES"
          value={t ? t.all.toLocaleString("en-IN") : "—"}
          delta={t ? `${t.thisMonth.toLocaleString("en-IN")} this month` : ""}
        />
        <StatTile
          tint="sky"
          icon="clock"
          label="OPEN PIPELINE"
          value={t ? t.open.toLocaleString("en-IN") : "—"}
          delta={t ? `${t.followupsDue.toLocaleString("en-IN")} follow-ups due` : ""}
          deltaTone={t && t.followupsDue > 0 ? "error" : undefined}
        />
        <StatTile
          tint="mint"
          icon="check"
          label="ADMITTED"
          value={t ? t.admitted.toLocaleString("en-IN") : "—"}
          delta={t ? `${t.conversion}% conversion` : ""}
        />
        <StatTile
          tint="rose"
          icon="x"
          label="LOST"
          value={t ? t.lost.toLocaleString("en-IN") : "—"}
          delta="closed — not joined"
        />
      </div>

      {/* Action row — quick toggles */}
      <div style={{ margin: "18px 0 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className={`btn btn--sm ${followups ? "btn--ink" : "btn--ghost"}`}
          onClick={() => setParam("view", followups ? "" : "followups")}
        >
          <Icon name="alert" size={14} />
          {" "}Follow-ups due{t && t.followupsDue > 0 ? ` (${t.followupsDue})` : ""}
        </button>
        {followups && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setParam("view", "")}>
            Show all
          </button>
        )}
      </div>

      {/* Filters toolbar */}
      <div className="toolbar card" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <span className="field__label">Search</span>
          <div className="search">
            <Icon name="search" size={14} />
            <input
              type="search"
              placeholder="Child, parent or phone…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }}
            />
          </div>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <span className="field__label">Status</span>
          <select className="select" value={status} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as EnquiryStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 160 }}>
          <span className="field__label">Source</span>
          <select className="select" value={source} onChange={(e) => setParam("source", e.target.value)}>
            <option value="">All sources</option>
            {(Object.keys(SOURCE_LABEL) as EnquirySource[]).map((k) => (
              <option key={k} value={k}>{SOURCE_LABEL[k]}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <span className="field__label">Class</span>
          <select className="select" value={classSeek} onChange={(e) => setParam("class", e.target.value)}>
            <option value="">All classes</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.slug}>{c.slug}</option>
            ))}
          </select>
        </div>
        {(q || status || source || classSeek || followups) && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      {/* List */}
      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Enquiries<BrandDot /></h3>
            <div className="table-card__sub">
              Showing {rows.length.toLocaleString("en-IN")} of {t ? t.all.toLocaleString("en-IN") : "—"}
              {followups && " · follow-ups due"}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={6} cols={8} /></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO ENQUIRIES</div>
            <div className="muted body-s">
              No enquiries match the current filters.
              {canManage && (
                <>
                  {" "}
                  <Link to="/admissions/new">Log a new enquiry →</Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                <th>ENQ #</th>
                <th>Child / Parent</th>
                <th>Phone</th>
                <th>Class</th>
                <th>Source</th>
                <th>Status</th>
                <th>Follow-up</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = isDue(r.followUpDate, r.status);
                return (
                  <tr
                    key={r.id}
                    className="adm-row"
                    onClick={() => navigate(`/admissions/${r.id}`)}
                  >
                    <td className="mono">ENQ-{padId(r.id)}</td>
                    <td>
                      <b>{r.childName}</b>
                      {r.parentName && (
                        <div className="muted body-s">{r.parentName}</div>
                      )}
                    </td>
                    <td>
                      <a
                        href={`tel:${r.phone}`}
                        className="mono"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: "var(--orange-deep)", textDecoration: "none" }}
                      >
                        {r.phone}
                      </a>
                    </td>
                    <td>
                      {r.classSeeking ? <span className="cls-pill">{r.classSeeking}</span> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <span className="pill pill--neutral" style={{ fontSize: 11, padding: "1px 8px" }}>
                        {SOURCE_LABEL[r.source]}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[r.status]}`} style={{ fontSize: 11, padding: "1px 9px" }}>
                        <span className="pill__dot" />
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td
                      className="mono"
                      style={due ? { color: "var(--error)", fontWeight: 600 } : undefined}
                    >
                      {r.followUpDate ? fmtDay(r.followUpDate) + (due ? " · due" : "") : <span className="muted">—</span>}
                    </td>
                    <td className="muted">{r.assignedToName ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{ADM_LIST_CSS}</style>
    </>
  );
}

const ADM_LIST_CSS = `
  .adm-row { cursor: pointer; transition: background 120ms ease; }
  .adm-row:hover { background: var(--cream-soft); }
`;
