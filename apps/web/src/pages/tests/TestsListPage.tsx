import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useTests, useSetTestStatus, useDeleteTest } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type { TestStatus } from "@crestly/shared";

const STATUS_FILTERS: { v: TestStatus | "all"; label: string }[] = [
  { v: "all", label: "All" },
  { v: "draft", label: "Draft" },
  { v: "published", label: "Published" },
  { v: "closed", label: "Closed" },
];

function statusChip(s: TestStatus): string {
  return s === "published" ? "chip--success" : s === "draft" ? "chip--muted" : "chip--error";
}

export function TestsListPage() {
  const [status, setStatus] = useState<TestStatus | "all">("all");
  const { data, isLoading, error, refetch, isFetching } = useTests(status === "all" ? {} : { status });
  const setStatusMut = useSetTestStatus();
  const remove = useDeleteTest();
  const [flash, setFlash] = useState<string | null>(null);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  async function onPublishToggle(id: number, current: TestStatus) {
    const action = current === "published" ? "close" : "publish";
    try {
      await setStatusMut.mutateAsync({ id, action });
      notify(action === "publish" ? "Test published." : "Test closed.");
    } catch (e) {
      notify(getErrorMessage(e, "Action failed"));
    }
  }

  async function onDelete(id: number, title: string) {
    if (!confirm(`Delete "${title}"? This removes all attempts too.`)) return;
    try {
      await remove.mutateAsync(id);
      notify("Test deleted.");
    } catch (e) {
      notify(getErrorMessage(e, "Delete failed"));
    }
  }

  return (
    <>
      <PageHead
        group="ACADEMICS"
        meta="TESTS"
        title="Tests"
        lede="Create MCQ + fill-in-the-blanks tests. Publish them and students attempt through the parent portal — answers are auto-graded and scores appear in results."
        actions={
          <>
            <div className="seg" role="group" aria-label="Status">
              {STATUS_FILTERS.map((f) => (
                <button key={f.v} type="button" className={`seg__btn ${status === f.v ? "is-on" : ""}`} onClick={() => setStatus(f.v)}>
                  {f.label}
                </button>
              ))}
            </div>
            <Link to="/tests/new" className="btn btn--primary btn--sm">
              <Icon name="plus" size={14} /> New test
            </Link>
          </>
        }
      />

      {flash && (
        <div className="banner banner--success"><Icon name="check" size={16} /><span>{flash}</span></div>
      )}

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="tests" />

      {isLoading ? (
        <div className="card" style={{ marginTop: 18, padding: 24 }}><Skeleton.Title width="30%" /></div>
      ) : !data || data.length === 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 32, textAlign: "center" }}>
          <div className="muted">No tests yet. Create your first one.</div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th><th>Class</th><th>Subject</th><th>Qs</th><th>Marks</th>
                <th>Attempts</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id}>
                  <td><Link to={`/tests/${t.id}/edit`} style={{ fontWeight: 600 }}>{t.title}</Link></td>
                  <td>{t.classSlug}{t.sectionCode ? `-${t.sectionCode}` : ""}</td>
                  <td>{t.subjectName ?? "—"}</td>
                  <td>{t.questionCount}</td>
                  <td>{t.totalMarks}</td>
                  <td>{t.attemptCount}</td>
                  <td><span className={`chip ${statusChip(t.status)}`}>{t.status}</span></td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link to={`/tests/${t.id}/results`} className="btn btn--ghost btn--sm">Results</Link>{" "}
                    {t.status !== "closed" || t.attemptCount > 0 ? (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onPublishToggle(t.id, t.status)} disabled={setStatusMut.isPending}>
                        {t.status === "published" ? "Close" : "Publish"}
                      </button>
                    ) : null}{" "}
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onDelete(t.id, t.title)} disabled={remove.isPending}>
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
