import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useAddFollowup, useEnquiry } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import type { AdmissionFollowup, EnquirySource, EnquiryStatus } from "@crestly/shared";

/* ============================================================
   Admissions enquiry detail — ports erp/admissions/index.php's
   detail half (lines 73-186). Two-column layout: enquiry card +
   log-followup form, plus a full-width timeline beneath.
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
const OPEN_STATUSES: EnquiryStatus[] = ["new", "contacted", "visit_scheduled", "visited", "application"];

function padId(n: number): string { return String(n).padStart(4, "0"); }
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date}, ${time}`;
}
function fmtDayShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function phoneDigits(s: string | null): string {
  if (!s) return "";
  return s.replace(/\D+/g, "").replace(/^91/, "").slice(-10);
}

export function EnquiryViewPage() {
  const { id } = useParams<{ id: string }>();
  const enquiryId = Number(id);
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("admissions.manage");

  const { data, isLoading, error } = useEnquiry(enquiryId);
  const addFollowup = useAddFollowup(enquiryId);

  const [note, setNote] = useState("");
  const [statusTo, setStatusTo] = useState<EnquiryStatus | "">("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await addFollowup.mutateAsync({
        note: note.trim() || null,
        statusTo: statusTo || null,
        nextFollowUp: nextFollowUp || null,
        lostReason: lostReason.trim() || null,
      });
      setNote("");
      setStatusTo("");
      setNextFollowUp("");
      setLostReason("");
      setFlash("Follow-up logged.");
      setTimeout(() => setFlash(null), 3000);
    } catch (e) {
      setErr(getErrorMessage(e, "Could not save follow-up"));
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHead group="ADMISSION" title="Loading…" />
        <div className="card"><Skeleton.Title width="60%" /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="ADMISSION" title="Not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>No enquiry with id #{enquiryId}.</span>
        </div>
        <Link to="/admissions" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to enquiries
        </Link>
      </>
    );
  }

  const phone = phoneDigits(data.phone);
  const isOpen = OPEN_STATUSES.includes(data.status);
  const today = new Date().toISOString().slice(0, 10);
  const due = data.followUpDate !== null && data.followUpDate <= today && isOpen;

  return (
    <>
      <PageHead
        group="ADMISSION"
        meta={`ENQ-${padId(data.id)}`}
        title={data.childName}
        lede={
          <span className="muted body-s">
            ENQ-{padId(data.id)} · {SOURCE_LABEL[data.source]}
            {data.sourceDetail && <> ({data.sourceDetail})</>}
          </span>
        }
        actions={
          <>
            <Link to="/admissions" className="btn btn--ghost btn--sm">← All enquiries</Link>
            {canManage && (
              <Link to={`/admissions/${data.id}/edit`} className="btn btn--ghost btn--sm">
                <Icon name="edit" size={14} /> Edit details
              </Link>
            )}
            {data.status === "admitted" && canManage && (
              <Link
                to={`/students/new?fromEnquiry=${data.id}`}
                className="btn btn--primary btn--sm"
              >
                <Icon name="plus" size={14} /> Create student record →
              </Link>
            )}
          </>
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}

      <div className="grid grid--cols-2 grid--gap-sm" style={{ alignItems: "start" }}>

        {/* LEFT — Enquiry card */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <h2 style={{ margin: "0 0 2px", fontSize: 22 }}>{data.childName}</h2>
              <div className="muted body-s" style={{ fontSize: 13 }}>
                ENQ-{padId(data.id)} · {SOURCE_LABEL[data.source]}
                {data.sourceDetail && <> ({data.sourceDetail})</>}
              </div>
            </div>
            <span className={`pill ${STATUS_PILL[data.status]}`}>
              <span className="pill__dot" />{STATUS_LABEL[data.status]}
            </span>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "8px 16px",
              fontSize: 14,
            }}
          >
            <span className="muted">Parent</span>
            <span>{data.parentName ?? "—"}</span>

            <span className="muted">Phone</span>
            <span>
              <a href={`tel:${data.phone}`} style={{ color: "var(--orange-deep)", textDecoration: "none" }}>
                {data.phone}
              </a>
              {phone && (
                <a
                  href={`https://wa.me/91${phone}`}
                  target="_blank"
                  rel="noopener"
                  style={{ marginLeft: 8, color: "#25D366", textDecoration: "none" }}
                >
                  WhatsApp ↗
                </a>
              )}
            </span>

            {data.email && (
              <>
                <span className="muted">Email</span>
                <span>{data.email}</span>
              </>
            )}

            <span className="muted">Class sought</span>
            <span>{data.classSeeking ?? "—"}</span>

            <span className="muted">City</span>
            <span>{data.city ?? "—"}</span>

            <span className="muted">Assigned to</span>
            <span>{data.assignedToName ?? "Unassigned"}</span>

            <span className="muted">Follow-up</span>
            <span style={due ? { color: "var(--error)", fontWeight: 600 } : undefined}>
              {data.followUpDate ? `${fmtDayShort(data.followUpDate)}${due ? " · due" : ""}` : "—"}
            </span>

            {data.status === "lost" && data.lostReason && (
              <>
                <span className="muted">Lost reason</span>
                <span>{data.lostReason}</span>
              </>
            )}

            <span className="muted">Created</span>
            <span>
              {fmtDay(data.createdAt.slice(0, 10))}
              {data.createdByName && <> by {data.createdByName}</>}
            </span>
          </div>

          {data.notes && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 12px",
                background: "var(--cream-soft)",
                borderRadius: 10,
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {data.notes}
            </div>
          )}
        </div>

        {/* RIGHT — Log a follow-up */}
        {canManage ? (
          <div className="card">
            <h3 style={{ margin: "0 0 10px", fontSize: 17 }}>Log a follow-up</h3>
            <form onSubmit={onSubmit}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label className="field__label" htmlFor="fu-note">What happened?</label>
                <textarea
                  id="fu-note"
                  className="input input--area"
                  rows={2}
                  placeholder="Called parent, shared brochure…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="grid grid--cols-2 grid--gap-sm">
                <div className="field">
                  <label className="field__label" htmlFor="fu-status">Move to status</label>
                  <select
                    id="fu-status"
                    className="select"
                    value={statusTo}
                    onChange={(e) => setStatusTo(e.target.value as EnquiryStatus | "")}
                  >
                    <option value="">— keep {STATUS_LABEL[data.status]} —</option>
                    {(Object.keys(STATUS_LABEL) as EnquiryStatus[])
                      .filter((k) => k !== data.status)
                      .map((k) => (
                        <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="fu-next">Next follow-up date</label>
                  <input
                    id="fu-next"
                    className="input"
                    type="date"
                    value={nextFollowUp}
                    onChange={(e) => setNextFollowUp(e.target.value)}
                  />
                </div>
              </div>

              {statusTo === "lost" && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label className="field__label" htmlFor="fu-lost">Reason lost</label>
                  <input
                    id="fu-lost"
                    className="input"
                    placeholder="Chose another school, fee, distance…"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                  />
                </div>
              )}

              {err && (
                <div className="banner banner--error" style={{ marginTop: 10 }}>
                  <Icon name="alert" size={16} />
                  <span>{err}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn--primary btn--sm"
                disabled={addFollowup.isPending}
                style={{ marginTop: 12 }}
              >
                {addFollowup.isPending ? "Saving…" : "Save follow-up"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card card--cream">
            <div className="label" style={{ marginBottom: 6 }}>READ-ONLY</div>
            <div className="muted body-s">
              You can view this enquiry but not log follow-ups. Contact the admissions admin to update status.
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>Timeline</h3>
        {data.followups.length === 0 ? (
          <div className="muted body-s">No follow-ups logged yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.followups.map((f) => <TimelineRow key={f.id} f={f} />)}
          </div>
        )}
      </div>
    </>
  );
}

function TimelineRow({ f }: { f: AdmissionFollowup }) {
  const statusTo = f.statusTo as EnquiryStatus | null;
  return (
    <div className="enq-time-row">
      <div className="enq-time-dot" />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13 }}>
          {statusTo && (
            <span
              className={`pill ${STATUS_PILL[statusTo] ?? "pill--neutral"}`}
              style={{ fontSize: 11, padding: "1px 8px", marginRight: 6 }}
            >
              → {STATUS_LABEL[statusTo] ?? statusTo.replace("_", " ")}
            </span>
          )}
          {f.note ? (
            <span>{f.note}</span>
          ) : (
            <span className="muted">status update</span>
          )}
        </div>
        <div className="muted body-s" style={{ fontSize: 12, marginTop: 3 }}>
          {fmtDateTime(f.createdAt)}
          {f.createdByName && <> · {f.createdByName}</>}
          {f.nextFollowUp && <> · next: {fmtDayShort(f.nextFollowUp)}</>}
        </div>
      </div>
      <style>{ENQ_TIME_CSS}</style>
    </div>
  );
}

const ENQ_TIME_CSS = `
  .enq-time-row {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--rule);
  }
  .enq-time-row:last-child { border-bottom: 0; }
  .enq-time-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--orange);
    margin-top: 6px;
    flex-shrink: 0;
  }
`;
