import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { useBulkAttendance, useMarkAttendance, useRoster } from "./hooks";
import { useClasses } from "../classes/hooks";
import type { AttendanceStatus } from "@crestly/shared";

const STATUSES: { value: AttendanceStatus; label: string; pill: string }[] = [
  { value: "present", label: "P", pill: "pill--success" },
  { value: "absent", label: "A", pill: "pill--error" },
  { value: "late", label: "L", pill: "pill--warn" },
  { value: "excused", label: "E", pill: "pill--info" },
];

function today(): string { return new Date().toISOString().slice(0, 10); }

export function AttendancePage() {
  const [date, setDate] = useState(today());
  const [classSlug, setClassSlug] = useState("");
  const [section, setSection] = useState("");
  const ready = !!classSlug && !!section;

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data, isLoading } = useRoster(ready ? { date, class: classSlug, section } : null);
  const mark = useMarkAttendance();
  const bulkMark = useBulkAttendance();

  const sectionsForClass = (classes ?? []).find((c) => c.slug === classSlug)?.sections ?? [];

  function onSetStatus(srNumber: number, status: AttendanceStatus) {
    mark.mutate({ srNumber, date, status });
  }
  function onMarkAllPresent() {
    if (!data) return;
    bulkMark.mutate({
      date,
      marks: data.rows.map((r) => ({ srNumber: r.srNumber, status: "present" as const })),
    });
  }
  function shift(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  const presentPct = data && data.rows.length > 0
    ? Math.round(((data.present + data.late) / data.rows.length) * 100)
    : 0;

  return (
    <>
      <PageHead
        group="RECORDS"
        meta={date}
        title="Attendance"
        lede={
          ready
            ? `${classSlug}-${section} · ${data?.rows.length ?? 0} students · ${presentPct}% present`
            : "Pick a class and section to load the roster."
        }
        actions={
          <>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(-1)}>‹ Prev</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDate(today())}>Today</button>
            <button className="btn btn--ghost btn--sm" onClick={() => shift(1)}>Next ›</button>
          </>
        }
      />

      <div className="toolbar card">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 160 }} />

        <select
          className="select"
          value={classSlug}
          onChange={(e) => { setClassSlug(e.target.value); setSection(""); }}
          disabled={classesLoading}
        >
          <option value="">{classesLoading ? "Loading classes…" : "Select class"}</option>
          {classes?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>

        <select
          className="select"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          disabled={!classSlug}
        >
          <option value="">{classSlug ? "Select section" : "Pick class first"}</option>
          {sectionsForClass.map((s) => (
            <option key={s.id} value={s.code}>
              {s.code}{s.teacherName ? ` · ${s.teacherName}` : ""} ({s.studentCount})
            </option>
          ))}
        </select>

        {ready && data && data.rows.length > 0 && (
          <button className="btn btn--primary btn--sm" onClick={onMarkAllPresent} disabled={bulkMark.isPending} style={{ marginLeft: "auto" }}>
            <Icon name="check" size={14} /> Mark all present
          </button>
        )}
      </div>

      {/* ---------- Empty state when no class/section is selected ---------- */}
      {!ready && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>GET STARTED</div>
          <div className="display-s" style={{ fontSize: 20, marginBottom: 6 }}>Pick a class and section</div>
          <p className="muted body-s" style={{ margin: 0 }}>
            {classesLoading
              ? "Loading classes…"
              : (classes?.length ?? 0) === 0
                ? <>No classes are set up yet. Add them under <Link to="/classes">Classes</Link>.</>
                : "Use the dropdowns above to load today's roster."}
          </p>
        </div>
      )}

      {ready && (
        <div className="grid grid--cols-4 grid--gap-sm">
          <StatTile tint="mint" icon="check" label="PRESENT" value={String(data?.present ?? "—")} delta="" />
          <StatTile tint="rose" icon="x" label="ABSENT" value={String(data?.absent ?? "—")} delta="" />
          <StatTile tint="wheat" icon="alert" label="LATE" value={String(data?.late ?? "—")} delta="" />
          <StatTile tint="sky" icon="info" label="EXCUSED" value={String(data?.excused ?? "—")} delta="" />
        </div>
      )}

      {ready && (
        <div className="table-card">
          {isLoading ? (
            <Skeleton.Table rows={8} cols={6} />
          ) : data && data.rows.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div className="label" style={{ marginBottom: 8 }}>NO STUDENTS</div>
              <div className="muted">This section has no students enrolled yet.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>SR #</th>
                  <th>Name</th>
                  <th>Father</th>
                  <th>Status</th>
                  <th>Marked at</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.rows.map((r) => (
                  <tr key={r.srNumber}>
                    <td className="td-sr mono">{r.srNumber}</td>
                    <td className="td-name">
                      <Link to={`/attendance/student/${r.srNumber}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="muted">{r.fatherName ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {STATUSES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            className={`pill ${r.status === s.value ? s.pill : "pill--neutral"}`}
                            style={{ cursor: "pointer", border: 0 }}
                            onClick={() => onSetStatus(r.srNumber, s.value)}
                            title={s.value}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="muted mono" style={{ fontSize: 11 }}>
                      {r.markedAt ? new Date(r.markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link to={`/attendance/student/${r.srNumber}`} className="btn btn--ghost btn--sm">
                        <Icon name="calendar" size={12} /> History
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
