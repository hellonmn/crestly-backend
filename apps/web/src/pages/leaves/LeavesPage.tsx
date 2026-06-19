import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import { useCancelLeave, useDecideLeave, useLeaves, useLeaveTypes } from "./hooks";
import type { LeaveStatus } from "@crestly/shared";

const STATUS_PILL: Record<LeaveStatus, string> = {
  pending: "pill--warn",
  approved: "pill--success",
  rejected: "pill--error",
  cancelled: "pill--neutral",
};

const TILE_TINTS = ["icon-tint-mint", "icon-tint-mustard", "icon-tint-sky", "icon-tint-wheat"];

/** Mirrors PHP `format_days` — strip trailing ".0" so 5.0 → "5", 5.5 stays. */
function fmtDays(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 10) / 10);
}

export function LeavesPage() {
  const { user } = useAuth();
  const isApprover = (user?.permissions ?? []).includes("leaves.approve");
  const canApply = (user?.permissions ?? []).includes("leaves.apply");

  // PHP `view` ≡ scope: pending (approver-only) · all (approver-only) · mine
  const [scope, setScope] = useState<"mine" | "queue" | "all">(isApprover ? "queue" : "mine");
  const [status, setStatus] = useState<LeaveStatus | "">("");
  const [typeId, setTypeId] = useState<number | "">("");

  const { data, isLoading } = useLeaves({
    scope,
    status: status || undefined,
    leaveTypeId: typeId || undefined,
  });
  const { data: types } = useLeaveTypes();
  const decide = useDecideLeave();
  const cancelM = useCancelLeave();

  async function onDecide(id: number, decision: "approve" | "reject") {
    const note = decision === "reject"
      ? window.prompt("Reason for rejection (optional):") ?? ""
      : window.prompt("Decision note (optional):") ?? "";
    try { await decide.mutateAsync({ id, input: { decision, decisionNote: note || null } }); }
    catch (e) { alert(getErrorMessage(e, "Failed")); }
  }

  // PHP picks the 4 quota'd types for tiles, excluding "unlimited" (LWP).
  // `annualQuota > 0` is the React-side equivalent — LWP has quota 0.
  const tiles = (data?.balances ?? [])
    .filter((b) => b.quota > 0)
    .slice(0, 4);

  return (
    <>
      <PageHead
        group="HR"
        meta="LEAVES"
        title="Leaves"
        lede={
          isApprover
            ? "Approve / reject pending requests. Approved leaves auto-pay salary & skip the absence cut."
            : "Apply for time off. Approved leaves are paid (CL/SL/EL/etc.) — LWP days are unpaid."
        }
      />

      {/* Balance tiles — even approvers see their own */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : tiles.length > 0 ? (
        <div className="grid grid--cols-4 grid--gap-sm">
          {tiles.map((b, i) => (
            <div key={b.leaveTypeId} className="stat-tile">
              <div className={`stat-tile__icon ${TILE_TINTS[i % TILE_TINTS.length]}`}>
                <Icon name="calendar" size={20} />
              </div>
              <div className="stat-tile__body">
                <div className="stat-tile__label">
                  {b.shortCode} · {b.leaveType.toUpperCase()}
                </div>
                <div className="stat-tile__value">{fmtDays(b.left)}</div>
                <div className="stat-tile__delta">
                  of {fmtDays(b.quota)} · used {fmtDays(b.taken)}
                  {b.pending > 0 && <> · <span style={{ color: "var(--warn)" }}>{fmtDays(b.pending)} pending</span></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tabs + filters */}
      <div className="toolbar card" style={{ padding: "12px 16px" }}>
        <div className="dept-tabs" style={{ display: "flex", gap: 8, flex: 1, overflow: "auto" }}>
          {isApprover && (
            <>
              <button
                type="button"
                className={`dept-tab ${scope === "queue" ? "is-active" : ""}`}
                onClick={() => setScope("queue")}
              >
                Pending
                <span className="dept-tab__count">{data?.pendingCount ?? 0}</span>
              </button>
              <button
                type="button"
                className={`dept-tab ${scope === "all" ? "is-active" : ""}`}
                onClick={() => setScope("all")}
              >
                All
              </button>
            </>
          )}
          <button
            type="button"
            className={`dept-tab ${scope === "mine" ? "is-active" : ""}`}
            onClick={() => setScope("mine")}
          >
            My leaves
          </button>
        </div>
        <div className="toolbar__inline-filters">
          <select
            className="select"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All types</option>
            {types?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortCode} · {t.name}
              </option>
            ))}
          </select>
          {scope !== "queue" && (
            <select
              className="select"
              value={status}
              onChange={(e) => setStatus(e.target.value as LeaveStatus | "")}
            >
              <option value="">Any status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          )}
          {canApply && (
            <Link to="/leaves/apply" className="btn btn--primary btn--sm">
              <Icon name="plus" size={14} /> Apply
            </Link>
          )}
        </div>
      </div>

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={4} cols={5} /></div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO RESULTS</div>
            <div className="muted body-s">
              {scope === "queue"
                ? "Nothing pending. Approvals queue is clear."
                : scope === "mine"
                  ? "You haven't applied for any leaves" + (status ? ` with status \"${status}\".` : " yet.")
                  : "No leaves match the current filter."}
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Staff</th>
                <th>From → To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((l) => {
                const canDecide = isApprover && l.status === "pending" && scope !== "mine";
                const canCancel = scope === "mine" && l.status === "pending";
                return (
                  <tr key={l.id}>
                    <td><span className="cls-pill">{l.leaveShortCode}</span></td>
                    <td className="td-name">{l.userName ?? "—"}</td>
                    <td className="mono">{l.fromDate}{l.fromDate !== l.toDate && ` → ${l.toDate}`}</td>
                    <td className="mono">{fmtDays(l.days)}{l.halfDay !== "none" && ` (${l.halfDay.replace("_", " ")})`}</td>
                    <td className="muted body-s">{l.reason ?? "—"}</td>
                    <td>
                      <span className={`pill ${STATUS_PILL[l.status]}`}>
                        <span className="pill__dot" />{l.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canDecide && (
                        <>
                          <button className="btn btn--success btn--sm" onClick={() => onDecide(l.id, "approve")}>Approve</button>
                          <button className="btn btn--danger btn--sm" style={{ marginLeft: 4 }} onClick={() => onDecide(l.id, "reject")}>Reject</button>
                        </>
                      )}
                      {canCancel && (
                        <button
                          className="btn btn--ghost btn--sm"
                          onClick={async () => {
                            if (!confirm("Cancel this leave?")) return;
                            try { await cancelM.mutateAsync(l.id); }
                            catch (e) { alert(getErrorMessage(e, "Failed")); }
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
