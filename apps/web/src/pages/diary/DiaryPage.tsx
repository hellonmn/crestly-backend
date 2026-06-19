import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@crestly/icons";
import { PageHead } from "@/components/PageHead";
import { Skeleton } from "@/components/Skeleton";
import { useDiaryDay, useSaveDiary } from "./hooks";
import { useClasses } from "../classes/hooks";
import type { DiaryEntry } from "@crestly/shared";

function today() { return new Date().toISOString().slice(0, 10); }

export function DiaryPage() {
  const [date, setDate] = useState(today());
  const [classSlug, setClassSlug] = useState("");
  const [section, setSection] = useState("");
  const ready = !!classSlug && !!section;

  const { data: classes, isLoading: classesLoading } = useClasses();
  const { data, isLoading } = useDiaryDay(ready ? { date, class: classSlug, section } : null);

  const sectionsForClass = (classes ?? []).find((c) => c.slug === classSlug)?.sections ?? [];

  function shift(days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <>
      <PageHead
        group="MY DAY"
        meta={date}
        title="Daily Diary"
        lede={ready ? `${classSlug}-${section} · ${data?.entries.length ?? 0} periods` : "Pick a class and section to start logging."}
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
              {s.code}{s.teacherName ? ` · ${s.teacherName}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Empty state ---------- */}
      {!ready && (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div className="label" style={{ marginBottom: 8 }}>GET STARTED</div>
          <div className="display-s" style={{ fontSize: 20, marginBottom: 6 }}>Pick a class and section</div>
          <p className="muted body-s" style={{ margin: 0 }}>
            {classesLoading
              ? "Loading classes…"
              : (classes?.length ?? 0) === 0
                ? <>No classes are set up yet. Add them under <Link to="/classes">Classes</Link>.</>
                : "Once selected, the day's periods load below for logging."}
          </p>
        </div>
      )}

      {ready && data?.isHoliday && (
        <div className="banner banner--info">
          <Icon name="holidays" size={16} />
          <span>{data.holidayName ?? "Holiday"} — no school today.</span>
        </div>
      )}

      {ready && isLoading && <Skeleton.Table rows={4} cols={2} />}

      {ready && !isLoading && data && data.entries.length === 0 && !data.isHoliday && (
        <div className="banner banner--warn">
          <Icon name="alert" size={16} />
          <span>No periods configured for this section. Set up the timetable under <Link to="/timetable">Timetable</Link> first.</span>
        </div>
      )}

      {ready && !isLoading && data && data.entries.length > 0 && (
        <div className="grid grid--cols-2 grid--gap-sm">
          {data.entries.map((entry) => <DiaryCard key={entry.periodId} entry={entry} />)}
        </div>
      )}
    </>
  );
}

function DiaryCard({ entry }: { entry: DiaryEntry }) {
  const save = useSaveDiary();
  const [topic, setTopic] = useState(entry.topic);
  const [homework, setHomework] = useState(entry.homework ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(entry.id ? "Logged" : null);

  useEffect(() => {
    setTopic(entry.topic);
    setHomework(entry.homework ?? "");
    setSavedAt(entry.id ? "Logged" : null);
  }, [entry.id, entry.topic, entry.homework]);

  async function onSave() {
    if (!entry.periodId) return;
    await save.mutateAsync({
      classSlug: entry.classSlug,
      sectionCode: entry.sectionCode,
      diaryDate: entry.diaryDate,
      periodId: entry.periodId,
      topic,
      homework: homework.trim() || null,
    });
    setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
  }

  return (
    <div className="card">
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span className="cls-pill">{entry.classSlug}-{entry.sectionCode}</span>
        <div className="display-s" style={{ fontSize: 18 }}>{entry.subjectName ?? entry.periodName}</div>
        <span className="muted mono" style={{ fontSize: 11 }}>
          P{entry.periodNo} · {entry.startTime ?? ""}–{entry.endTime ?? ""}
        </span>
        <div style={{ marginLeft: "auto" }}>
          {savedAt ? (
            <span className="pill pill--success"><span className="pill__dot" />{savedAt}</span>
          ) : (
            <span className="pill pill--warn">PENDING</span>
          )}
        </div>
      </div>
      {entry.teacherName && <p className="muted body-s" style={{ margin: "0 0 8px" }}>by {entry.teacherName}</p>}

      <div className="form-grid form-grid--1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="field">
          <label className="field__label">What did you teach?</label>
          <textarea
            className="input input--area"
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic covered…"
          />
        </div>
        <div className="field">
          <label className="field__label">Homework</label>
          <textarea
            className="input input--area"
            rows={2}
            value={homework}
            onChange={(e) => setHomework(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn--primary btn--sm" onClick={onSave} disabled={save.isPending || !topic.trim()}>
            {save.isPending ? "Saving…" : "Save period"}
          </button>
        </div>
      </div>
    </div>
  );
}
