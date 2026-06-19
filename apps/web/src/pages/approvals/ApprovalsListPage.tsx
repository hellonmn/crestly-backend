import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { useEditRequests } from "./hooks";
import { useAuth } from "@/lib/auth-store";
import type { EditRequestStatus } from "@crestly/shared";

const STATUS_PILL: Record<EditRequestStatus, string> = {
  pending: "pill--warn",
  approved: "pill--success",
  rejected: "pill--error",
  partial: "pill--info",
};

export function ApprovalsListPage() {
  const { user } = useAuth();
  const isAdmin = user?.roleSlug === "admin";
  const [status, setStatus] = useState<EditRequestStatus | "">("pending");
  const [mine, setMine] = useState(!isAdmin);
  const { data, isLoading, error, refetch, isFetching } = useEditRequests({
    status: status || undefined,
    mine,
  });

  return (
    <>
      <PageHead
        group="HR"
        title={isAdmin && !mine ? "Edit requests" : "My requests"}
        lede={
          isAdmin
            ? mine
              ? "Your own edit requests."
              : `${data?.filter((r) => r.status === "pending").length ?? 0} pending in the queue.`
            : "Teacher-side edit requests you have submitted."
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="approvals" />

      <div className="toolbar card">
        <div style={{ display: "flex", gap: 4 }}>
          {(["pending", "approved", "partial", "rejected", ""] as const).map((s) => (
            <button
              key={s || "all"}
              className={`btn btn--sm ${status === s ? "btn--ink" : "btn--ghost"}`}
              onClick={() => setStatus(s)}
            >
              {s || "all"}
            </button>
          ))}
        </div>
        {isAdmin && (
          <label className="check" style={{ marginLeft: "auto" }}>
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            My requests only
          </label>
        )}
      </div>

      <div className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Requested by</th>
              <th>Fields</th>
              <th>Date</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--ink-40)" }}>Loading…</td></tr>}
            {data?.map((r) => (
              <tr key={r.id}>
                <td className="td-name">{r.studentName}<div className="muted body-s mono">SR #{r.srNumber}</div></td>
                <td><span className="cls-pill">{r.studentClass}-{r.studentSection}</span></td>
                <td>{r.requestedByName ?? "—"}</td>
                <td className="mono">{r.fields.length}</td>
                <td className="mono" style={{ fontSize: 12 }}>{new Date(r.requestedAt).toLocaleDateString("en-IN")}</td>
                <td>
                  <span className={`pill ${STATUS_PILL[r.status]}`}>
                    <span className="pill__dot" />{r.status}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link to={`/approvals/${r.id}`} className="btn btn--primary btn--sm">
                    {isAdmin && r.status === "pending" ? "Review" : "View"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
