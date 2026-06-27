import { Injectable, ForbiddenException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { WhatsappEvents } from "../whatsapp/events.service";
import type {
  AttendanceBulk,
  AttendanceHistoryResponse,
  AttendanceMark,
  AttendanceRosterQuery,
  AttendanceRosterResponse,
  AttendanceStatus,
  MarkableClassesResponse,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/** Roles that may mark attendance for any class (oversight), not just their own. */
const PRIVILEGED_ROLES = new Set(["admin", "principal", "vice_principal", "head", "coordinator"]);

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
    private readonly wa: WhatsappEvents,
  ) {}

  /* ─────────────── class-teacher scoping ─────────────── */

  /** True when the user may mark any class (admins/principal or attendance.mark_all). */
  private canMarkAll(user: CurrentUser): boolean {
    return (
      user.permissions.includes("attendance.mark_all") ||
      (user.roleSlug != null && PRIVILEGED_ROLES.has(user.roleSlug))
    );
  }

  /** The class+sections this user is class teacher of, as a "slug|code" set. */
  private async ownSectionKeys(userId: number): Promise<Set<string>> {
    const rows = await this.prisma.db.sections.findMany({
      where: { teacher_user_id: userId },
      select: { code: true, classes: { select: { slug: true } } },
    });
    return new Set(rows.map((r) => `${r.classes.slug}|${r.code}`));
  }

  /** Classes the user may mark — all when privileged, else only own sections. */
  async myClasses(user: CurrentUser): Promise<MarkableClassesResponse> {
    if (this.canMarkAll(user)) {
      const classes = await this.prisma.db.classes.findMany({
        orderBy: { sort_order: "asc" },
        select: { slug: true, name: true, sections: { select: { code: true }, orderBy: { code: "asc" } } },
      });
      return {
        canMarkAll: true,
        classes: classes.flatMap((c) =>
          c.sections.map((s) => ({ classSlug: c.slug, className: c.name, sectionCode: s.code })),
        ),
      };
    }
    const rows = await this.prisma.db.sections.findMany({
      where: { teacher_user_id: user.id },
      select: { code: true, classes: { select: { slug: true, name: true } } },
      orderBy: { id: "asc" },
    });
    return {
      canMarkAll: false,
      classes: rows.map((r) => ({ classSlug: r.classes.slug, className: r.classes.name, sectionCode: r.code })),
    };
  }

  /** Throw unless the user may mark the given class+section. */
  private async assertCanMark(user: CurrentUser, classSlug: string, sectionCode: string): Promise<void> {
    if (this.canMarkAll(user)) return;
    const own = await this.ownSectionKeys(user.id);
    if (!own.has(`${classSlug}|${sectionCode}`)) {
      throw new ForbiddenException("You can only mark attendance for the class you are class teacher of.");
    }
  }

  /** Throw unless the user may mark every given student's section. */
  private async assertCanMarkStudents(user: CurrentUser, srNumbers: number[]): Promise<void> {
    if (this.canMarkAll(user)) return;
    const own = await this.ownSectionKeys(user.id);
    const students = await this.prisma.db.student.findMany({
      where: { srNumber: { in: srNumbers } },
      select: { class: true, section: true },
    });
    const outside = students.some((s) => !own.has(`${s.class}|${s.section}`));
    if (outside || own.size === 0) {
      throw new ForbiddenException("You can only mark attendance for the class you are class teacher of.");
    }
  }

  async roster(query: AttendanceRosterQuery, user: CurrentUser): Promise<AttendanceRosterResponse> {
    await this.assertCanMark(user, query.class, query.section);
    const session = await this.sessions.current();
    const date = new Date(query.date);

    const students = await this.prisma.db.student.findMany({
      where: { class: query.class, section: query.section, status: "active" },
      orderBy: { studentName: "asc" },
      select: { srNumber: true, studentName: true, class: true, section: true, fatherName: true },
    });

    const marks = await this.prisma.db.attendance.findMany({
      where: { attendance_date: date, sr_number: { in: students.map((s) => s.srNumber) } },
    });
    const byStudent = new Map(marks.map((m) => [m.sr_number, m]));

    const rows = students.map((s) => {
      const m = byStudent.get(s.srNumber);
      return {
        srNumber: s.srNumber,
        studentName: s.studentName,
        class: s.class,
        section: s.section,
        fatherName: s.fatherName,
        status: (m?.status ?? null) as AttendanceStatus | null,
        remarks: m?.remarks ?? null,
        markedAt: m?.marked_at ? m.marked_at.toISOString() : null,
      };
    });

    const tally = { present: 0, absent: 0, late: 0, excused: 0, notMarked: 0 };
    for (const r of rows) {
      if (!r.status) tally.notMarked++;
      else tally[r.status]++;
    }

    return {
      date: query.date,
      class: query.class,
      section: query.section,
      sessionCode: session.code,
      ...tally,
      rows,
    };
  }

  async mark(input: AttendanceMark, user: CurrentUser): Promise<{ ok: true }> {
    await this.assertCanMarkStudents(user, [input.srNumber]);
    const session = await this.sessions.current();
    const date = new Date(input.date);
    const prior = await this.prisma.db.attendance.findUnique({
      where: { sr_number_attendance_date: { sr_number: input.srNumber, attendance_date: date } },
      select: { status: true },
    });
    await this.prisma.db.attendance.upsert({
      where: { sr_number_attendance_date: { sr_number: input.srNumber, attendance_date: date } },
      update: {
        status: input.status,
        remarks: input.remarks ?? null,
        marked_by: user.name,
        marked_at: new Date(),
      },
      create: {
        sr_number: input.srNumber,
        session_code: session.code,
        attendance_date: date,
        status: input.status,
        remarks: input.remarks ?? null,
        marked_by: user.name,
      },
    });

    // Only fire student.absent when this mark actually FLIPS the row to
    // absent (avoids double-firing on a re-save with the same status).
    if (input.status === "absent" && prior?.status !== "absent") {
      void this.wa.studentAbsent({ srNumber: input.srNumber, date: input.date });
    }

    return { ok: true };
  }

  async bulkMark(input: AttendanceBulk, user: CurrentUser): Promise<{ ok: true; count: number }> {
    await this.assertCanMarkStudents(user, input.marks.map((m) => m.srNumber));
    const session = await this.sessions.current();
    const date = new Date(input.date);

    // Prior statuses for the rows we're about to upsert — used to suppress
    // duplicate WhatsApp pings on a no-op re-save.
    const srs = input.marks.map((m) => m.srNumber);
    const priorRows = await this.prisma.db.attendance.findMany({
      where: { sr_number: { in: srs }, attendance_date: date },
      select: { sr_number: true, status: true },
    });
    const priorBySr = new Map(priorRows.map((r) => [r.sr_number, r.status as string]));

    for (const m of input.marks) {
      await this.prisma.db.attendance.upsert({
        where: { sr_number_attendance_date: { sr_number: m.srNumber, attendance_date: date } },
        update: {
          status: m.status,
          remarks: m.remarks ?? null,
          marked_by: user.name,
          marked_at: new Date(),
        },
        create: {
          sr_number: m.srNumber,
          session_code: session.code,
          attendance_date: date,
          status: m.status,
          remarks: m.remarks ?? null,
          marked_by: user.name,
        },
      });

      if (m.status === "absent" && priorBySr.get(m.srNumber) !== "absent") {
        void this.wa.studentAbsent({ srNumber: m.srNumber, date: input.date });
      }
    }

    return { ok: true, count: input.marks.length };
  }

  async history(srNumber: number, year: number, month: number): Promise<AttendanceHistoryResponse> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 0));    // last day of the month

    const rows = await this.prisma.db.attendance.findMany({
      where: {
        sr_number: srNumber,
        attendance_date: { gte: from, lte: to },
      },
      orderBy: { attendance_date: "asc" },
    });

    const days: Record<string, AttendanceStatus> = {};
    const tally = { present: 0, absent: 0, late: 0, excused: 0 };
    for (const r of rows) {
      const iso = r.attendance_date.toISOString().slice(0, 10);
      days[iso] = r.status;
      tally[r.status]++;
    }

    return {
      srNumber,
      year,
      month,
      marked: rows.length,
      ...tally,
      days,
    };
  }
}
