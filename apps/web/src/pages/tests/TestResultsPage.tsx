import { Link, useParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { StatTile } from "@/components/StatTile";
import { useTestResults } from "./hooks";

export function TestResultsPage() {
  const params = useParams();
  const id = Number(params.id);
  const { data, isLoading, error, refetch, isFetching } = useTestResults(id);

  const submitted = (data?.attempts ?? []).filter((a) => a.status === "submitted");

  return (
    <>
      <PageHead
        group="ACADEMICS"
        meta="RESULTS"
        title={data?.title ?? "Test results"}
        lede="Auto-graded scores for every student who attempted this test."
        actions={<Link to="/tests" className="btn btn--ghost btn--sm"><Icon name="chev-left" size={14} /> Back to tests</Link>}
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="results" />

      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile tint="mint" icon="users" label="ATTEMPTS" value={String(data?.attempts.length ?? "—")} delta="students" />
        <StatTile tint="sky" icon="check" label="SUBMITTED" value={String(submitted.length)} delta="graded" />
        <StatTile tint="wheat" icon="exams" label="AVERAGE" value={data?.averagePct != null ? `${data.averagePct}%` : "—"} delta={`out of ${data?.totalMarks ?? 0} marks`} />
      </div>

      {isLoading ? (
        <div className="card" style={{ marginTop: 18, padding: 24 }}><Skeleton.Title width="30%" /></div>
      ) : !data || data.attempts.length === 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 32, textAlign: "center" }}>
          <div className="muted">No attempts yet.</div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18, overflowX: "auto" }}>
          {data.passMarks != null && (
            <div className="muted body-s" style={{ padding: "10px 12px 0" }}>Pass mark: <b>{data.passMarks}</b> / {data.totalMarks}</div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>Student</th><th>Class</th><th>Score</th><th>%</th>
                {data.passMarks != null && <th>Result</th>}
                <th>Status</th><th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {data.attempts.map((a) => {
                const pct = a.score != null && a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : null;
                return (
                  <tr key={a.attemptId}>
                    <td style={{ fontWeight: 600 }}>{a.studentName}</td>
                    <td>{a.classLabel}</td>
                    <td>{a.score != null ? `${a.score} / ${a.maxScore}` : "—"}</td>
                    <td>{pct != null ? `${pct}%` : "—"}</td>
                    {data.passMarks != null && (
                      <td>
                        {a.passed == null ? "—" : (
                          <span className={`chip ${a.passed ? "chip--success" : "chip--error"}`}>{a.passed ? "Pass" : "Fail"}</span>
                        )}
                      </td>
                    )}
                    <td><span className={`chip ${a.status === "submitted" ? "chip--success" : "chip--muted"}`}>{a.status === "submitted" ? "submitted" : "in progress"}</span></td>
                    <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
