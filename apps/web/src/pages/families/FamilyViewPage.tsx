import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { BrandDot } from "@/components/BrandDot";
import { Skeleton } from "@/components/Skeleton";
import { useFamily } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import type { FamilyMember } from "@crestly/shared";

/* ============================================================
   Family detail page — ports erp/families/view.php verbatim.
   Left column: PARENTS card + sibling-discount policy note.
   Right column: YEARLY DISCOUNT card + CHILDREN list ordered
   eldest-first with per-row sibling-position pills.
   ============================================================ */

function initials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}
function pad(n: number, width = 3): string { return String(n).padStart(width, "0"); }
function moneyCompact(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
  return n + suffix;
}
function fmtMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(d);
}

export function FamilyViewPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const fid = Number(familyId);
  const { data, isLoading, error } = useFamily(fid);
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("students.manage");

  if (isLoading) {
    return (
      <>
        <PageHead group="FAMILIES" title="Loading…" />
        <div className="card"><Skeleton.Title width="60%" /><Skeleton.Text width="40%" style={{ marginTop: 8 }} /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="FAMILIES" title="Not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>No family with id #{fid}.</span>
        </div>
        <Link to="/families" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to families
        </Link>
      </>
    );
  }

  const declared = data.siblingCount ?? data.enrolledCount;
  const title = data.fatherName ?? `Family #${data.familyId}`;

  return (
    <>
      <PageHead
        group="RECORDS"
        meta={`FAMILIES · #${pad(data.familyId)}`}
        title={title}
        lede={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="pill pill--wheat">{declared} children</span>
            <span className="pill pill--mint">
              {data.activeCount} of {declared} enrolled
            </span>
            {data.yearlyDiscountTotal > 0 && (
              <span className="pill pill--success">
                <span className="pill__dot" />
                –{moneyCompact(data.yearlyDiscountTotal)} discount
              </span>
            )}
            {data.motherName && (
              <span className="muted body-s" style={{ marginLeft: 4 }}>· {data.motherName}</span>
            )}
          </div>
        }
        actions={
          <>
            <Link to="/families" className="btn btn--ghost btn--sm">← Back</Link>
            <Link to={`/students?familyId=${data.familyId}`} className="btn btn--ghost btn--sm">
              View roster →
            </Link>
            {canManage && (
              <>
                <Link to={`/students/new?familyId=${data.familyId}`} className="btn btn--ink btn--sm">
                  <Icon name="plus" size={14} /> Add child
                </Link>
                <Link to={`/families/${data.familyId}/edit`} className="btn btn--ghost btn--sm">
                  <Icon name="edit" size={14} /> Edit
                </Link>
              </>
            )}
          </>
        }
      />

      <div className="grid grid--split-r grid--gap-lg" style={{ alignItems: "start" }}>

        {/* LEFT — Parents card + Discount policy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div className="label" style={{ marginBottom: 10 }}>PARENTS</div>
            <div className="detail-list">
              <DRow k="Father" v={data.fatherName ?? "—"} />
              <DRow k="Mother" v={data.motherName ?? "—"} />
              <DRow k="Reported children" v={String(declared)} />
              <DRow
                k="Currently enrolled"
                v={`${data.enrolledCount} (${data.activeCount} active)`}
              />
              {data.membersText && (
                <DRow k="Imported note" v={data.membersText} wide />
              )}
            </div>
          </div>

          <div className="card card--cream">
            <div className="label" style={{ marginBottom: 8 }}>DISCOUNT POLICY</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>
              Eldest = full tuition · 2nd child <b>12% off</b> tuition · 3rd+ child <b>18% off</b> tuition.
              Ranking is by <b>date of birth</b> (eldest first), not enrolment order.
            </div>
          </div>
        </div>

        {/* RIGHT — Discount summary + Children list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          <div>
            <div className="label" style={{ marginBottom: 10 }}>
              YEARLY TUITION DISCOUNT · THIS SESSION
            </div>
            <div className="card">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div className="label">APPLIED TO THIS FAMILY</div>
                  <div
                    className="display-m"
                    style={{ marginTop: 6, color: "var(--success)" }}
                  >
                    –{moneyCompact(data.yearlyDiscountTotal)}<BrandDot />
                  </div>
                  <div className="muted body-s" style={{ marginTop: 4 }}>
                    of {moneyCompact(data.totalYearlyFee)} total fee
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 10 }}>
              CHILDREN ({data.members.length}) · ELDEST FIRST
            </div>

            {data.members.length === 0 ? (
              <div className="card" style={{ textAlign: "center", padding: 24 }}>
                <div className="muted body-s">No children enrolled yet.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {data.members.map((m, i) => (
                  <ChildRow key={m.srNumber} m={m} position={i + 1} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{FAM_VIEW_CSS}</style>
    </>
  );
}

function ChildRow({ m, position }: { m: FamilyMember; position: number }) {
  const pct = m.siblingDiscountPct;
  let tagPill = "pill--neutral";
  let tagLabel = `${ordinal(position)} child`;
  if (pct >= 18) { tagPill = "pill--success"; tagLabel += " · 18% off"; }
  else if (pct >= 12) { tagPill = "pill--info"; tagLabel += " · 12% off"; }
  else tagLabel += " · no discount";

  const isInactive = m.status !== "active";
  return (
    <Link
      to={`/students/${m.srNumber}`}
      className="fam-child-row"
      style={isInactive ? { opacity: 0.6 } : undefined}
    >
      <div className="fam-child-row__avi">{initials(m.studentName)}</div>
      <div className="fam-child-row__body">
        <div className="fam-child-row__title">{m.studentName}</div>
        <div className="fam-child-row__sub">
          <span className="cls-pill">{m.class}-{m.section}</span>
          {m.dob && <span className="muted body-s">· born {fmtMonthYear(m.dob)}</span>}
          {isInactive && <span className="pill pill--neutral" style={{ fontSize: 10 }}>{m.status}</span>}
        </div>
      </div>
      <div className="fam-child-row__meta">
        <span className={`pill ${tagPill}`} style={{ fontSize: 11 }}>{tagLabel}</span>
        <span className="mono fam-child-row__sr">SR {pad(m.srNumber, 4)}</span>
      </div>
      <svg className="fam-child-row__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6"/>
      </svg>
    </Link>
  );
}

function DRow({
  k, v, wide,
}: {
  k: React.ReactNode;
  v: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="detail-row" style={wide ? { gridTemplateColumns: "130px 1fr" } : undefined}>
      <span className="detail-row__k">{k}</span>
      <span
        className="detail-row__v"
        style={wide ? { fontSize: 13, color: "var(--ink)", textAlign: "right", lineHeight: 1.5 } : undefined}
      >
        {v}
      </span>
    </div>
  );
}

const FAM_VIEW_CSS = `
  .fam-child-row {
    display: grid;
    grid-template-columns: 40px 1fr auto 18px;
    gap: 12px;
    align-items: center;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    padding: 12px 14px;
    text-decoration: none;
    color: inherit;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .fam-child-row:hover {
    background: var(--cream-soft);
    border-color: var(--rule-strong);
  }
  .fam-child-row__avi {
    width: 40px; height: 40px;
    border-radius: 50%;
    background: var(--tint-wheat);
    color: var(--tint-wheat-deep, #8a6a1f);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 14px;
  }
  .fam-child-row__body { min-width: 0; }
  .fam-child-row__title { font-weight: 600; font-size: 14px; color: var(--ink); }
  .fam-child-row__sub {
    margin-top: 2px;
    display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
    font-size: 12px;
  }
  .fam-child-row__meta {
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
  }
  .fam-child-row__sr {
    font-size: 10px; color: var(--ink-60); letter-spacing: 0.04em;
  }
  .fam-child-row__chev { color: var(--ink-40); }
`;
