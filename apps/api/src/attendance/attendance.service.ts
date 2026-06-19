import { Injectable } from "@nestjs/common";
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
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
    private readonly wa: WhatsappEvents,
  ) {}

  async roster(query: AttendanceRosterQuery): Promise<AttendanceRosterResponse> {
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
