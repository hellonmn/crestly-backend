import { useMemo, useState } from "react";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import { useCalendarFeed, useSaveCalendarEvent, useDeleteCalendarEvent } from "./hooks";
import { getErrorMessage } from "@/lib/api";
import type {
  CalendarCategory, CalendarAudience, CalendarFeedItem, CalendarEventUpsert,
} from "@crestly/shared";

/* ============================================================
   School calendar — one merged feed (events + holidays + exams)
   for a month. Only `event` rows are editable; holiday/exam
   items are read-only mirrors from their own modules.
   ============================================================ */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const CATEGORY_LABEL: Record<CalendarCategory, string> = {
  event: "Event", ptm: "Parent-Teacher Meeting", function: "Function", activity: "Activity",
  sports: "Sports", exam: "Exam", fee: "Fee", meeting: "Meeting", notice: "Notice",
  holiday: "Holiday", other: "Other",
};

function pillClass(c: CalendarCategory): string {
  switch (c) {
    case "holiday": return "pill--success";
    case "exam":    return "pill--info";
    case "fee":     return "pill--wheat";
    case "ptm":
    case "meeting": return "pill--info";
    default:        return "pill--neutral";
  }
}

function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function fmtDay(iso: string): { d: string; dow: string } {
  const date = new Date(iso + "T00:00:00");
  return {
    d: String(date.getDate()).padStart(2, "0"),
    dow: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()] ?? "",
  };
}

export function CalendarPage() {
  const [month, setMonth] = useState<string>(thisMonth);
  const { data, isLoading, error, refetch, isFetching } = useCalendarFeed({ month });
  const [editing, setEditing] = useState<CalendarFeedItem | "new" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [y, m] = month.split("-").map(Number);
  const monthLabel = `${MONTHS[(m ?? 1) - 1]} ${y}`;

  // Group items by ISO date.
  const byDate = useMemo(() => {
    const groups = new Map<string, CalendarFeedItem[]>();
    for (const it of data?.items ?? []) {
      const arr = groups.get(it.date) ?? [];
      arr.push(it);
      groups.set(it.date, arr);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [data]);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  return (
    <>
      <PageHead
        group="SCHOOL"
        meta={monthLabel}
        title="Calendar"
        lede="All school events, holidays and exam dates in one place. Holidays and exams are pulled in automatically — add your own events (PTMs, functions, fee due dates, notices) here."
        actions={
          <>
            <div className="seg" role="group" aria-label="Month">
              <button type="button" className="seg__btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
              <button type="button" className="seg__btn is-on" onClick={() => setMonth(thisMonth())}>{monthLabel}</button>
              <button type="button" className="seg__btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
            </div>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setEditing("new")}>
              <Icon name="plus" size={14} /> Add event
            </button>
          </>
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="calendar" />

      {isLoading ? (
        <div className="card" style={{ marginTop: 18, padding: 24 }}>
          <Skeleton.Title width="30%" />
        </div>
      ) : byDate.length === 0 ? (
        <div className="card" style={{ marginTop: 18, padding: 32, textAlign: "center" }}>
          <div className="muted">No events, holidays or exams in {monthLabel}.</div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 18, padding: 8 }}>
          {byDate.map(([date, items]) => {
            const { d, dow } = fmtDay(date);
            return (
              <div key={date} className="cal-day">
                <div className="cal-day__date">
                  <span className="cal-day__d">{d}</span>
                  <span className="cal-day__dow">{dow}</span>
                </div>
                <div className="cal-day__items">
                  {items.map((it) => (
                    <button
                      key={it.key}
                      type="button"
                      className="cal-item"
                      disabled={!it.editable}
                      onClick={() => it.editable && setEditing(it)}
                      style={{ cursor: it.editable ? "pointer" : "default" }}
                    >
                      <span className={`pill ${pillClass(it.category)}`} style={{ fontSize: 9.5, padding: "1px 7px" }}>
                        {CATEGORY_LABEL[it.category].toUpperCase()}
                      </span>
                      <span className="cal-item__title">{it.title}</span>
                      {!it.allDay && it.startTime && (
                        <span className="muted body-s">{it.startTime}{it.endTime ? `–${it.endTime}` : ""}</span>
                      )}
                      {it.classLabel && <span className="muted body-s">· {it.classLabel}</span>}
                      {it.source !== "event" && <span className="muted body-s" style={{ marginLeft: "auto" }}>auto</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EventModal
          initial={editing === "new" ? null : editing}
          month={month}
          onClose={() => setEditing(null)}
          onSaved={(action) => notify(action === "deleted" ? "Event deleted." : "Event saved.")}
        />
      )}

      <style>{CAL_CSS}</style>
    </>
  );
}

const CATEGORIES: CalendarCategory[] = ["event","ptm","function","activity","sports","fee","meeting","notice","other"];
const AUDIENCES: { v: CalendarAudience; label: string }[] = [
  { v: "all", label: "Everyone" }, { v: "staff", label: "Staff only" }, { v: "parents", label: "Parents only" },
];

function EventModal({
  initial, month, onClose, onSaved,
}: {
  initial: CalendarFeedItem | null;
  month: string;
  onClose: () => void;
  onSaved: (action: "saved" | "deleted") => void;
}) {
  const isNew = !initial;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<CalendarCategory>(
    initial && initial.category !== "holiday" && initial.category !== "exam" ? initial.category : "event",
  );
  const [startDate, setStartDate] = useState(initial?.date ?? `${month}-01`);
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [allDay, setAllDay] = useState(initial?.allDay ?? true);
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [audience, setAudience] = useState<CalendarAudience>(initial?.audience ?? "all");
  const [classSlug, setClassSlug] = useState(initial?.classLabel ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [isHoliday, setIsHoliday] = useState(initial?.isHoliday ?? false);
  const [err, setErr] = useState<string | null>(null);

  const editId = initial?.source === "event" ? initial.refId : undefined;
  const save = useSaveCalendarEvent(editId);
  const remove = useDeleteCalendarEvent();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const payload: CalendarEventUpsert = {
      title: title.trim(),
      category,
      startDate,
      endDate: endDate || null,
      allDay,
      startTime: allDay ? null : startTime || null,
      endTime: allDay ? null : endTime || null,
      audience,
      classSlug: classSlug.trim() || null,
      location: location.trim() || null,
      isHoliday,
    };
    try {
      await save.mutateAsync(payload);
      onSaved("saved");
      onClose();
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to save event"));
    }
  }

  async function onDelete() {
    if (editId === undefined) return;
    if (!confirm(`Delete "${initial?.title}"?`)) return;
    try {
      await remove.mutateAsync(editId);
      onSaved("deleted");
      onClose();
    } catch (e) {
      setErr(getErrorMessage(e, "Failed to delete"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Add event" : `Edit ${initial?.title}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && editId !== undefined && (
            <button type="button" className="btn btn--danger" onClick={onDelete} style={{ marginRight: "auto" }}>Delete</button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="cal-event" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save event"}
          </button>
        </>
      }
    >
      <form id="cal-event" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field span-2">
          <label className="field__label field__label--req">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required placeholder="Annual Day" />
        </div>
        <div className="field">
          <label className="field__label">Category</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value as CalendarCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label">Audience</label>
          <select className="select" value={audience} onChange={(e) => setAudience(e.target.value as CalendarAudience)}>
            {AUDIENCES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field__label field__label--req">Start date</label>
          <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="field">
          <label className="field__label">End date (optional)</label>
          <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="field span-2">
          <label className="field__label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> All-day
          </label>
        </div>
        {!allDay && (
          <>
            <div className="field">
              <label className="field__label">Start time</label>
              <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">End time</label>
              <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </>
        )}
        <div className="field">
          <label className="field__label">Class (optional)</label>
          <input className="input" value={classSlug} onChange={(e) => setClassSlug(e.target.value)} maxLength={16} placeholder="6 or 6-A" />
          <span className="field__hint">Leave blank for school-wide.</span>
        </div>
        <div className="field">
          <label className="field__label">Location (optional)</label>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} placeholder="Auditorium" />
        </div>
        <div className="field span-2">
          <label className="field__label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} /> Mark as a non-working day
          </label>
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

const CAL_CSS = `
  .cal-day { display: flex; gap: 14px; padding: 10px 12px; border-top: 1px dashed var(--rule-soft); }
  .cal-day:first-child { border-top: 0; }
  .cal-day__date {
    flex-shrink: 0; width: 46px; text-align: center;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 4px;
  }
  .cal-day__d { font-family: var(--font-mono, monospace); font-weight: 800; font-size: 18px; color: var(--ink); line-height: 1; }
  .cal-day__dow { font-size: 10px; letter-spacing: .08em; color: var(--ink-40); text-transform: uppercase; }
  .cal-day__items { flex: 1; display: flex; flex-direction: column; gap: 6px; }
  .cal-item {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    background: var(--white); border: 1px solid var(--rule); border-radius: 10px;
    padding: 8px 12px; text-align: left; font: inherit; width: 100%;
  }
  .cal-item:not(:disabled):hover { border-color: var(--orange); background: var(--cream-soft); }
  .cal-item__title { font-weight: 600; font-size: 13px; color: var(--ink); }
`;
