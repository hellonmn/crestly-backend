import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { BrandDot } from "@/components/BrandDot";
import { Modal } from "@/components/Modal";
import {
  useBulkHours, useBulkSalary, useSaveShift, useShifts,
} from "./hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import type { ShiftRow } from "@crestly/shared";

/* ============================================================
   Shifts (Duty Hours) page — ports erp/shifts/index.php verbatim.
   3 stat tiles · search + role + dept filters · table with
   inline salary button + duty-hours "08:00 – 14:00 · 6h" + Set/
   Change action · is-missing row tint · bulk hours / salary
   ============================================================ */

function moneyCompact(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000)    return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000)      return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}
function timeToMinutes(hms: string): number {
  const [h, m] = hms.split(":").map(Number);
  return ((h ?? 0) * 60) + (m ?? 0);
}
function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function fmtTime(hms: string): string {
  return hms.slice(0, 5);  // "08:00:00" → "08:00"
}
function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

export function ShiftsPage() {
  const { user } = useAuth();
  const canEditSalary = (user?.permissions ?? []).includes("hr.salary.edit") ||
                        (user?.permissions ?? []).includes("hr.manage");

  const [params, setParams] = useSearchParams();
  const q          = params.get("q") ?? "";
  const roleSlug   = params.get("role") ?? "";
  const department = params.get("dept") ?? "";

  const [qInput, setQInput] = useState(q);

  // Debounce search → URL
  useMemo(() => {
    const t = setTimeout(() => {
      if (qInput === q) return;
      const next = new URLSearchParams(params);
      if (qInput) next.set("q", qInput); else next.delete("q");
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [qInput]);  // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, error, refetch, isFetching } = useShifts({
    q:          q || undefined,
    roleSlug:   roleSlug || undefined,
    department: department || undefined,
  });

  const [selected, setSelected]       = useState<Set<number>>(new Set());
  const [editingHours, setEditingHours] = useState<ShiftRow | null>(null);
  const [editingSalary, setEditingSalary] = useState<ShiftRow | null>(null);
  const [bulk, setBulk] = useState<"hours" | "salary" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function setParam(key: string, val: string) {
    const next = new URLSearchParams(params);
    if (val) next.set(key, val); else next.delete(key);
    setParams(next, { replace: true });
  }
  function resetFilters() {
    setQInput("");
    setParams(new URLSearchParams(), { replace: true });
  }
  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  function togglePick(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (!data) return;
    setSelected((prev) =>
      prev.size === data.rows.length ? new Set() : new Set(data.rows.map((r) => r.userId))
    );
  }

  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <PageHead
        group="HR"
        meta="SHIFTS"
        title="Duty Hours"
        lede="Set each staff member's working hours. Salary is auto-prorated against scheduled minutes. Schedule changes start from the date you pick and apply forward — past salary computations stay anchored to the schedule that was in force then."
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="shifts" />

      {/* Stat tiles — match PHP order: Scheduled / Without / Bulk-update */}
      <div className="grid grid--cols-3 grid--gap-sm">
        <StatTile
          tint="mint"
          icon="clock"
          label="STAFF SCHEDULED"
          value={String(data?.withSchedule ?? "—")}
          delta={data ? `of ${data.total.toLocaleString("en-IN")} in view` : ""}
        />
        <StatTile
          tint="mustard"
          icon="alert"
          label="WITHOUT SCHEDULE"
          value={String(data?.withoutSchedule ?? "—")}
          delta="can't compute salary"
          deltaTone={data && data.withoutSchedule > 0 ? "error" : undefined}
        />
        <div className="stat-tile">
          <span className="stat-tile__icon icon-tint-wheat">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16M4 12h16M4 17h10"/>
            </svg>
          </span>
          <div className="stat-tile__body">
            <div className="stat-tile__label">BULK UPDATE</div>
            <div className="stat-tile__value" style={{ fontSize: 14, lineHeight: 1.5 }}>
              <button
                type="button"
                className="bulk-link"
                disabled={selected.size === 0}
                onClick={() => setBulk("hours")}
              >
                Hours →{selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
              {canEditSalary && (
                <>
                  {"  ·  "}
                  <button
                    type="button"
                    className="bulk-link"
                    disabled={selected.size === 0}
                    onClick={() => setBulk("salary")}
                  >
                    Salary →{selected.size > 0 ? ` (${selected.size})` : ""}
                  </button>
                </>
              )}
            </div>
            <div className="stat-tile__delta">
              {selected.size > 0 ? `${selected.size} rows ticked` : "tick rows first"}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar card" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div className="search" style={{ flex: 1, minWidth: 200 }}>
          <Icon name="search" size={14} />
          <input
            type="search"
            placeholder="Search name, designation, phone…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 14 }}
          />
        </div>
        <select className="select" value={roleSlug} onChange={(e) => setParam("role", e.target.value)}>
          <option value="">All roles</option>
          {(data?.roles ?? []).map((r) => (
            <option key={r.id} value={r.slug}>{r.name}</option>
          ))}
        </select>
        <select className="select" value={department} onChange={(e) => setParam("dept", e.target.value)}>
          <option value="">All departments</option>
          {(data?.departments ?? []).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {(q || roleSlug || department) && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            Reset
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="table-card">
        <div className="table-card__head">
          <div>
            <h3 className="table-card__title">Staff schedules<BrandDot /></h3>
            <div className="table-card__sub">
              {rows.length.toLocaleString("en-IN")} rows
              {selected.size > 0 && <> · {selected.size} selected</>}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <label className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            Select all
          </label>
        </div>

        {isLoading ? (
          <div style={{ padding: 16 }}><Skeleton.Table rows={8} cols={7} /></div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 8 }}>NO STAFF</div>
            <div className="muted body-s">No staff match the current filter.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Name</th>
                <th>Role</th>
                <th>Salary</th>
                <th>Duty hours</th>
                <th>Since</th>
                <th style={{ width: 90, textAlign: "right" }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <ShiftTableRow
                  key={r.userId}
                  r={r}
                  isPicked={selected.has(r.userId)}
                  onPick={() => togglePick(r.userId)}
                  canEditSalary={canEditSalary}
                  onEditHours={() => setEditingHours(r)}
                  onEditSalary={() => setEditingSalary(r)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingHours && (
        <SingleHoursModal
          row={editingHours}
          onClose={() => setEditingHours(null)}
          onSaved={() => { setEditingHours(null); notify("Duty hours updated."); }}
        />
      )}
      {editingSalary && canEditSalary && (
        <SingleSalaryModal
          row={editingSalary}
          onClose={() => setEditingSalary(null)}
          onSaved={() => { setEditingSalary(null); notify("Salary updated."); }}
        />
      )}
      {bulk === "hours" && (
        <BulkHoursModal
          userIds={Array.from(selected)}
          onClose={() => setBulk(null)}
          onSaved={(count) => {
            setBulk(null);
            setSelected(new Set());
            notify(`Hours updated for ${count} staff.`);
          }}
        />
      )}
      {bulk === "salary" && canEditSalary && (
        <BulkSalaryModal
          userIds={Array.from(selected)}
          onClose={() => setBulk(null)}
          onSaved={(count) => {
            setBulk(null);
            setSelected(new Set());
            notify(`Salary updated for ${count} staff.`);
          }}
        />
      )}

      <style>{SHIFTS_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function ShiftTableRow({
  r, isPicked, onPick, canEditSalary, onEditHours, onEditSalary,
}: {
  r: ShiftRow;
  isPicked: boolean;
  onPick: () => void;
  canEditSalary: boolean;
  onEditHours: () => void;
  onEditSalary: () => void;
}) {
  const hasSched = !!r.dutyStart && !!r.dutyEnd;
  let mins = 0;
  if (hasSched) {
    mins = timeToMinutes(r.dutyEnd!) - timeToMinutes(r.dutyStart!);
    if (mins < 0) mins += 1440;
  }
  return (
    <tr className={hasSched ? "" : "shifts-row--missing"}>
      <td><input type="checkbox" checked={isPicked} onChange={onPick} /></td>
      <td className="td-name" style={{ minWidth: 0 }}>
        <b>{r.name}</b>
        <div className="muted body-s" style={{ fontSize: 11, marginTop: 2 }}>
          {r.designation ?? "—"} · {r.department ?? "—"}
        </div>
      </td>
      <td className="body-s">{r.roleName ?? <span className="muted">—</span>}</td>
      <td className="mono body-s">
        {canEditSalary ? (
          <button type="button" className="inline-link" onClick={onEditSalary}>
            {r.monthlySalary && r.monthlySalary > 0
              ? moneyCompact(r.monthlySalary)
              : <span className="pill pill--warn" style={{ fontSize: 10, padding: "1px 7px" }}>set</span>}
          </button>
        ) : r.monthlySalary && r.monthlySalary > 0 ? moneyCompact(r.monthlySalary) : "—"}
      </td>
      <td className="mono body-s">
        {hasSched ? (
          <>
            {fmtTime(r.dutyStart!)} – {fmtTime(r.dutyEnd!)}
            <span className="muted" style={{ marginLeft: 6 }}>· {formatMinutes(mins)}</span>
          </>
        ) : (
          <span className="pill pill--warn" style={{ fontSize: 10, padding: "1px 7px" }}>not set</span>
        )}
      </td>
      <td className="muted body-s">{hasSched && r.effectiveFrom ? fmtDate(r.effectiveFrom) : "—"}</td>
      <td style={{ textAlign: "right" }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onEditHours}>
          {hasSched ? "Change" : "Set"}
        </button>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Modals                                                              */
/* ------------------------------------------------------------------ */

function SingleHoursModal({
  row, onClose, onSaved,
}: {
  row: ShiftRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [start, setStart] = useState(row.dutyStart?.slice(0, 5) ?? "08:00");
  const [end, setEnd]     = useState(row.dutyEnd?.slice(0, 5) ?? "14:00");
  const [eff, setEff]     = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [err, setErr]     = useState<string | null>(null);
  const save = useSaveShift();

  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  let durationMins = endMins - startMins;
  if (durationMins < 0) durationMins += 1440;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await save.mutateAsync({
        userId: row.userId,
        dutyStart: start,
        dutyEnd: end,
        effectiveFrom: eff,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={`Set duty hours · ${row.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="hours-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="hours-form" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field span-2">
          <label className="field__label field__label--req" htmlFor="h-eff">Effective from</label>
          <input
            id="h-eff"
            className="input"
            type="date"
            value={eff}
            onChange={(e) => setEff(e.target.value)}
            required
          />
          <span className="field__hint">
            Applies from this date forward. Past days keep their old hours.
          </span>
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="h-start">Duty start</label>
          <input
            id="h-start"
            className="input mono"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="h-end">Duty end</label>
          <input
            id="h-end"
            className="input mono"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            required
          />
        </div>
        <div className="field span-2">
          <label className="field__label" htmlFor="h-notes">Notes (optional)</label>
          <input
            id="h-notes"
            className="input"
            maxLength={160}
            placeholder="e.g. winter timing"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="muted body-s" style={{ gridColumn: "1 / -1" }}>
          Duty length: <b style={{ color: "var(--ink)" }}>{formatMinutes(durationMins)}</b>
          {" · "}<span>monthly minutes auto-prorate salary.</span>
        </div>
        {err && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={16} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function SingleSalaryModal({
  row, onClose, onSaved,
}: {
  row: ShiftRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [salary, setSalary] = useState<string>(row.monthlySalary ? String(row.monthlySalary) : "");
  const [err, setErr] = useState<string | null>(null);
  const save = useBulkSalary();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await save.mutateAsync({ userIds: [row.userId], monthlySalary: Number(salary) });
      onSaved();
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={`Set monthly salary · ${row.name}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="salary-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="salary-form" onSubmit={onSubmit}>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="s-amount">Monthly salary (₹)</label>
          <input
            id="s-amount"
            className="input mono"
            type="number"
            min={0}
            step={100}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            placeholder="e.g. 25000"
            required
          />
          <span className="field__hint">
            This is the gross monthly figure. Actual pay is prorated by attendance and duty minutes.
          </span>
        </div>
        {err && (
          <div className="banner banner--error" style={{ marginTop: 10 }}>
            <Icon name="alert" size={16} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function BulkHoursModal({
  userIds, onClose, onSaved,
}: {
  userIds: number[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [start, setStart] = useState("08:00");
  const [end, setEnd]     = useState("14:00");
  const [eff, setEff]     = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr]     = useState<string | null>(null);
  const bulk = useBulkHours();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await bulk.mutateAsync({ userIds, dutyStart: start, dutyEnd: end, effectiveFrom: eff });
      onSaved(r.count ?? userIds.length);
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={`Bulk set duty hours · ${userIds.length} staff`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="bulk-hours" className="btn btn--primary" disabled={bulk.isPending}>
            {bulk.isPending ? "Saving…" : `Apply to ${userIds.length}`}
          </button>
        </>
      }
    >
      <form id="bulk-hours" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field span-2">
          <label className="field__label field__label--req" htmlFor="bh-eff">Effective from</label>
          <input
            id="bh-eff"
            className="input"
            type="date"
            value={eff}
            onChange={(e) => setEff(e.target.value)}
            required
          />
          <span className="field__hint">Same effective date applies to every selected member.</span>
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="bh-start">Duty start</label>
          <input id="bh-start" className="input mono" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="bh-end">Duty end</label>
          <input id="bh-end" className="input mono" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
        {err && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={16} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function BulkSalaryModal({
  userIds, onClose, onSaved,
}: {
  userIds: number[];
  onClose: () => void;
  onSaved: (count: number) => void;
}) {
  const [salary, setSalary] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const bulk = useBulkSalary();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const r = await bulk.mutateAsync({ userIds, monthlySalary: Number(salary) });
      onSaved(r.count ?? userIds.length);
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save"));
    }
  }

  return (
    <Modal
      open
      title={`Bulk set monthly salary · ${userIds.length} staff`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="bulk-salary" className="btn btn--primary" disabled={bulk.isPending}>
            {bulk.isPending ? "Saving…" : `Apply to ${userIds.length}`}
          </button>
        </>
      }
    >
      <form id="bulk-salary" onSubmit={onSubmit}>
        <div className="field">
          <label className="field__label field__label--req" htmlFor="bs-amount">Monthly salary (₹)</label>
          <input
            id="bs-amount"
            className="input mono"
            type="number"
            min={0}
            step={100}
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            required
          />
          <span className="field__hint">
            Overwrites every selected member's monthly salary to the same figure.
          </span>
        </div>
        {err && (
          <div className="banner banner--error" style={{ marginTop: 10 }}>
            <Icon name="alert" size={16} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

const SHIFTS_CSS = `
  .shifts-row--missing td {
    background: rgba(201, 122, 10, 0.04) !important;
    border-color: var(--warn) !important;
  }
  .shifts-row--missing td:first-child {
    border-left: 3px solid var(--warn);
  }

  .inline-link {
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline dotted;
    text-underline-offset: 3px;
  }
  .inline-link:hover { color: var(--orange-deep); }

  .bulk-link {
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
    color: var(--orange-deep);
    text-decoration: none;
  }
  .bulk-link:hover:not(:disabled) { text-decoration: underline; }
  .bulk-link:disabled {
    color: var(--ink-40);
    cursor: not-allowed;
  }
`;
