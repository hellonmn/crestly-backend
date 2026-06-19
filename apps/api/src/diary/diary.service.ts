import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type { DiaryDayQuery, DiaryDayResponse, DiarySaveInput } from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/**
 * Daily diary — one entry per period per (class, section, date).
 * Mirrors erp/diary/index.php's day-view editor.
 */
@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async day(query: DiaryDayQuery): Promise<DiaryDayResponse> {
    const session = await this.sessions.current();
    const date = new Date(query.date);
    const dayOfWeek = ((date.getUTCDay() + 6) % 7) + 1; // 1=Mon … 7=Sun

    // Is the date a school holiday?
    const holiday = await this.prisma.db.holidays.findUnique({
      where: { holiday_date: date },
    });

    // Period structure for this session.
    const periods = await this.prisma.db.timetable_periods.findMany({
      where: { session_code: session.code },
      orderBy: [{ sort_order: "asc" }, { period_no: "asc" }],
    });

    // Timetable cells for this section on this day-of-week (for subject + teacher lookup).
    const cells = await this.prisma.db.timetable_entries.findMany({
      where: {
        session_code: session.code,
        class_slug: query.class,
        section_code: query.section,
        day_of_week: dayOfWeek,
      },
      include: {
        exam_subjects_timetable_entries_subject_idToexam_subjects: { select: { id: true, name: true } },
        users_timetable_entries_teacher_user_idTousers: { select: { id: true, name: true } },
      },
    });
    const cellByPeriod = new Map(cells.map((c) => [c.period_id, c]));

    // Existing diary entries for this date.
    const entries = await this.prisma.db.class_diary.findMany({
      where: {
        session_code: session.code,
        class_slug: query.class,
        section_code: query.section,
        diary_date: date,
      },
    });
    const entryByPeriod = new Map(entries.map((e) => [e.period_id ?? 0, e]));

    return {
      date: query.date,
      class: query.class,
      section: query.section,
      isHoliday: !!holiday || dayOfWeek === 7,
      holidayName: holiday?.name ?? (dayOfWeek === 7 ? "Sunday" : null),
      entries: periods
        .filter((p) => !p.is_break)
        .map((p) => {
          const cell = cellByPeriod.get(p.id);
          const e = entryByPeriod.get(p.id);
          return {
            id: e?.id ?? null,
            sessionCode: session.code,
            classSlug: query.class,
            sectionCode: query.section,
            diaryDate: query.date,
            periodId: p.id,
            periodNo: p.period_no,
            periodName: p.name,
            startTime: timeStr(p.start_time),
            endTime: timeStr(p.end_time),
            subjectId: cell?.exam_subjects_timetable_entries_subject_idToexam_subjects?.id ?? null,
            subjectName: cell?.exam_subjects_timetable_entries_subject_idToexam_subjects?.name ?? null,
            teacherUserId: cell?.users_timetable_entries_teacher_user_idTousers?.id ?? null,
            teacherName: cell?.users_timetable_entries_teacher_user_idTousers?.name ?? null,
            topic: e?.topic ?? "",
            homework: e?.homework ?? null,
          };
        }),
    };
  }

  async save(input: DiarySaveInput, user: CurrentUser): Promise<{ ok: true; id: number }> {
    const session = await this.sessions.current();
    const date = new Date(input.diaryDate);
    const existing = await this.prisma.db.class_diary.findFirst({
      where: {
        session_code: session.code,
        class_slug: input.classSlug,
        section_code: input.sectionCode,
        diary_date: date,
        period_id: input.periodId,
      },
    });

    if (existing) {
      const updated = await this.prisma.db.class_diary.update({
        where: { id: existing.id },
        data: {
          topic: input.topic,
          homework: input.homework ?? null,
        },
      });
      return { ok: true, id: updated.id };
    }

    const created = await this.prisma.db.class_diary.create({
      data: {
        session_code: session.code,
        class_slug: input.classSlug,
        section_code: input.sectionCode,
        diary_date: date,
        period_id: input.periodId,
        topic: input.topic,
        homework: input.homework ?? null,
        teacher_user_id: user.id,
        created_by: user.id,
      },
    });
    return { ok: true, id: created.id };
  }
}

function timeStr(t: Date | null | undefined): string | null {
  if (!t) return null;
  // Time field is stored as a Date in Prisma; format HH:MM.
  return t.toISOString().slice(11, 16);
}
