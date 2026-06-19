import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { StatTile } from "@/components/StatTile";
import { Skeleton } from "@/components/Skeleton";
import { Modal } from "@/components/Modal";
import {
  useClasses,
  useDeleteClass,
  useDeleteSection,
  useSaveClass,
  useSaveSection,
} from "./hooks";
import { usePickableTeam } from "@/pages/team/hooks";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { SchoolClass, Section, TeamMember } from "@crestly/shared";

/* ============================================================
   Classes & Sections — ports erp/classes/index.php verbatim.
   Stacked class cards with inline section rows; section row is
   clickable (jumps to filtered Students list), Edit button
   opens a modal with a real teacher-picker combobox.
   ============================================================ */

export function ClassesPage() {
  const { user } = useAuth();
  const canManage = (user?.permissions ?? []).includes("classes.manage");
  const { data: classes, isLoading, error, refetch, isFetching } = useClasses();

  const [editingClass, setEditingClass]     = useState<SchoolClass | "new" | null>(null);
  const [editingSection, setEditingSection] = useState<
    | { kind: "new"; classId: number; classSlug: string; classWing: string | null }
    | { kind: "edit"; section: Section; classSlug: string; classWing: string | null }
    | null
  >(null);

  const totals = useMemo(() => {
    if (!classes) return { classes: 0, sections: 0, students: 0, over: 0 };
    let sections = 0;
    let students = 0;
    let over = 0;
    for (const c of classes) {
      sections += c.sections.length;
      students += c.totalStudents;
      for (const s of c.sections) {
        if (s.capacity !== null && s.studentCount > s.capacity) over++;
      }
    }
    return { classes: classes.length, sections, students, over };
  }, [classes]);

  return (
    <>
      <PageHead
        group="RECORDS"
        meta="CLASSES & SECTIONS"
        title="Classes & Sections"
        lede="Master list of classes and their sections. Sections drive student-list filters, attendance rosters, and timetable grids. Click a section to open its student roster."
        actions={
          canManage && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setEditingClass("new")}
            >
              <Icon name="plus" size={14} /> Add class
            </button>
          )
        }
      />

      <QueryError error={error} refetch={refetch} isFetching={isFetching} label="classes" />

      <div className="grid grid--cols-4 grid--gap-sm">
        <StatTile
          tint="wheat"
          icon="classes"
          label="CLASSES"
          value={totals.classes.toLocaleString("en-IN")}
          delta="Nursery → 12th"
        />
        <StatTile
          tint="mint"
          icon="classes"
          label="SECTIONS"
          value={totals.sections.toLocaleString("en-IN")}
          delta="across all classes"
        />
        <StatTile
          tint="rose"
          icon="students"
          label="ACTIVE STUDENTS"
          value={totals.students.toLocaleString("en-IN")}
          delta="enrolled"
        />
        <StatTile
          tint="mustard"
          icon="alert"
          label="OVER CAPACITY"
          value={totals.over.toLocaleString("en-IN")}
          delta={totals.over > 0 ? "sections to look at" : "all ok"}
          deltaTone={totals.over > 0 ? "error" : undefined}
        />
      </div>

      {isLoading ? (
        <div className="card" style={{ marginTop: 16 }}>
          <Skeleton.Title width="40%" />
        </div>
      ) : (classes?.length ?? 0) === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: "40px 24px", textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 8 }}>NO CLASSES</div>
          <div className="muted body-s">
            Add the first class to start building sections and enrolment rosters.
          </div>
        </div>
      ) : (
        <div className="classes-stack" style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
          {classes?.map((c) => (
            <ClassCard
              key={c.id}
              cls={c}
              canManage={canManage}
              onEditClass={() => setEditingClass(c)}
              onAddSection={() =>
                setEditingSection({ kind: "new", classId: c.id, classSlug: c.slug, classWing: wingFor(c.slug) })
              }
              onEditSection={(s) =>
                setEditingSection({ kind: "edit", section: s, classSlug: c.slug, classWing: wingFor(c.slug) })
              }
            />
          ))}
        </div>
      )}

      {editingClass && (
        <ClassEditModal
          initial={editingClass === "new" ? null : editingClass}
          onClose={() => setEditingClass(null)}
        />
      )}
      {editingSection && (
        <SectionEditModal
          state={editingSection}
          onClose={() => setEditingSection(null)}
        />
      )}

      <style>{CLS_CSS}</style>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Class card                                                          */
/* ------------------------------------------------------------------ */

function ClassCard({
  cls, canManage, onEditClass, onAddSection, onEditSection,
}: {
  cls: SchoolClass;
  canManage: boolean;
  onEditClass: () => void;
  onAddSection: () => void;
  onEditSection: (s: Section) => void;
}) {
  return (
    <div className="card class-card">
      <div className="class-card__head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className="cls-pill" style={{ fontSize: 13, padding: "4px 14px" }}>{cls.slug}</span>
            <div className="class-card__name" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
              {cls.name}
            </div>
            {cls.isSystem && (
              <span className="pill pill--neutral" style={{ fontSize: 9.5, padding: "2px 8px" }}>SYSTEM</span>
            )}
          </div>
          <div className="muted body-s" style={{ marginTop: 4 }}>
            {cls.sections.length} section{cls.sections.length === 1 ? "" : "s"}
            {" · "}
            {cls.totalStudents.toLocaleString("en-IN")} student{cls.totalStudents === 1 ? "" : "s"}
          </div>
        </div>
        {canManage && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onEditClass}>
            Rename
          </button>
        )}
      </div>

      <div className="class-card__sections">
        {cls.sections.length === 0 ? (
          <div className="muted body-s" style={{ padding: "14px 4px", textAlign: "center" }}>
            No sections yet.
            {canManage && (
              <>
                {" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={onAddSection}
                  style={{ color: "var(--orange-deep)", textDecoration: "underline" }}
                >
                  Add the first one →
                </button>
              </>
            )}
          </div>
        ) : (
          cls.sections.map((s) => (
            <SectionRow
              key={s.id}
              cls={cls}
              section={s}
              canManage={canManage}
              onEdit={() => onEditSection(s)}
            />
          ))
        )}

        {canManage && cls.sections.length > 0 && (
          <button
            type="button"
            className="add-section-inline"
            onClick={onAddSection}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add section
          </button>
        )}
      </div>
    </div>
  );
}

function SectionRow({
  cls, section, canManage, onEdit,
}: {
  cls: SchoolClass;
  section: Section;
  canManage: boolean;
  onEdit: () => void;
}) {
  const cap = section.capacity;
  const over = cap !== null && section.studentCount > cap;
  return (
    <div className={`section-row ${over ? "is-over" : ""}`}>
      <Link
        className="section-row__head"
        to={`/students?class=${encodeURIComponent(cls.slug)}&section=${encodeURIComponent(section.code)}`}
      >
        <span className="section-row__code">{section.code}</span>
        <span className="section-row__count">
          <b>{section.studentCount.toLocaleString("en-IN")}</b>
          {cap !== null && (
            <span className="muted"> / {cap.toLocaleString("en-IN")}</span>
          )}
          <span className="muted body-s" style={{ marginLeft: 4 }}>students</span>
          {over && (
            <span className="pill pill--warn" style={{ fontSize: 9.5, padding: "1px 7px", marginLeft: 6 }}>
              OVER
            </span>
          )}
        </span>
        <span className="section-row__teacher muted body-s">
          Teacher:{" "}
          <b style={{ color: section.teacherName ? "var(--ink)" : "var(--ink-40)" }}>
            {section.teacherName ?? "unassigned"}
          </b>
        </span>
      </Link>
      {canManage && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onEdit}
        >
          Edit
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Class edit modal                                                    */
/* ------------------------------------------------------------------ */

function ClassEditModal({ initial, onClose }: { initial: SchoolClass | null; onClose: () => void }) {
  const isNew = !initial;
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState<number>(initial?.sortOrder ?? 0);
  const [error, setError] = useState<string | null>(null);
  const save   = useSaveClass(initial?.id);
  const remove = useDeleteClass();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({ slug, name, sortOrder });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save"));
    }
  }
  async function onDelete() {
    if (!initial) return;
    if (!confirm(`Delete class ${initial.name}? This cannot be undone.`)) return;
    try {
      await remove.mutateAsync(initial.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? "Add a class" : `Rename ${initial?.name}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && !initial?.isSystem && (
            <button type="button" className="btn btn--danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="class-edit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="class-edit" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field">
          <label className="field__label field__label--req">Slug</label>
          <input
            className="input mono"
            placeholder="10, nur, 11-c…"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={initial?.isSystem}
            required
          />
        </div>
        <div className="field">
          <label className="field__label field__label--req">Name</label>
          <input
            className="input"
            placeholder="Class 10"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label className="field__label">Sort order</label>
          <input
            className="input mono"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value || 0))}
          />
        </div>
        {error && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Section edit modal — with teacher-picker combobox                   */
/* ------------------------------------------------------------------ */

function SectionEditModal({
  state, onClose,
}: {
  state:
    | { kind: "new"; classId: number; classSlug: string; classWing: string | null }
    | { kind: "edit"; section: Section; classSlug: string; classWing: string | null };
  onClose: () => void;
}) {
  const isNew = state.kind === "new";
  const initial = state.kind === "edit" ? state.section : null;
  const classId = state.kind === "new" ? state.classId : state.section.classId;
  const wing = state.classWing;

  const [code, setCode]                 = useState(initial?.code ?? "");
  const [capacity, setCapacity]         = useState<string>(initial?.capacity?.toString() ?? "");
  const [teacherUserId, setTeacherUserId] = useState<number | null>(initial?.teacherUserId ?? null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save   = useSaveSection(initial?.id);
  const remove = useDeleteSection();

  // Fetch team INSIDE the modal so the user sees loading/error/retry
  // states directly tied to the modal's own lifecycle. usePickableTeam
  // hits /api/team/pickable which is open to any logged-in user (no
  // team.view permission required) — so a class teacher can assign
  // another teacher even when they can't see the full HR record.
  const {
    data: teamResp,
    isLoading: teamLoading,
    isError: teamError,
    refetch: refetchTeam,
  } = usePickableTeam();
  const team: TeamMember[] = teamResp?.items ?? [];

  // Show ALL active staff in the picker — the PHP version is permissive
  // here because every school has a different idea of what counts as a
  // "teacher". We rank wing-matches + teaching designations to the top
  // and let the search filter span name / designation / department.
  const eligibleTeachers = useMemo(() => {
    const q = teacherSearch.trim().toLowerCase();
    const matches = q
      ? team.filter((u) =>
          u.name.toLowerCase().includes(q) ||
          (u.designation ?? "").toLowerCase().includes(q) ||
          (u.department ?? "").toLowerCase().includes(q),
        )
      : team;

    const isTeacher = (u: TeamMember) =>
      (u.designation ?? "").toLowerCase().includes("teacher") ||
      (u.roleSlug ?? "") === "teacher" ||
      !!u.classTeacherOf;

    // Rank: wing+teacher (top) → wing-only → teacher-only → everyone else.
    const score = (u: TeamMember): number => {
      const w = wingFor(u.department ?? "") === wing && !!wing ? 2 : 0;
      const t = isTeacher(u) ? 1 : 0;
      return w + t;
    };
    return [...matches]
      .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [team, teacherSearch, wing]);

  const selectedTeacher = teacherUserId
    ? team.find((u) => u.id === teacherUserId) ?? null
    : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await save.mutateAsync({
        classId,
        code: code.trim(),
        capacity: capacity.trim() === "" ? null : Number(capacity),
        teacherUserId,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save"));
    }
  }

  async function onDelete() {
    if (!initial) return;
    if (!confirm(`Delete section ${initial.code}?`)) return;
    try {
      await remove.mutateAsync(initial.id);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete"));
    }
  }

  return (
    <Modal
      open
      title={isNew ? `Add section to ${state.classSlug}` : `Edit ${state.classSlug}-${initial?.code}`}
      onClose={onClose}
      actions={
        <>
          {!isNew && (
            <button type="button" className="btn btn--danger" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete section
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="section-edit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <form id="section-edit" onSubmit={onSubmit} className="form-grid form-grid--2">
        <div className="field">
          <label className="field__label field__label--req">Section code</label>
          <input
            className="input mono"
            placeholder="A, B, C…"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            required
            style={{ textTransform: "uppercase" }}
          />
        </div>
        <div className="field">
          <label className="field__label">Capacity</label>
          <input
            className="input mono"
            type="number"
            min={0}
            max={999}
            placeholder="leave blank for no cap"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <span className="field__hint">Used to flag over-crowded sections.</span>
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="field__label">Class teacher</label>

          {/* Searchable picker */}
          <div className="teacher-combo">
            <div className="teacher-combo__selected">
              {selectedTeacher ? (
                <>
                  <span className="avatar avatar--cream avatar--xs">
                    {initialsOf(selectedTeacher.name)}
                  </span>
                  <span style={{ fontWeight: 600 }}>{selectedTeacher.name}</span>
                  {selectedTeacher.department && (
                    <span className="muted body-s">· {selectedTeacher.department}</span>
                  )}
                  <button
                    type="button"
                    className="teacher-combo__clear"
                    aria-label="Clear"
                    onClick={() => setTeacherUserId(null)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M6 18L18 6"/></svg>
                  </button>
                </>
              ) : (
                <span className="muted">— unassigned —</span>
              )}
            </div>

            <div className="teacher-combo__search-wrap">
              <svg className="teacher-combo__search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/>
              </svg>
              <input
                type="search"
                className="teacher-combo__search"
                placeholder="Search teacher name…"
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="teacher-combo__list" role="listbox">
              {teamLoading ? (
                <div className="teacher-combo__empty muted body-s">
                  <span className="tc-spinner" />
                  Loading staff…
                </div>
              ) : teamError ? (
                <div className="teacher-combo__empty muted body-s">
                  <div style={{ color: "var(--error)", marginBottom: 6 }}>
                    Couldn't load staff. The API might be offline.
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => refetchTeam()}
                  >
                    <Icon name="settings" size={12} /> Retry
                  </button>
                </div>
              ) : team.length === 0 ? (
                <div className="teacher-combo__empty muted body-s">
                  <div style={{ marginBottom: 6 }}>
                    No active staff found. Add someone in <Link to="/team">Team</Link> first.
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => refetchTeam()}
                  >
                    Refresh
                  </button>
                </div>
              ) : eligibleTeachers.length === 0 ? (
                <div className="teacher-combo__empty muted body-s">
                  0 of {team.length} staff match{teacherSearch.trim() ? <> "<b>{teacherSearch.trim()}</b>"</> : ""}.
                  {teacherSearch.trim() && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="link-button"
                        style={{ color: "var(--orange-deep)", textDecoration: "underline" }}
                        onClick={() => setTeacherSearch("")}
                      >
                        Clear search
                      </button>
                    </>
                  )}
                </div>
              ) : (
                eligibleTeachers.map((u) => {
                  const inWing = wingFor(u.department ?? "") === wing;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`teacher-combo__item ${teacherUserId === u.id ? "is-active" : ""}`}
                      onClick={() => setTeacherUserId(u.id)}
                    >
                      <span className="avatar avatar--cream avatar--xs">{initialsOf(u.name)}</span>
                      <span style={{ flex: 1 }}>
                        <span style={{ fontWeight: 600 }}>{u.name}</span>
                        {u.designation && (
                          <span className="muted body-s" style={{ marginLeft: 6 }}>
                            · {u.designation}
                          </span>
                        )}
                      </span>
                      {inWing && wing && (
                        <span className="pill pill--mint" style={{ fontSize: 9.5, padding: "1px 6px" }}>
                          {wing.toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="teacher-combo__hint">
              <span className="label" style={{ color: "var(--ink-40)" }}>SHOWING</span>{" "}
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>
                {eligibleTeachers.length} of {team.length}
              </span>
              {" · "}
              <span style={{ color: "var(--ink-60)" }}>
                {wing ? `${wing} wing first` : "all staff"}
              </span>
            </div>
          </div>
          <span className="field__hint">
            Only staff from this class's wing are listed first — e.g. Nursery sections see Pre-Primary teachers.
          </span>
        </div>

        {error && (
          <div className="banner banner--error" style={{ gridColumn: "1 / -1" }}>
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function initialsOf(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]![0] ?? "") + (parts[parts.length - 1]![0] ?? "")).toUpperCase();
}

/** Wing categorisation matches PHP's class-wing buckets. */
function wingFor(slugOrDept: string): string | null {
  const k = slugOrDept.toLowerCase();
  if (["nursery", "lkg", "ukg"].some((p) => k.includes(p)) || k.includes("pre-primary") || k.includes("pre primary"))
    return "pre-primary";
  if (["1st", "2nd", "3rd", "4th", "5th"].some((p) => k === p || k.startsWith(p))) return "primary";
  if (["6th", "7th", "8th"].some((p) => k === p || k.startsWith(p))) return "middle";
  if (["9th", "10th", "11th", "12th"].some((p) => k === p || k.startsWith(p))) return "senior";
  // Departments map by name:
  if (k.includes("primary")) return "primary";
  if (k.includes("middle")) return "middle";
  if (k.includes("senior") || k.includes("higher")) return "senior";
  return null;
}

const CLS_CSS = `
  .class-card { padding: 18px 20px; }
  .class-card__head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  .class-card__sections {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .section-row {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--white);
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    padding: 8px 10px 8px 14px;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .section-row:hover { background: var(--cream-soft); }
  .section-row.is-over { border-color: var(--warn); background: rgba(197, 138, 27, 0.04); }
  .section-row__head {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: 14px;
    align-items: center;
    flex: 1;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }
  .section-row__code {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 14px;
    padding: 4px 0;
    text-align: center;
    background: var(--cream-soft);
    border-radius: var(--r-3);
    color: var(--ink);
  }
  .section-row__count {
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .section-row__teacher {
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .add-section-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding: 8px 12px;
    border-radius: var(--r-pill);
    background: transparent;
    border: 1px dashed var(--rule-strong);
    color: var(--ink-60);
    cursor: pointer;
    font-size: 12.5px;
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    align-self: flex-start;
  }
  .add-section-inline:hover {
    background: var(--cream-soft);
    color: var(--orange-deep);
    border-color: var(--orange);
  }

  .link-button {
    background: none;
    border: 0;
    cursor: pointer;
    font: inherit;
  }

  /* Teacher combobox */
  .teacher-combo {
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    background: var(--white);
    overflow: hidden;
  }
  .teacher-combo__selected {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--cream-soft);
    border-bottom: 1px solid var(--rule);
  }
  .teacher-combo__clear {
    margin-left: auto;
    display: inline-flex;
    width: 20px; height: 20px;
    align-items: center; justify-content: center;
    border: 0; background: transparent; cursor: pointer;
    color: var(--ink-40); border-radius: 6px;
  }
  .teacher-combo__clear:hover { background: rgba(0,0,0,0.05); color: var(--ink); }
  .teacher-combo__search-wrap {
    position: relative;
    padding: 8px 10px;
    border-bottom: 1px solid var(--rule);
  }
  .teacher-combo__search-icon {
    position: absolute;
    left: 22px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-40);
    pointer-events: none;
  }
  .teacher-combo__search {
    width: 100%;
    border: 1px solid var(--rule);
    border-radius: var(--r-3);
    padding: 6px 8px 6px 30px;
    font-size: 13px;
    outline: none;
  }
  .teacher-combo__search:focus { border-color: var(--orange); }
  .teacher-combo__list {
    max-height: 260px;
    overflow-y: auto;
  }
  .teacher-combo__item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    background: var(--white);
    border: 0;
    border-bottom: 1px solid var(--rule);
    cursor: pointer;
    text-align: left;
    transition: background 120ms ease;
  }
  .teacher-combo__item:last-child { border-bottom: 0; }
  .teacher-combo__item:hover { background: var(--cream-soft); }
  .teacher-combo__item.is-active {
    background: rgba(242, 92, 25, 0.08);
    color: var(--orange-deep);
  }
  .tc-spinner {
    display: inline-block;
    width: 12px; height: 12px;
    border: 2px solid var(--rule);
    border-top-color: var(--orange);
    border-radius: 50%;
    margin-right: 8px;
    vertical-align: -2px;
    animation: tc-spin 0.6s linear infinite;
  }
  @keyframes tc-spin { to { transform: rotate(360deg); } }
  .teacher-combo__empty {
    padding: 18px 12px;
    text-align: center;
  }
  .teacher-combo__hint {
    padding: 8px 12px;
    background: var(--cream-soft);
    border-top: 1px solid var(--rule);
    font-size: 11px;
  }

  .avatar--xs {
    width: 24px; height: 24px;
    font-size: 10.5px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--cream);
    color: var(--ink);
    font-weight: 700;
  }
`;
