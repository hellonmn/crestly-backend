import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import { BrandDot } from "@/components/BrandDot";
import {
  useDeletePeriod, useSavePeriod, useTimetablePeriods,
} from "./hooks";
import { QueryError } from "@/components/QueryError";
import { Anim } from "@/components/Anim";
import { useToast } from "@/components/Toast";
import { useShortcut } from "@/components/Shortcuts";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import type { TimetablePeriod } from "@crestly/shared";

/* ============================================================
   Timetable Periods — CRUD for period rows.
   Periods drive every grid view (section + teacher). Break
   periods render with a striped background and don't accept
   subject/teacher cells.
   ============================================================ */

function fmtTime(hms: string): string {
  return hms.slice(0, 5);  // "08:00:00" → "08:00"
}
function durationMinutes(start: string, end: string): number {
  const toM = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return ((h ?? 0) * 60) + (m ?? 0);
  };
  let d = toM(end) - toM(start);
  if (d < 0) d += 1440;
  return d;
}
function fmtMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function PeriodsPage() {
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("timetable.manage");
  const periodsQuery = useTimetablePeriods();
  const { data: periods, isLoading, error, refetch, isFetching } = periodsQuery;

  const [editing, setEditing] = useState<TimetablePeriod | "new" | null>(null);

  // Page-specific shortcut — press "n" to open the new-period form.
  useShortcut({
    keys: "n",
    description: "Add a new period",
    group: "On this page",
    handler: () => { if (canManage) setEditing("new"); },
    blockInInputs: true,
  });

  const teaching = (periods ?? []).filter((p) => !p.isBreak).length;
  const breaks   = (periods ?? []).filter((p) =>  p.isBreak).length;
  const total    = periods?.length ?? 0;
  const dayMins  = (periods ?? []).reduce(
    (s, p) => s + durationMinutes(p.startTime, p.endTime), 0,
  );

  return (
    <>
      <PageHead
        group="TIMETABLE"
        meta="PERIODS"
        title="Periods"
        lede="Define the rows of every timetable grid: period name, start/end time, and whether it's a break (lunch / recess). Changes take effect immediately for every section."
        actions={
          <>
            <Link to="/timetable" className="btn btn--ghost btn--sm">
              <Icon name="chev-left" size={14} /> Back to grid
            </Link>
            {canManage && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
                <Icon name="plus" size={14} /> Add period
              </button>
            )}
          </>
        }
      />


      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="periods" />

      {/* Stat tiles */}
      {isLoading ? (
        <Skeleton.StatRow count={4} />
      ) : (
        <div className="grid grid--cols-4 grid--gap-sm">
          <Tile tint="mint" label="TOTAL PERIODS" value={String(total)} delta={`${teaching} teaching`} />
          <Tile tint="sky" label="TEACHING SLOTS" value={String(teaching)} delta="rows in each day" />
          <Tile tint="wheat" label="BREAKS" value={String(breaks)} delta="lunch / recess" />
          <Tile tint="mustard" label="DAY LENGTH" value={fmtMinutes(dayMins)} delta="first start → last end" />
        </div>
      )}

      {/* Periods table */}
      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Periods<BrandDot /></h3>
            <div className="table-card__sub">
              {total.toLocaleString("en-IN")} period{total === 1 ? "" : "s"} configured
            </div>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={6} cols={5} /></div>
        ) : error ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="muted body-s">
              Couldn't load periods. Use the Retry link in the banner above.
            </div>
          </div>
        ) : total === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <Anim name="empty" size={180} />
            <div className="label" style={{ marginBottom: 8, marginTop: 4 }}>NO PERIODS</div>
            <div className="muted body-s">
              No periods configured for the current academic session.
              {canManage && (
                <>
                  {" "}
                  <button type="button" className="link-btn" onClick={() => setEditing("new")} style={{ color: "var(--orange-deep)", textDecoration: "underline", background: "transparent", border: 0, cursor: "pointer", font: "inherit" }}>
                    Add the first one →
                  </button>
                </>
              )}
            </div>
            <div className="muted body-s" style={{ marginTop: 12, fontSize: 11 }}>
              Periods are tied to the active session. If you've added them under a different session, switch it from the sidebar.
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>#</th>
                <th>Period</th>
                <th style={{ width: 130 }}>Start</th>
                <th style={{ width: 130 }}>End</th>
                <th style={{ width: 90 }}>Length</th>
                <th style={{ width: 100 }}>Type</th>
                {canManage && <th style={{ width: 60, textAlign: "right" }}></th>}
              </tr>
            </thead>
            <tbody>
              {[...(periods ?? [])]
                .sort((a, b) => a.sortOrder - b.sortOrder || a.periodNo - b.periodNo)
                .map((p) => {
                  const mins = durationMinutes(p.startTime, p.endTime);
                  return (
                    <tr key={p.id} className={p.isBreak ? "p-break" : ""}>
                      <td className="mono" style={{ color: "var(--ink-60)" }}>{p.periodNo}</td>
                      <td className="td-name">
                        <b>{p.name}</b>
                      </td>
                      <td className="mono body-s">{fmtTime(p.startTime)}</td>
                      <td className="mono body-s">{fmtTime(p.endTime)}</td>
                      <td className="mono body-s">{fmtMinutes(mins)}</td>
                      <td>
                        {p.isBreak ? (
                          <span className="pill pill--wheat" style={{ fontSize: 10, padding: "1px 7px" }}>BREAK</span>
                        ) : (
                          <span className="pill pill--info" style={{ fontSize: 10, padding: "1px 7px" }}>TEACHING</span>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(p)}>
                            <Icon name="edit" size={12} /> Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <PeriodModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <style>{PERIODS_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

function PeriodModal({
  initial, onClose,
}: {
  initial: TimetablePeriod | null;
  onClose: () => void;
}) {
  const isNew = !initial;
  const [periodNo, setPeriodNo] = useState<string>(String(initial?.periodNo ?? 0));
  const [name, setName]         = useState(initial?.name ?? "");
  const [startTime, setStart]   = useState(initial?.startTime?.slice(0, 5) ?? "08:00");
  const [endTime, setEnd]       = useState(initial?.endTime?.slice(0, 5)   ?? "08:45");
  const [isBreak, setIsBreak]   = useState(initial?.isBreak ?? false);
  const [sortOrder, setSortOrder] = useState<string>(String(initial?.sortOrder ?? 0));
  const [err, setErr] = useState<string | null>(null);
  /** When a mutation succeeds, swap the modal body for an animation
   *  + label, keep the modal frame and size, auto-close after a beat. */
  const [done, setDone] = useState<null | { type: "success" | "delete"; label: string }>(null);

  const save   = useSavePeriod(initial?.id);
  const remove = useDeletePeriod();
  const toast  = useToast();

  const mins = durationMinutes(startTime, endTime);

  // After a success/delete is shown, hold the animation for 1.6s then close.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(onClose, 1600);
    return () => window.clearTimeout(t);
  }, [done, onClose]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await save.mutateAsync({
        periodNo: Number(periodNo) || 0,
        name: name.trim(),
        startTime,
        endTime,
        isBreak,
        sortOrder: Number(sortOrder) || 0,
      });
      setDone({ type: "success", label: "Period saved" });
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  async function onDelete() {
    if (!initial) return;
    // Close the modal immediately + show an undoable toast. The actual API
    // call only fires after the toast times out (5s); if the user clicks
    // Undo, the period is never deleted at all.
    const target = initial;
    onClose();
    const result = await toast.undoable(
      `Deleted "${target.name}"`,
      () => remove.mutateAsync(target.id),
      { timeoutMs: 5000 },
    );
    if (result === "done") toast.success(`Period "${target.name}" deleted`);
  }

  // When `done` is set, the modal frame stays — same width, same chrome —
  // but the body is replaced with a centered animation. Title + actions
  // are hidden so nothing distracts from the moment.
  if (done) {
    return (
      <Modal open title="" onClose={onClose}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 0 16px",
            minHeight: 220,
          }}
        >
          <Anim name={done.type} size={180} />
          <div
            style={{
              marginTop: 4,
              fontFamily: "var(--font-display, system-ui)",
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {done.label}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={isNew ? "Add period" : `Edit ${initial?.name}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete period
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="period-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="period-form" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field span-2">
          <label className="field__label field__label--req" htmlFor="p-name">Name</label>
          <input
            id="p-name"
            className="input"
            placeholder={isBreak ? "Lunch break" : "Period 1"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="p-start">Start</label>
          <input
            id="p-start"
            className="input mono"
            type="time"
            value={startTime}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="p-end">End</label>
          <input
            id="p-end"
            className="input mono"
            type="time"
            value={endTime}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="p-no">Period #</label>
          <input
            id="p-no"
            className="input mono"
            type="number"
            min={0}
            max={20}
            value={periodNo}
            onChange={(e) => setPeriodNo(e.target.value)}
          />
          <span className="field__hint">0 for breaks, 1+ for teaching periods.</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="p-order">Sort order</label>
          <input
            id="p-order"
            className="input mono"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
          <span className="field__hint">Controls the row order in the grid.</span>
        </div>
        <div className="field span-2">
          <label className="check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isBreak} onChange={(e) => setIsBreak(e.target.checked)} />
            <span>This row is a <b>break</b> — render striped, don't accept subject/teacher cells</span>
          </label>
        </div>
        <div className="muted body-s" style={{ gridColumn: "1 / -1" }}>
          Duration: <b style={{ color: "var(--ink)" }}>{fmtMinutes(mins)}</b>
          {mins > 90 && <span style={{ color: "var(--warn)", marginLeft: 8 }}>· unusually long</span>}
        </div>
        {err && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={14} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile (smaller variant)                                         */
/* ------------------------------------------------------------------ */

function Tile({ tint, label, value, delta }: {
  tint: "mint" | "sky" | "wheat" | "mustard" | "rose" | "peach";
  label: string; value: string; delta: string;
}) {
  return (
    <div className="stat-tile">
      <span className={`stat-tile__icon icon-tint-${tint}`}>
        <Icon name="clock" size={16} />
      </span>
      <div className="stat-tile__body">
        <div className="stat-tile__label">{label}</div>
        <div className="stat-tile__value">{value}</div>
        <div className="stat-tile__delta">{delta}</div>
      </div>
    </div>
  );
}

const PERIODS_CSS = `
  .p-break td {
    background: repeating-linear-gradient(45deg,
      var(--cream-soft), var(--cream-soft) 8px,
      var(--cream) 8px, var(--cream) 16px) !important;
    color: var(--ink-60);
    font-style: italic;
  }
  .p-break td b { font-style: normal; color: var(--ink); }
`;
