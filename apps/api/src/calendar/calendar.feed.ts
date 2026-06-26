import type { PrismaClient } from "@prisma/client";
import type {
  CalendarCategory,
  CalendarFeedItem,
  CalendarFeedResponse,
} from "@crestly/shared";

/* ============================================================
   Pure calendar-feed builder.

   Merges three sources into one day-by-day feed:
     1. calendar_events  — general school events (editable)
     2. holidays         — non-working days (read-only mirror)
     3. exam_datesheet   — scheduled exams (read-only mirror)

   Kept as a free function taking a PrismaClient (rather than a
   request-scoped service) because two callers need it against
   DIFFERENT clients:
     • staff CalendarController → the request's tenant client
     • parent portal            → TenantService.platform
   ============================================================ */

export interface FeedOptions {
  from: Date; // UTC-midnight inclusive
  to: Date; // UTC-midnight inclusive
  sessionCode?: string;
  classSlug?: string;
  includeHolidays: boolean;
  includeExams: boolean;
  /** Parent portal: only surface entries visible to parents. */
  parentScope?: boolean;
}

export async function buildCalendarFeed(
  db: PrismaClient,
  opts: FeedOptions,
): Promise<CalendarFeedResponse> {
  const { from, to } = opts;
  const items: CalendarFeedItem[] = [];

  /* ── 1. calendar_events ── */
  const events = await db.calendar_events.findMany({
    where: {
      start_date: { gte: from, lte: to },
      ...(opts.sessionCode ? { session_code: opts.sessionCode } : {}),
      ...(opts.parentScope ? { audience: { in: ["all", "parents"] } } : {}),
      ...(opts.classSlug
        ? { OR: [{ class_slug: null }, { class_slug: opts.classSlug }] }
        : {}),
    },
    orderBy: [{ start_date: "asc" }, { start_time: "asc" }],
  });
  for (const e of events) {
    items.push({
      key: `event:${e.id}`,
      source: "event",
      refId: e.id,
      title: e.title,
      category: e.category as CalendarCategory,
      date: isoDate(e.start_date),
      endDate: e.end_date ? isoDate(e.end_date) : null,
      startTime: e.start_time ? timeToHM(e.start_time) : null,
      endTime: e.end_time ? timeToHM(e.end_time) : null,
      allDay: Boolean(e.all_day),
      isHoliday: Boolean(e.is_holiday),
      audience: e.audience,
      classLabel: e.class_slug,
      location: e.location,
      color: e.color,
      editable: true,
    });
  }

  /* ── 2. holidays ── */
  if (opts.includeHolidays) {
    const holidays = await db.holidays.findMany({
      where: { holiday_date: { gte: from, lte: to } },
      orderBy: { holiday_date: "asc" },
    });
    for (const h of holidays) {
      items.push({
        key: `holiday:${h.id}`,
        source: "holiday",
        refId: h.id,
        title: h.name,
        category: "holiday",
        date: isoDate(h.holiday_date),
        endDate: null,
        startTime: null,
        endTime: null,
        allDay: true,
        isHoliday: true,
        audience: "all",
        classLabel: null,
        location: null,
        color: null,
        editable: false,
      });
    }
  }

  /* ── 3. exam_datesheet ── */
  if (opts.includeExams) {
    const exams = await db.exam_datesheet.findMany({
      where: {
        exam_date: { gte: from, lte: to },
        ...(opts.classSlug ? { class_slug: opts.classSlug } : {}),
        ...(opts.sessionCode
          ? { exam_terms: { session_code: opts.sessionCode } }
          : {}),
      },
      include: {
        exam_subjects: { select: { name: true } },
        exam_terms: { select: { name: true } },
      },
      orderBy: [{ exam_date: "asc" }, { start_time: "asc" }],
    });
    for (const x of exams) {
      const subject = x.exam_subjects?.name ?? "Exam";
      const term = x.exam_terms?.name ? ` · ${x.exam_terms.name}` : "";
      items.push({
        key: `exam:${x.id}`,
        source: "exam",
        refId: x.id,
        title: `${subject} Exam${term}`,
        category: "exam",
        date: isoDate(x.exam_date),
        endDate: null,
        startTime: x.start_time ? timeToHM(x.start_time) : null,
        endTime: x.end_time ? timeToHM(x.end_time) : null,
        allDay: !x.start_time,
        isHoliday: false,
        audience: "all",
        classLabel: x.class_slug,
        location: null,
        color: null,
        editable: false,
      });
    }
  }

  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ?? "").localeCompare(b.startTime ?? "") ||
      a.title.localeCompare(b.title),
  );

  return { from: isoDate(from), to: isoDate(to), items };
}

/* ─────────────────── Range resolution ─────────────────── */

const MAX_SPAN_DAYS = 400; // sanity cap so a wide range can't scan years

/** Resolve a feed query's `month` / `from` / `to` into a UTC-midnight range. */
export function resolveRange(q: {
  month?: string;
  from?: string;
  to?: string;
}): { from: Date; to: Date } {
  let from: Date;
  let to: Date;
  if (q.month) {
    const [y, m] = q.month.split("-").map(Number);
    from = new Date(Date.UTC(y!, m! - 1, 1));
    to = new Date(Date.UTC(y!, m!, 0)); // day 0 of next month = last day of this month
  } else {
    const f = q.from ?? q.to!;
    const t = q.to ?? q.from!;
    from = parseIsoDate(f);
    to = parseIsoDate(t);
  }
  if (to < from) [from, to] = [to, from];
  const span = (to.getTime() - from.getTime()) / 86_400_000;
  if (span > MAX_SPAN_DAYS) {
    to = new Date(from.getTime() + MAX_SPAN_DAYS * 86_400_000);
  }
  return { from, to };
}

/* ─────────────────── Local helpers ─────────────────── */

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Prisma @db.Time(0) → "HH:MM" (stored wall-clock, read as UTC). */
function timeToHM(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
