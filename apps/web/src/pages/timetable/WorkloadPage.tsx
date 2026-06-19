import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useWorkload } from "./hooks";

export function WorkloadPage() {
  const { data, isLoading, error, refetch, isFetching } = useWorkload();
  const totals = data
    ? {
        teachers: data.length,
        allotted: data.filter((r) => r.assignedSlots > 0).length,
        free: data.filter((r) => r.assignedSlots === 0).length,
        avgUtil: data.length > 0 ? Math.round(data.reduce((s, r) => s + r.utilizationPct, 0) / data.length) : 0,
      }
    : { teachers: 0, allotted: 0, free: 0, avgUtil: 0 };

  return (
    <>
      <PageHead
        group="TIMETABLE"
        title="Teacher Workload"
        lede="Per-teacher slot usage vs. capacity for the current session."
        actions={
          <Link to="/timetable" className="btn btn--ghost btn--sm">
            <Icon name="chev-left" size={14} /> Back
          </Link>
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="workload" />

      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <StatTile tint="mustard" icon="team" label="TEACHERS" value={String(totals.teachers)} delta="active" />
          <StatTile tint="mint" icon="check" label="ALLOTTED" value={String(totals.allotted)} delta="" />
          <StatTile tint="wheat" icon="alert" label="FREE" value={String(totals.free)} delta="no slots" />
          <StatTile tint="sky" icon="features" label="AVG UTIL" value={`${totals.avgUtil}%`} delta="across teachers" />
        </div>
      )}

      <div className="table-card">
        {isLoading ? (
          <div style={{ padding: 16 }}>
            <Skeleton.Table rows={8} cols={5} />
          </div>
        ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Slots</th>
              <th>Sections</th>
              <th>Utilisation</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((r) => (
              <tr key={r.userId}>
                <td className="td-name">{r.name}{r.designation && <div className="muted body-s">{r.designation}</div>}</td>
                <td className="muted">{r.department ?? "—"}</td>
                <td className="mono">{r.assignedSlots} / {r.capacitySlots}</td>
                <td className="mono">{r.sectionsCount}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, maxWidth: 160, height: 6, background: "var(--cream-soft)", borderRadius: 999 }}>
                      <div style={{
                        width: `${Math.min(r.utilizationPct, 100)}%`,
                        height: "100%",
                        background: r.utilizationPct > 90 ? "var(--error)" : r.utilizationPct > 60 ? "var(--success)" : "var(--info)",
                        borderRadius: 999,
                      }} />
                    </div>
                    <span className="mono" style={{ fontSize: 12 }}>{r.utilizationPct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </>
  );
}
