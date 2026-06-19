import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Modal } from "@/components/Modal";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { Anim } from "@/components/Anim";
import {
  useClearCell, useEligibleTeachers, useSaveCell, useSmartAllot, useTimetable,
} from "./hooks";
import { useClasses } from "@/pages/classes/hooks";
import { usePickableTeam } from "@/pages/team/hooks";
import { useExamSubjects } from "@/pages/exams/hooks";
import { useAuth } from "@/lib/auth-store";
import { getErrorMessage } from "@/lib/api";
import type {
  EligibleTeachersResponse,
  SmartAllotResult,
  TimetableCell, TimetablePeriod,
} from "@crestly/shared";

/* ============================================================
   Port of erp/timetable/index.php.

   Two views:
     - By Section: day × period grid for one (class, section)
     - By Teacher: same shape, one teacher's whole week (read-only)

   In section view + manage perm:
     - Click any non-break cell → editor modal
     - Subject dropdown filters teachers by subject + class band
     - Save catches teacher double-bookings → banner + force-resave
     - Smart Allot button (scope: this section OR every section)

   Pixel-faithful to the PHP source; classnames mirror tt-* in
   erp/timetable/index.php so we can reuse the design CSS later.
   ============================================================ */

const DAYS = [
  { idx: 1, short: "Mon", long: "Monday" },
  { idx: 2, short: "Tue", long: "Tuesday" },
  { idx: 3, short: "Wed", long: "Wednesday" },
  { idx: 4, short: "Thu", long: "Thursday" },
  { idx: 5, short: "Fri", long: "Friday" },
  { idx: 6, short: "Sat", long: "Saturday" },
] as const;

type Scope = "section" | "teacher";

export function TimetablePage() {
  const { user } = useAuth();
  const perms = user?.permissions ?? [];
  const canManage = perms.includes("timetable.manage");
  const myRole = user?.roleSlug ?? null;

  /* URL state — matches PHP: ?view=teacher&teacher=N OR ?class=X&section=Y */
  const [sp, setSp] = useSearchParams();

  const urlView = sp.get("view");
  const urlTeacher = sp.get("teacher");
  const urlClass = sp.get("class") ?? "";
  const urlSection = sp.get("section") ?? "";

  /* Teachers without manage perm default to their own schedule. */
  const isSelfTeacher = !canManage && myRole === "teacher";
  const myId = user?.id;
  const effectiveView: Scope =
    urlView === "teacher" || urlTeacher || (isSelfTeacher && !urlClass)
      ? "teacher"
      : "section";
  const effectiveTeacherId = urlTeacher
    ? Number(urlTeacher)
    : isSelfTeacher && myId
      ? myId
      : 0;

  const { data: classes } = useClasses();

  /* Default class/section when section view + nothing in URL: first class
     of the list, first section of that class. */
  const defaultClass = classes?.[0]?.slug ?? "";
  const classSlug = urlClass || defaultClass;
  const sectionsOfClass = useMemo(() => {
    if (!classSlug || !classes) return [] as { code: string; studentCount: number }[];
    const cls = classes.find((c) => c.slug === classSlug);
    return cls?.sections.map((s) => ({ code: s.code, studentCount: s.studentCount })) ?? [];
  }, [classSlug, classes]);
  const defaultSection = sectionsOfClass[0]?.code ?? "";
  const section = urlSection || defaultSection;

  function setScope(next: Scope) {
    if (next === "teacher") {
      const params = new URLSearchParams();
      params.set("view", "teacher");
      if (effectiveTeacherId) params.set("teacher", String(effectiveTeacherId));
      setSp(params, { replace: true });
    } else {
      const params = new URLSearchParams();
      if (classSlug) params.set("class", classSlug);
      if (section) params.set("section", section);
      setSp(params, { replace: true });
    }
  }
  function pickClass(slug: string) {
    const params = new URLSearchParams();
    params.set("class", slug);
    setSp(params, { replace: true });
  }
  function pickSection(code: string) {
    const params = new URLSearchParams();
    if (classSlug) params.set("class", classSlug);
    params.set("section", code);
    setSp(params, { replace: true });
  }
  function pickTeacher(id: number) {
    const params = new URLSearchParams();
    params.set("view", "teacher");
    if (id) params.set("teacher", String(id));
    setSp(params, { replace: true });
  }

  const query = effectiveView === "teacher"
    ? (effectiveTeacherId ? { teacherUserId: effectiveTeacherId } : null)
    : (classSlug && section ? { class: classSlug, section } : null);

  const { data, isLoading, error, refetch, isFetching } = useTimetable(query);

  /* Editor state */
  const [editing, setEditing] = useState<{ period: TimetablePeriod; day: number; cell: TimetableCell | null } | null>(null);
  const [smartOpen, setSmartOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function notify(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2200);
  }

  /* Build a lookup so cell render is O(1). */
  const cellByDP = useMemo(() => {
    const m = new Map<string, TimetableCell>();
    for (const c of data?.cells ?? []) m.set(`${c.dayOfWeek}|${c.periodId}`, c);
    return m;
  }, [data]);

  const periodList = data?.periods ?? [];
  const editable = effectiveView === "section" && canManage && !!classSlug && !!section;
  const noPeriods = !isLoading && periodList.length === 0;

  return (
    <>
      <PageHead
        group="ACADEMICS"
        meta="TIMETABLE"
        title="Timetable"
        lede={
          effectiveView === "teacher"
            ? canManage
              ? "Weekly teaching schedule. Switch to a section to build the grid."
              : "Your classes for the week, period by period."
            : "Build each section's weekly grid. Click a cell to assign a subject + teacher — double-bookings are flagged automatically."
        }
      />

      {flash && (
        <div className="banner banner--success">
          <Icon name="check" size={16} /><span>{flash}</span>
        </div>
      )}

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="timetable" />

      {noPeriods && (
        <div className="banner banner--warn">
          <span><b>No periods defined yet.</b> Set up the daily time-slots first.</span>
          {canManage && (
            <Link to="/timetable/periods" className="banner__link">Define periods →</Link>
          )}
        </div>
      )}

      {/* ===== Toolbar: view switch + selectors ===== */}
      <div className="toolbar card tt-toolbar" id="tt-toolbar" style={{ padding: "12px 16px", flexWrap: "wrap", gap: 10 }}>
        {(canManage || myRole !== "teacher") && (
          <div className="seg">
            <button
              type="button"
              className={`seg__btn ${effectiveView !== "teacher" ? "is-on" : ""}`}
              onClick={() => setScope("section")}
            >
              By Section
            </button>
            <button
              type="button"
              className={`seg__btn ${effectiveView === "teacher" ? "is-on" : ""}`}
              onClick={() => setScope("teacher")}
            >
              By Teacher
            </button>
          </div>
        )}

        {effectiveView === "teacher" ? (
          canManage || myRole !== "teacher" ? (
            <TeacherCombo
              currentId={effectiveTeacherId}
              currentLabel={data?.scope === "teacher" ? data.scopeLabel : ""}
              onPick={pickTeacher}
              onClear={() => setScope("teacher")}
            />
          ) : (
            <span className="muted body-s">Showing your schedule.</span>
          )
        ) : (
          <>
            <select
              className="select"
              value={classSlug}
              onChange={(e) => pickClass(e.target.value)}
              aria-label="Class"
              style={{ maxWidth: 200 }}
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <select
              className="select"
              value={section}
              onChange={(e) => pickSection(e.target.value)}
              aria-label="Section"
              style={{ maxWidth: 200 }}
            >
              {sectionsOfClass.length === 0 ? (
                <option value="">no sections</option>
              ) : (
                sectionsOfClass.map((s) => (
                  <option key={s.code} value={s.code}>
                    Section {s.code} ({s.studentCount})
                  </option>
                ))
              )}
            </select>
          </>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.print()}>
          <Icon name="print" size={14} /> Print
        </button>
        {["admin", "principal", "hr"].includes(myRole ?? "") && (
          <Link to="/timetable/workload" className="btn btn--ghost btn--sm">
            <Icon name="users" size={14} /> Workload
          </Link>
        )}
        {canManage && (
          <Link to="/timetable/periods" className="btn btn--ghost btn--sm">
            <Icon name="settings" size={14} /> Manage periods
          </Link>
        )}
      </div>

      {/* ===== Grid ===== */}
      {effectiveView === "teacher" && !effectiveTeacherId ? (
        <div className="card">
          <p className="muted">Pick a teacher to see their weekly schedule.</p>
        </div>
      ) : isLoading ? (
        <div className="card card--tight">
          <div className="tt-cap" style={{ alignItems: "center" }}>
            <Skeleton width={140} height={10} />
            <Skeleton width={80} height={26} style={{ borderRadius: 6 }} />
          </div>
          <TimetableGridSkeleton />
        </div>
      ) : noPeriods ? null : data ? (
        <div className="card card--tight">
          <div className="tt-cap">
            {effectiveView === "teacher" ? (
              <div className="label">SCHEDULE · {data.scopeLabel}</div>
            ) : (
              <div>
                <div className="label">SECTION · {data.scopeLabel}</div>
                <span className="muted body-s">
                  {data.fillCount ?? 0} slot{(data.fillCount ?? 0) === 1 ? "" : "s"} filled
                </span>
              </div>
            )}
            {effectiveView === "section" && canManage && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setSmartOpen(true)}>
                <Icon name="alert" size={14} /> Smart allot
              </button>
            )}
          </div>

          <TimetableGrid
            periods={periodList}
            cellByDP={cellByDP}
            mode={effectiveView}
            editable={editable}
            onOpenCell={(p, d) => {
              const cell = cellByDP.get(`${d}|${p.id}`) ?? null;
              setEditing({ period: p, day: d, cell });
            }}
          />
        </div>
      ) : null}

      {editing && classSlug && section && (
        <CellEditorModal
          classSlug={classSlug}
          sectionCode={section}
          period={editing.period}
          day={editing.day}
          cell={editing.cell}
          onClose={() => setEditing(null)}
          onSaved={(action) => notify(action === "deleted" ? "Slot cleared" : "Slot saved")}
        />
      )}

      {smartOpen && classSlug && section && (
        <SmartAllotModal
          classSlug={classSlug}
          sectionCode={section}
          onClose={() => setSmartOpen(false)}
          onDone={(res) => {
            const f = res.filled ?? 0;
            const u = res.unassigned ?? 0;
            const msg = res.msg
              ? res.msg
              : res.sections != null
                ? `Done · ${res.sections} sections, ${f} slots filled${u ? ` · ${u} need a teacher` : ""}${res.skipped ? ` · ${res.skipped} skipped (no subjects)` : ""}.`
                : `Filled ${f} slot${f === 1 ? "" : "s"}${u ? ` · ${u} need a teacher (review highlighted blanks)` : ""}.`;
            notify(msg);
          }}
        />
      )}

      <style>{TT_CSS}</style>
    </>
  );
}

/* ============================================================
   Grid (desktop CSS-grid + mobile day-stacked layout)
   ============================================================ */

function TimetableGrid({
  periods, cellByDP, mode, editable, onOpenCell,
}: {
  periods: TimetablePeriod[];
  cellByDP: Map<string, TimetableCell>;
  mode: Scope;
  editable: boolean;
  onOpenCell: (period: TimetablePeriod, day: number) => void;
}) {
  return (
    <>
      {/* DESKTOP GRID — period header + 6 day columns */}
      <div className="tt-wrap m-hide">
        <div
          className="tt-grid"
          style={{ gridTemplateColumns: `120px repeat(${DAYS.length}, minmax(0, 1fr))` }}
        >
          <div className="tt-cell tt-cell--corner" />
          {DAYS.map((d) => (
            <div key={d.idx} className="tt-cell tt-cell--dhead">{d.short}</div>
          ))}

          {periods.map((p) => (
            <PeriodRow
              key={p.id}
              period={p}
              cellByDP={cellByDP}
              mode={mode}
              editable={editable}
              onOpenCell={onOpenCell}
            />
          ))}
        </div>
      </div>

      {/* MOBILE — day-stacked cards */}
      <div className="tt-mobile m-show">
        {DAYS.map((d) => (
          <div key={d.idx} className="tt-mday">
            <div className="tt-mday__h">{d.long}</div>
            {periods.map((p) => {
              if (p.isBreak) {
                return <div key={p.id} className="tt-mrow tt-mrow--break">{p.name}</div>;
              }
              const cell = cellByDP.get(`${d.idx}|${p.id}`) ?? null;
              const has = !!cell && (cell.subjectId != null || cell.teacherUserId != null);
              return (
                <div
                  key={p.id}
                  className={`tt-mrow ${has ? "is-filled" : ""} ${editable ? "is-editable" : ""}`}
                  onClick={editable ? () => onOpenCell(p, d.idx) : undefined}
                  role={editable ? "button" : undefined}
                  tabIndex={editable ? 0 : undefined}
                  onKeyDown={editable ? (e) => {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCell(p, d.idx); }
                  } : undefined}
                >
                  <div className="tt-mrow__p">
                    <span className="tt-mrow__pno">P{p.periodNo}</span>
                    <span className="tt-mrow__pt mono">{p.startTime.slice(0, 5)}–{p.endTime.slice(0, 5)}</span>
                  </div>
                  <div className="tt-mrow__c">
                    {has ? (
                      <CellContent cell={cell!} mode={mode} large />
                    ) : (
                      <span className="muted body-s">{editable ? "Tap to assign" : "—"}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function PeriodRow({
  period, cellByDP, mode, editable, onOpenCell,
}: {
  period: TimetablePeriod;
  cellByDP: Map<string, TimetableCell>;
  mode: Scope;
  editable: boolean;
  onOpenCell: (period: TimetablePeriod, day: number) => void;
}) {
  return (
    <>
      <div className="tt-cell tt-cell--phead">
        <div className="tt-phead__no">{period.isBreak ? "—" : `P${period.periodNo}`}</div>
        <div className="tt-phead__nm">{period.name}</div>
        <div className="tt-phead__tm mono">
          {period.startTime.slice(0, 5)}–{period.endTime.slice(0, 5)}
        </div>
      </div>
      {period.isBreak ? (
        <div
          className="tt-cell tt-cell--break"
          style={{ gridColumn: `span ${DAYS.length}` }}
        >
          {period.name}
        </div>
      ) : (
        DAYS.map((d) => {
          const cell = cellByDP.get(`${d.idx}|${period.id}`) ?? null;
          const has = !!cell && (cell.subjectId != null || cell.teacherUserId != null);
          return (
            <div
              key={d.idx}
              className={
                "tt-cell tt-cell--slot " +
                (has ? "is-filled " : "") +
                (editable ? "is-editable" : "")
              }
              onClick={editable ? () => onOpenCell(period, d.idx) : undefined}
              role={editable ? "button" : undefined}
              tabIndex={editable ? 0 : undefined}
              onKeyDown={editable ? (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCell(period, d.idx); }
              } : undefined}
            >
              {has
                ? <CellContent cell={cell!} mode={mode} />
                : <span className="tt-slot__empty">{editable ? "+" : ""}</span>}
            </div>
          );
        })
      )}
    </>
  );
}

/** Cell body — matches `$content` closure in PHP's tt_render_grid_html(). */
function CellContent({ cell, mode, large }: { cell: TimetableCell; mode: Scope; large?: boolean }) {
  const subj = cell.subjectName || cell.subjectShortCode || (mode === "section" ? "Activity" : "—");
  const fw = (n: string | null) => (n ? n.split(" ")[0] : "");
  const has2 = cell.subjectId2 != null;

  if (has2) {
    const subj2 = cell.subjectName2 || cell.subjectShortCode2 || "—";
    return (
      <>
        <div className="tt-slot__subj" style={large ? { fontSize: 14 } : undefined}>
          {subj} <span className="tt-slot__or">/</span> {subj2}
        </div>
        {mode === "teacher" ? (
          <div className="tt-slot__meta" style={large ? { fontSize: 12 } : undefined}>
            {cell.classSlug}-{cell.sectionCode}
          </div>
        ) : (
          (cell.teacherName || cell.teacherName2) && (
            <div className="tt-slot__meta" style={large ? { fontSize: 12 } : undefined}>
              {fw(cell.teacherName)}{cell.teacherName && cell.teacherName2 ? " / " : ""}{fw(cell.teacherName2)}
            </div>
          )
        )}
        {cell.room && <div className="tt-slot__room mono">{cell.room}</div>}
      </>
    );
  }
  return (
    <>
      <div className="tt-slot__subj" style={large ? { fontSize: 14 } : undefined}>{subj}</div>
      {mode === "teacher" ? (
        <div className="tt-slot__meta" style={large ? { fontSize: 12 } : undefined}>
          {cell.classSlug}-{cell.sectionCode}
        </div>
      ) : cell.teacherName ? (
        <div className="tt-slot__meta" style={large ? { fontSize: 12 } : undefined}>
          {fw(cell.teacherName)}
        </div>
      ) : null}
      {cell.room && <div className="tt-slot__room mono">{cell.room}</div>}
    </>
  );
}

/* ============================================================
   Cell editor modal — PHP tt-modal.
   ============================================================ */

function CellEditorModal({
  classSlug, sectionCode, period, day, cell, onClose, onSaved,
}: {
  classSlug: string;
  sectionCode: string;
  period: TimetablePeriod;
  day: number;
  cell: TimetableCell | null;
  onClose: () => void;
  onSaved: (action: "saved" | "deleted") => void;
}) {
  const { data: subjects } = useExamSubjects();
  const { data: eligible } = useEligibleTeachers(classSlug);
  const { data: team }     = usePickableTeam();
  const save  = useSaveCell();
  const clear = useClearCell();

  const eligibleSubjects = useMemo(() => {
    const list = subjects ?? [];
    const mapped = list.filter((s) => s.classes.includes(classSlug));
    return mapped.length > 0 ? mapped : list;
  }, [subjects, classSlug]);

  const allTeachersForParallel = useMemo(() => {
    return (team?.items ?? []).map((u) => ({
      id: u.id,
      label: `${u.name}${u.designation ? ` · ${u.designation}` : ""}`,
    }));
  }, [team]);

  const [subjectId, setSubjectId]       = useState<string>(cell?.subjectId       ? String(cell.subjectId)       : "");
  const [teacherUserId, setTeacherUid]  = useState<string>(cell?.teacherUserId   ? String(cell.teacherUserId)   : "");
  const [showAllTeachers, setShowAll]   = useState<boolean>(false);
  const [parToggle, setParToggle]       = useState<boolean>(!!cell?.subjectId2);
  const [subjectId2, setSubjectId2]     = useState<string>(cell?.subjectId2      ? String(cell.subjectId2)      : "");
  const [teacherUserId2, setTeacherUid2] = useState<string>(cell?.teacherUserId2 ? String(cell.teacherUserId2)  : "");
  const [room, setRoom]                 = useState<string>(cell?.room ?? "");
  const [notes, setNotes]               = useState<string>(cell?.notes ?? "");
  const [conflict, setConflict]         = useState<string | null>(null);
  const [forceNext, setForceNext]       = useState<boolean>(false);
  const [err, setErr]                   = useState<string | null>(null);

  /* Filtered teacher list (mirrors PHP's rebuildTeachers()). */
  const filteredTeachers = useMemo(() => {
    return computeFilteredTeachers(eligible, subjectId, showAllTeachers, teacherUserId);
  }, [eligible, subjectId, showAllTeachers, teacherUserId]);

  const teacherHint = useMemo(() => {
    if (showAllTeachers || !subjectId) return "· all staff";
    const ids = eligible?.bySubject[subjectId] ?? [];
    if (ids.length === 0) return "· none matched — showing all";
    return `· ${filteredTeachers.length} teach this subject + grade`;
  }, [showAllTeachers, subjectId, eligible, filteredTeachers.length]);

  const dayLong = DAYS.find((d) => d.idx === day)?.long ?? "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await save.mutateAsync({
        classSlug,
        sectionCode,
        dayOfWeek: day,
        periodId: period.id,
        subjectId:      subjectId      ? Number(subjectId)      : null,
        teacherUserId:  teacherUserId  ? Number(teacherUserId)  : null,
        subjectId2:     parToggle && subjectId2     ? Number(subjectId2)     : null,
        teacherUserId2: parToggle && teacherUserId2 ? Number(teacherUserId2) : null,
        room:  room.trim()  || null,
        notes: notes.trim() || null,
        force: forceNext,
      });
      onSaved("saved");
      onClose();
    } catch (e) {
      const msg = getErrorMessage(e, "Save failed");
      if (/already booked/i.test(msg)) {
        setConflict(msg + " Click Save again to assign anyway.");
        setForceNext(true);
      } else {
        setErr(msg);
      }
    }
  }

  async function onClear() {
    setErr(null);
    if (!confirm(`Clear ${classSlug}-${sectionCode} · ${dayLong} · ${period.name}?`)) return;
    try {
      await clear.mutateAsync({
        classSlug, sectionCode, dayOfWeek: day, periodId: period.id,
      });
      onSaved("deleted");
      onClose();
    } catch (e) {
      setErr(getErrorMessage(e, "Clear failed"));
    }
  }

  return (
    <Modal
      open
      title={`${classSlug}-${sectionCode} · ${dayLong}`}
      onClose={onClose}
      actions={
        <>
          {cell && (
            <button type="button" className="btn btn--danger btn--sm" onClick={onClear} style={{ marginRight: "auto" }}>
              Clear slot
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="tt-cell-form" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="tt-cell-form" onSubmit={onSubmit} className="form-grid">
        <div className="field span-2">
          <label className="field__label" htmlFor="tt-subject">Subject</label>
          <select
            id="tt-subject"
            className="select"
            value={subjectId}
            onChange={(e) => { setSubjectId(e.target.value); setForceNext(false); setConflict(null); }}
          >
            <option value="">— none / activity —</option>
            {eligibleSubjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.shortCode})</option>
            ))}
          </select>
        </div>

        <div className="field span-2">
          <label className="field__label" htmlFor="tt-teacher">
            Teacher
            <span className="muted" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>
              {teacherHint}
            </span>
          </label>
          <select
            id="tt-teacher"
            className="select"
            value={teacherUserId}
            onChange={(e) => { setTeacherUid(e.target.value); setForceNext(false); setConflict(null); }}
          >
            <option value="">— unassigned —</option>
            {filteredTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <label className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showAllTeachers}
              onChange={(e) => setShowAll(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            Show all teachers (ignore subject + grade filter)
          </label>
        </div>

        <div className="field span-2" style={{ borderTop: "1px dashed var(--rule-soft)", paddingTop: 10 }}>
          <label className="muted body-s" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={parToggle}
              onChange={(e) => setParToggle(e.target.checked)}
              style={{ width: 14, height: 14 }}
            />
            Parallel elective — a 2nd subject runs in this slot (e.g. Maths / Biology split)
          </label>
        </div>

        {parToggle && (
          <div className="field span-2">
            <label className="field__label" htmlFor="tt-subject2">Parallel subject</label>
            <select
              id="tt-subject2"
              className="select"
              value={subjectId2}
              onChange={(e) => setSubjectId2(e.target.value)}
            >
              <option value="">— none —</option>
              {eligibleSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.shortCode})</option>
              ))}
            </select>
            <label className="field__label" htmlFor="tt-teacher2" style={{ marginTop: 8 }}>Parallel teacher</label>
            <select
              id="tt-teacher2"
              className="select"
              value={teacherUserId2}
              onChange={(e) => setTeacherUid2(e.target.value)}
            >
              <option value="">— unassigned —</option>
              {allTeachersForParallel.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="tt-room">Room (optional)</label>
          <input
            id="tt-room"
            className="input"
            type="text"
            maxLength={40}
            placeholder="e.g. Room 12 / Lab"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tt-notes">Note (optional)</label>
          <input
            id="tt-notes"
            className="input"
            type="text"
            maxLength={120}
            placeholder="e.g. combined class"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {conflict && (
          <div className="banner banner--warn" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={14} /><span>{conflict}</span>
          </div>
        )}
        {err && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={14} /><span>{err}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

function computeFilteredTeachers(
  eligible: EligibleTeachersResponse | undefined,
  subjectId: string,
  showAll: boolean,
  keepVal: string,
): { id: number; label: string }[] {
  if (!eligible) return [];
  const ids = !showAll && subjectId ? eligible.bySubject[subjectId] : null;
  const all = eligible.teachers.map((t) => ({
    id: t.id,
    label: `${t.name}${t.designation ? ` · ${t.designation}` : ""}`,
  }));
  let list: typeof all;
  if (ids && ids.length > 0) {
    const set = new Set(ids);
    list = all.filter((t) => set.has(t.id));
  } else {
    list = all;
  }
  // Always include the currently-assigned teacher even if filtered out.
  if (keepVal && !list.some((t) => String(t.id) === keepVal)) {
    const extra = all.filter((t) => String(t.id) === keepVal);
    list = [...extra, ...list];
  }
  return list;
}

/* ============================================================
   Smart-allot modal — PHP tt-allot-modal.
   ============================================================ */

function SmartAllotModal({
  classSlug, sectionCode, onClose, onDone,
}: {
  classSlug: string;
  sectionCode: string;
  onClose: () => void;
  onDone: (r: SmartAllotResult) => void;
}) {
  const allot = useSmartAllot();
  const [scope, setScope] = useState<"section" | "all">("section");
  const [clearFirst, setClearFirst] = useState(false);
  const [result, setResult] = useState<{ kind: "info" | "error"; msg: string } | null>(null);

  async function onGo() {
    if (scope === "all") {
      const msg = "Auto-allot EVERY section (Nursery → 12th)?" +
        (clearFirst ? " This wipes all existing timetables first." : "");
      if (!confirm(msg)) return;
    }
    setResult(null);
    try {
      const res = await allot.mutateAsync({
        scope,
        classSlug: scope === "section" ? classSlug : undefined,
        sectionCode: scope === "section" ? sectionCode : undefined,
        clearFirst,
      });
      if (!res.ok) {
        setResult({ kind: "error", msg: res.msg || "Generation failed" });
        return;
      }
      const f = res.filled ?? 0;
      const u = res.unassigned ?? 0;
      const msg = res.msg
        ? res.msg
        : scope === "all"
          ? `Done · ${res.sections ?? 0} sections, ${f} slots filled${u ? ` · ${u} need a teacher` : ""}${res.skipped ? ` · ${res.skipped} skipped (no subjects)` : ""}.`
          : `Filled ${f} slot${f === 1 ? "" : "s"}${u ? ` · ${u} need a teacher (review highlighted blanks)` : ""}.`;
      setResult({ kind: "info", msg });
      // Fire toast through parent + close after a short delay so the user
      // sees the inline result first.
      onDone(res);
      setTimeout(() => onClose(), scope === "all" ? 1300 : 900);
    } catch (e) {
      setResult({ kind: "error", msg: getErrorMessage(e, "Generation failed") });
    }
  }

  return (
    <Modal
      open
      title={`Smart allot · ${classSlug}-${sectionCode}`}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={onGo} disabled={allot.isPending}>
            {allot.isPending ? "Generating…" : "Generate"}
          </button>
        </>
      }
    >
      <p className="body-s" style={{ margin: "0 0 14px" }}>
        Auto-fills the weekly grid: subjects spread across the week, teachers matched by their designation + grade,
        and double-bookings avoided. <b>It's a draft</b> — review and tweak any slot after.
      </p>

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="field__label">Apply to</span>
        <div className="tt-scope">
          <label className={`tt-scope__opt ${scope === "section" ? "is-on" : ""}`}>
            <input
              type="radio"
              name="tt-scope"
              checked={scope === "section"}
              onChange={() => setScope("section")}
            />
            <span>
              <b>This section</b><br />
              <span className="muted body-s">{classSlug}-{sectionCode} only</span>
            </span>
          </label>
          <label className={`tt-scope__opt ${scope === "all" ? "is-on" : ""}`}>
            <input
              type="radio"
              name="tt-scope"
              checked={scope === "all"}
              onChange={() => setScope("all")}
            />
            <span>
              <b>All sections</b><br />
              <span className="muted body-s">Nursery → 12th, every section</span>
            </span>
          </label>
        </div>
      </div>

      {allot.isPending && (
        <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
          <Anim name="processing" size={120} />
          <div className="muted body-s" style={{ marginTop: 4 }}>
            {scope === "all"
              ? "Generating across every section — this can take a minute. Don't close this tab."
              : "Generating timetable…"}
          </div>
        </div>
      )}

      <label className="field" style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={clearFirst}
          onChange={(e) => setClearFirst(e.target.checked)}
          style={{ width: 16, height: 16, marginTop: 2 }}
        />
        <span>
          <span style={{ fontWeight: 600 }}>Clear &amp; rebuild fresh</span>
          <span className="muted body-s" style={{ display: "block" }}>
            Wipe existing slots first. Leave unticked to only fill empty slots.
          </span>
        </span>
      </label>

      {result && (
        <div className={`banner banner--${result.kind === "error" ? "error" : "info"}`} style={{ marginTop: 12 }}>
          <span>{result.msg}</span>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================
   Teacher live-search combobox — PHP tt-combo.
   ============================================================ */

function TeacherCombo({
  currentId, currentLabel, onPick, onClear,
}: {
  currentId: number;
  currentLabel: string;
  onPick: (id: number) => void;
  onClear: () => void;
}) {
  const { data: team } = usePickableTeam();
  const teachers = useMemo(() => {
    return (team?.items ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      desig: u.designation ?? "",
    }));
  }, [team]);

  const [q, setQ] = useState<string>(currentLabel || "");
  const [open, setOpen] = useState<boolean>(false);
  const [active, setActive] = useState<number>(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(currentLabel || "");
  }, [currentLabel]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return teachers;
    return teachers.filter((t) =>
      t.name.toLowerCase().includes(needle) || t.desig.toLowerCase().includes(needle),
    );
  }, [q, teachers]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && e.key === "ArrowDown") { setOpen(true); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[active] ?? (filtered.length === 1 ? filtered[0] : null);
      if (pick) onPick(pick.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="tt-combo" ref={wrapRef}>
      <Icon name="search" size={14} />
      <input
        ref={inputRef}
        type="text"
        className="input tt-combo__input"
        autoComplete="off"
        placeholder="Search teacher…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => { setOpen(true); inputRef.current?.select(); }}
        onKeyDown={onKey}
      />
      {currentId > 0 && (
        <button
          type="button"
          className="tt-combo__clear"
          aria-label="Clear"
          onClick={() => { setQ(""); onClear(); }}
        >
          <Icon name="x" size={13} />
        </button>
      )}
      {open && (
        <div className="tt-combo__list">
          {filtered.length === 0 ? (
            <div className="tt-combo__empty">No teacher matches “{q}”.</div>
          ) : (
            filtered.map((t, i) => (
              <div
                key={t.id}
                className={
                  "tt-combo__item " +
                  (t.id === currentId ? "is-current " : "") +
                  (i === active ? "is-active" : "")
                }
                onMouseDown={(e) => { e.preventDefault(); onPick(t.id); }}
              >
                <b>{t.name}</b>
                {t.desig && <span>{t.desig}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Grid skeleton — period header column + 6 day columns × 5 rows,
   shimmer animation. Renders inside .tt-card while the query is
   pending so the empty page doesn't flash a bare "Loading…".
   ============================================================ */

function TimetableGridSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="tt-wrap">
      <div
        className="tt-grid"
        style={{ gridTemplateColumns: `120px repeat(${DAYS.length}, minmax(0, 1fr))` }}
        aria-busy="true"
      >
        <div className="tt-cell tt-cell--corner" />
        {DAYS.map((d) => (
          <div key={d.idx} className="tt-cell tt-cell--dhead">{d.short}</div>
        ))}

        {Array.from({ length: rows }).map((_, r) => (
          <SkeletonGridRow key={r} />
        ))}
      </div>
    </div>
  );
}

function SkeletonGridRow() {
  return (
    <>
      <div className="tt-cell tt-cell--phead">
        <Skeleton width={28} height={12} />
        <Skeleton width="70%" height={9} style={{ marginTop: 4 }} />
        <Skeleton width="50%" height={8} style={{ marginTop: 4 }} />
      </div>
      {DAYS.map((d) => (
        <div key={d.idx} className="tt-cell tt-cell--slot">
          <Skeleton width="80%" height={10} />
          <Skeleton width="55%" height={9} style={{ marginTop: 6 }} />
        </div>
      ))}
    </>
  );
}

/* ============================================================
   Styles — direct port of erp/timetable/index.php's <style> block,
   minus the global modal/toast pieces (we get those from <Modal>).
   ============================================================ */

const TT_CSS = `
  .tt-toolbar { display: flex; align-items: center; }

  .seg { display: inline-flex; border: 1px solid var(--rule); border-radius: var(--r-pill, 999px); overflow: hidden; }
  .seg__btn {
    padding: 6px 14px; font-size: 12.5px; text-decoration: none; color: var(--ink-60);
    background: var(--white); border: 0; cursor: pointer; font-family: inherit;
  }
  .seg__btn.is-on { background: var(--orange); color: var(--cream); font-weight: 600; }
  .seg__btn:not(.is-on):hover { background: var(--cream-soft); }

  /* Teacher live-search combobox */
  .tt-combo {
    position: relative; min-width: 280px;
    display: flex; align-items: center;
  }
  .tt-combo > svg {
    position: absolute; left: 12px; color: var(--ink-40); pointer-events: none;
  }
  .tt-combo__input { width: 100%; padding-left: 34px; padding-right: 30px; }
  .tt-combo__clear {
    position: absolute; right: 8px; width: 22px; height: 22px;
    border: 0; border-radius: 50%;
    background: var(--cream-soft); color: var(--ink-60); cursor: pointer;
    display: grid; place-items: center;
  }
  .tt-combo__clear:hover { background: var(--rose, #f6e3e0); color: var(--error, #b91c1c); }
  .tt-combo__list {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 40;
    background: var(--white); border: 1px solid var(--rule); border-radius: var(--r-3, 10px);
    box-shadow: var(--shadow-3, 0 10px 24px rgba(0,0,0,.18));
    max-height: 340px; overflow-y: auto;
  }
  .tt-combo__item {
    display: flex; flex-direction: column; gap: 1px;
    padding: 9px 14px; cursor: pointer;
    border-bottom: 1px solid var(--rule-soft); font-size: 13px;
  }
  .tt-combo__item:last-child { border-bottom: 0; }
  .tt-combo__item:hover, .tt-combo__item.is-active { background: var(--cream-soft); }
  .tt-combo__item.is-current { background: var(--tint-wheat); }
  .tt-combo__item b { font-weight: 600; }
  .tt-combo__item span { font-size: 11px; color: var(--ink-60); }
  .tt-combo__empty { padding: 12px 14px; color: var(--ink-40); font-size: 13px; }

  /* Grid */
  .tt-wrap { overflow-x: auto; }
  .tt-cap {
    display: flex; justify-content: space-between; align-items: baseline;
    margin-bottom: 12px; gap: 12px;
  }
  .tt-grid { display: grid; gap: 4px; min-width: 720px; }
  .tt-cell { border-radius: 8px; padding: 8px; font-size: 12px; min-height: 54px; }
  .tt-cell--corner { background: transparent; min-height: 0; }
  .tt-cell--dhead {
    background: var(--ink); color: var(--cream);
    font-family: var(--font-mono, monospace);
    font-size: 11px; letter-spacing: .1em; text-align: center;
    display: flex; align-items: center; justify-content: center;
    min-height: 0; padding: 8px;
  }
  .tt-cell--phead {
    background: var(--cream-soft);
    display: flex; flex-direction: column; gap: 1px; justify-content: center;
  }
  .tt-phead__no { font-weight: 700; font-size: 13px; }
  .tt-phead__nm { font-size: 11px; color: var(--ink-60); }
  .tt-phead__tm { font-size: 10px; color: var(--ink-40); }
  .tt-cell--break {
    background: repeating-linear-gradient(45deg,
      var(--cream-soft), var(--cream-soft) 8px,
      var(--cream) 8px, var(--cream) 16px);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono, monospace);
    font-size: 11px; letter-spacing: .12em; color: var(--ink-40); text-transform: uppercase;
  }
  .tt-cell--slot {
    background: var(--white);
    border: 1px solid var(--rule-soft);
    display: flex; flex-direction: column; gap: 2px;
    justify-content: center; align-items: flex-start;
  }
  .tt-cell--slot.is-filled { background: var(--tint-wheat); border-color: var(--tint-wheat-deep, var(--orange)); }
  .tt-cell--slot.is-editable {
    cursor: pointer;
    transition: border-color .15s ease, box-shadow .15s ease;
  }
  .tt-cell--slot.is-editable:hover {
    border-color: var(--orange);
    box-shadow: inset 0 0 0 1px var(--orange);
  }
  .tt-slot__subj {
    font-weight: 700; font-size: 11.5px; line-height: 1.15; word-break: break-word;
  }
  .tt-slot__meta { font-size: 11px; color: var(--ink-60); }
  .tt-slot__room { font-size: 10px; color: var(--ink-40); font-family: var(--font-mono, monospace); }
  .tt-slot__or { color: var(--ink-40); font-weight: 400; }
  .tt-slot__empty {
    color: var(--ink-40); font-size: 16px;
    align-self: center; margin: auto;
  }

  /* Mobile day-stacked */
  .m-show { display: none; }
  .m-hide { display: block; }
  @media (max-width: 720px) {
    .m-show { display: block; }
    .m-hide { display: none; }
  }
  .tt-mobile { display: flex; flex-direction: column; gap: 14px; }
  .tt-mday { border: 1px solid var(--rule-soft); border-radius: var(--r-3, 10px); overflow: hidden; }
  .tt-mday__h {
    background: var(--ink); color: var(--cream);
    font-family: var(--font-mono, monospace);
    font-size: 11px; letter-spacing: .12em; text-transform: uppercase;
    padding: 8px 14px;
  }
  .tt-mrow {
    display: grid; grid-template-columns: 72px 1fr; gap: 10px; align-items: center;
    padding: 10px 14px; border-bottom: 1px solid var(--rule-soft);
  }
  .tt-mrow:last-child { border-bottom: 0; }
  .tt-mrow.is-filled { background: var(--tint-wheat); }
  .tt-mrow.is-editable { cursor: pointer; }
  .tt-mrow.is-editable:active { background: var(--cream-soft); }
  .tt-mrow--break {
    display: block; text-align: center; padding: 6px 14px;
    background: repeating-linear-gradient(45deg,
      var(--cream-soft), var(--cream-soft) 8px,
      var(--cream) 8px, var(--cream) 16px);
    font-family: var(--font-mono, monospace);
    font-size: 10.5px; letter-spacing: .12em; color: var(--ink-40); text-transform: uppercase;
  }
  .tt-mrow__p { display: flex; flex-direction: column; gap: 1px; }
  .tt-mrow__pno { font-weight: 700; font-size: 13px; }
  .tt-mrow__pt { font-size: 10px; color: var(--ink-40); }

  /* Smart-allot scope cards */
  .tt-scope { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
  .tt-scope__opt {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 12px;
    border: 1.5px solid var(--rule); border-radius: 10px; cursor: pointer;
    transition: border-color .15s ease, background .15s ease;
  }
  .tt-scope__opt.is-on { border-color: var(--orange); background: var(--tint-wheat); }
  .tt-scope__opt input { margin-top: 3px; }
  @media (max-width: 480px) { .tt-scope { grid-template-columns: 1fr; } }

  /* Print — hide chrome, let the grid breathe. */
  @media print {
    .app__nav, #tt-toolbar, .install-modal, .attn-toast,
    .page-head__lede, .topbar, .scrim, .install-banner { display: none !important; }
    body, .app, .app__main { background: white !important; }
    .tt-wrap { overflow: visible; box-shadow: none; }
    .tt-grid { min-width: 0; }
    .card, .card--tight { box-shadow: none; border: 0; }
  }
`;
