import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useEditRequest, useReviewRequest } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import type { EditRequestField, EditRequestStatus } from "@crestly/shared";

/* ============================================================
   Admin per-request review screen — ports erp/approvals/view.php.
   Per-field current → proposed diff with individual Approve /
   Reject radios and a reviewer note. Requester-self-view shows
   a read-only "waiting for admin review" banner.
   ============================================================ */

type Decision = "approve" | "reject";

const FIELD_LABELS: Record<string, string> = {
  student_name:    "Student name",
  father_name:     "Father name",
  mother_name:     "Mother name",
  dob:             "Date of birth",
  age:             "Age",
  gender:          "Gender",
  address:         "Address",
  school_name:     "School",
  board:           "Board",
  father_contact:  "Father · phone",
  mother_contact:  "Mother · phone",
  calling_number:  "Calling number",
  whatsapp_number: "WhatsApp number",
};
function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_PILL: Record<EditRequestStatus, string> = {
  pending:  "pill--warn",
  approved: "pill--success",
  rejected: "pill--error",
  partial:  "pill--info",
};
const FIELD_PILL: Record<EditRequestField["fieldStatus"], string> = {
  pending:  "pill--warn",
  approved: "pill--success",
  rejected: "pill--error",
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
  return `${date} · ${time}`;
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

export function ApprovalReviewPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminView = user?.roleSlug === "admin" || user?.roleSlug === "principal";

  const { data, isLoading, error } = useEditRequest(requestId);
  const review = useReviewRequest(requestId);

  // Default each pending field's decision to "approve" — matches PHP's
  // `$current_choice = $fs === 'pending' ? 'approve' : $fs;`
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [reasons, setReasons]     = useState<Record<number, string>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (isLoading) {
    return (
      <>
        <PageHead group="APPROVALS" title="Loading…" />
        <div className="card"><Skeleton.Title width="60%" /><Skeleton.Text width="40%" style={{ marginTop: 8 }} /></div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHead group="APPROVALS" title="Not found" />
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span>No edit request with id #{requestId}.</span>
        </div>
        <Link to="/approvals" className="btn btn--ghost btn--sm" style={{ alignSelf: "flex-start" }}>
          ← Back to queue
        </Link>
      </>
    );
  }

  const isPending     = data.status === "pending";
  const canReviewNow  = isPending && isAdminView;
  const decisionFor   = (f: EditRequestField): Decision =>
    decisions[f.id] ?? (f.fieldStatus === "approved" ? "approve" : f.fieldStatus === "rejected" ? "reject" : "approve");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setErr(null);
    try {
      await review.mutateAsync({
        decisions: data.fields.map((f) => {
          const d = decisionFor(f);
          return {
            fieldId: f.id,
            decision: d,
            rejectionReason: d === "reject" && reasons[f.id]?.trim() ? reasons[f.id]!.trim() : null,
          };
        }),
        reviewNote: reviewNote.trim() || null,
      });
      navigate("/approvals?flash=reviewed");
    } catch (e) {
      setErr(getErrorMessage(e, "Couldn't save"));
    }
  }

  return (
    <>
      <PageHead
        group="APPROVALS"
        meta={`REQUEST #${data.id}`}
        title={data.studentName}
        lede={
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="cls-pill">{data.studentClass}-{data.studentSection}</span>
            <span className={`pill ${STATUS_PILL[data.status]}`}>
              <span className="pill__dot" />{cap(data.status)}
            </span>
            <span className="muted body-s">
              By <b>{data.requestedByName ?? "—"}</b> · {fmtDateTime(data.requestedAt)}
            </span>
          </div>
        }
        actions={
          <Link to="/approvals" className="btn btn--ghost btn--sm">← Back</Link>
        }
      />

      {data.note && (
        <p className="muted body-s" style={{ marginTop: -8, marginBottom: 16, fontStyle: "italic" }}>
          "{data.note}"
        </p>
      )}

      {err && (
        <div className="banner banner--error">
          <Icon name="alert" size={16} />
          <span><b>Couldn't save:</b> {err}</span>
        </div>
      )}

      {!isPending && (
        <div className="banner banner--info">
          <Icon name="info" size={16} />
          <span>
            <b>Already reviewed</b>
            {data.reviewedByName && <> by {data.reviewedByName}</>}
            {data.reviewedAt && <> on {fmtDate(data.reviewedAt)}</>}.
            {data.reviewNote && <> Reviewer note: <i>"{data.reviewNote}"</i></>}
          </span>
        </div>
      )}

      <form onSubmit={onSubmit} id="review-form">

        <div className="label" style={{ marginBottom: 10 }}>
          CHANGED FIELDS · {data.fields.length}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.fields.map((f) => {
            const d = decisionFor(f);
            return (
              <div key={f.id} className="card" style={{ padding: "18px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 12,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div className="label" style={{ color: "var(--ink-60)" }}>{f.fieldName.toUpperCase()}</div>
                    <h3 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: 18 }}>
                      {fieldLabel(f.fieldName)}
                    </h3>
                  </div>
                  <span className={`pill ${FIELD_PILL[f.fieldStatus]}`}>
                    <span className="pill__dot" />{cap(f.fieldStatus)}
                  </span>
                </div>

                {/* old → new diff */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div className="diff-cell diff-cell--current">
                    <div className="label" style={{ color: "var(--ink-60)" }}>CURRENT</div>
                    <div className={`diff-value ${isBlank(f.oldValue) ? "is-empty" : ""}`}>
                      {isBlank(f.oldValue) ? "— empty —" : f.oldValue}
                    </div>
                  </div>
                  <div className="diff-cell diff-cell--proposed">
                    <div className="label" style={{ color: "var(--orange)" }}>PROPOSED</div>
                    <div className={`diff-value ${isBlank(f.newValue) ? "is-empty" : ""}`}>
                      {isBlank(f.newValue) ? "— empty —" : f.newValue}
                    </div>
                  </div>
                </div>

                {canReviewNow ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <label className={`dec-chip ${d === "approve" ? "is-active is-approve" : ""}`}>
                      <input
                        type="radio"
                        name={`d-${f.id}`}
                        checked={d === "approve"}
                        onChange={() => setDecisions((p) => ({ ...p, [f.id]: "approve" }))}
                        style={{ marginRight: 6 }}
                      />
                      Approve
                    </label>
                    <label className={`dec-chip ${d === "reject" ? "is-active is-reject" : ""}`}>
                      <input
                        type="radio"
                        name={`d-${f.id}`}
                        checked={d === "reject"}
                        onChange={() => setDecisions((p) => ({ ...p, [f.id]: "reject" }))}
                        style={{ marginRight: 6 }}
                      />
                      Reject
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Reason if rejecting (optional)"
                      value={reasons[f.id] ?? ""}
                      onChange={(e) => setReasons((p) => ({ ...p, [f.id]: e.target.value }))}
                      style={{ flex: 1, minWidth: 200, fontSize: 13 }}
                      disabled={d !== "reject"}
                    />
                  </div>
                ) : f.fieldStatus === "rejected" && f.rejectionReason ? (
                  <div className="muted body-s" style={{ fontStyle: "italic" }}>
                    Reason: "{f.rejectionReason}"
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {canReviewNow ? (
          <>
            <div className="card" style={{ padding: "18px 20px", marginTop: 16 }}>
              <div className="field">
                <label className="field__label" htmlFor="review_note">
                  Reviewer note <span className="muted body-s">(optional)</span>
                </label>
                <textarea
                  id="review_note"
                  className="input input--area"
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Visible to the requester. e.g. 'Approved most; rejected DOB until birth certificate is provided.'"
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                paddingTop: 16,
                marginTop: 8,
                borderTop: "1px solid var(--rule-soft)",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button type="submit" className="btn btn--primary" disabled={review.isPending}>
                {review.isPending ? "Applying…" : "Apply decisions"}
              </button>
              <Link to={`/students/${data.srNumber}`} className="btn btn--ghost">
                Open student profile
              </Link>
              <div style={{ flex: 1 }} />
              <span className="muted body-s">
                Approved fields will overwrite the live student record.
              </span>
            </div>
          </>
        ) : isPending && !isAdminView ? (
          <>
            <div className="banner banner--info" style={{ marginTop: 16 }}>
              <Icon name="clock" size={16} />
              <span>
                <b>Waiting for admin review.</b> The student profile will still show the existing
                values until each change is approved.
              </span>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <Link to={`/students/${data.srNumber}`} className="btn btn--ghost btn--sm">
                View student profile →
              </Link>
              <Link to="/approvals" className="btn btn--ghost btn--sm">
                ← Back to my requests
              </Link>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Link to={`/students/${data.srNumber}`} className="btn btn--ghost btn--sm">
              View student profile →
            </Link>
            <Link to="/approvals" className="btn btn--ghost btn--sm">
              ← Back to {isAdminView ? "queue" : "my requests"}
            </Link>
          </div>
        )}
      </form>

      <style>{REVIEW_CSS}</style>
    </>
  );
}

function isBlank(v: string | null): boolean {
  return v === null || v === "";
}

const REVIEW_CSS = `
  .diff-cell {
    border-radius: var(--r-3);
    padding: 10px 14px;
  }
  .diff-cell--current  { background: var(--cream); }
  .diff-cell--proposed { background: #FFF4ED; border: 1px solid rgba(242, 92, 25, 0.13); }
  .diff-value {
    font-family: var(--font-mono);
    font-size: 13px;
    margin-top: 4px;
    word-break: break-word;
    color: var(--ink);
  }
  .diff-value.is-empty { color: var(--ink-40); }

  .dec-chip {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: var(--r-pill);
    border: 1px solid var(--rule);
    background: var(--white);
    font-size: 13px;
    user-select: none;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }
  .dec-chip:hover { background: var(--cream-soft); }
  .dec-chip.is-active.is-approve {
    background: rgba(31, 111, 74, 0.08);
    border-color: var(--success);
    color: var(--success);
    font-weight: 600;
  }
  .dec-chip.is-active.is-reject {
    background: rgba(184, 53, 32, 0.08);
    border-color: var(--error);
    color: var(--error);
    font-weight: 600;
  }
`;
