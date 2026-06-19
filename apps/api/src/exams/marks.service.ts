import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { ExamMarkSave, ExamMarksQuery, ExamMarksResponse } from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class ExamMarksService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async load(query: ExamMarksQuery): Promise<ExamMarksResponse> {
    const term = await this.prisma.db.exam_terms.findUnique({ where: { id: query.termId } });
    if (!term) throw new NotFoundException(`Term #${query.termId} not found`);

    const subject = await this.prisma.db.exam_subjects.findUnique({ where: { id: query.subjectId } });
    if (!subject) throw new NotFoundException(`Subject #${query.subjectId} not found`);

    // Pick maxMarks from datesheet if present; otherwise use the term's default.
    const datesheet = await this.prisma.db.exam_datesheet.findFirst({
      where: { term_id: query.termId, class_slug: query.class, subject_id: query.subjectId },
    });
    const maxMarks = datesheet?.max_marks ?? term.default_max_marks;
    const passMarks = datesheet?.pass_marks ?? Math.round(maxMarks * 0.33);

    const students = await this.prisma.db.student.findMany({
      where: { class: query.class, section: query.section, status: "active" },
      select: { srNumber: true, studentName: true },
      orderBy: { studentName: "asc" },
    });

    const existing = await this.prisma.db.exam_marks.findMany({
      where: {
        term_id: query.termId,
        subject_id: query.subjectId,
        sr_number: { in: students.map((s) => s.srNumber) },
      },
    });
    const byStudent = new Map(existing.map((m) => [m.sr_number, m]));

    return {
      termId: term.id,
      termName: term.name,
      isFinalized: term.is_finalized,
      class: query.class,
      section: query.section,
      subjectId: subject.id,
      subjectName: subject.name,
      maxMarks,
      passMarks,
      rows: students.map((s) => {
        const m = byStudent.get(s.srNumber);
        return {
          srNumber: s.srNumber,
          studentName: s.studentName,
          marksObtained: m?.marks_obtained ? Number(m.marks_obtained) : null,
          isAbsent: m?.is_absent ?? false,
          remarks: m?.remarks ?? null,
        };
      }),
    };
  }

  async save(input: ExamMarkSave, user: CurrentUser): Promise<{ ok: true }> {
    const term = await this.prisma.db.exam_terms.findUnique({ where: { id: input.termId } });
    if (!term) throw new NotFoundException();
    if (term.is_finalized) throw new BadRequestException("Term is finalized; marks are locked.");

    const existing = await this.prisma.db.exam_marks.findFirst({
      where: { term_id: input.termId, sr_number: input.srNumber, subject_id: input.subjectId },
    });

    if (existing) {
      await this.prisma.db.exam_marks.update({
        where: { id: existing.id },
        data: {
          marks_obtained: input.isAbsent ? null : input.marksObtained,
          is_absent: input.isAbsent,
          marked_by: user.id,
          marked_at: new Date(),
        },
      });
    } else {
      await this.prisma.db.exam_marks.create({
        data: {
          term_id: input.termId,
          sr_number: input.srNumber,
          subject_id: input.subjectId,
          marks_obtained: input.isAbsent ? null : input.marksObtained,
          is_absent: input.isAbsent,
          marked_by: user.id,
        },
      });
    }
    return { ok: true };
  }
}
