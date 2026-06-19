import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { ExamDatesheetRow, ExamDatesheetUpsert } from "@crestly/shared";

@Injectable()
export class ExamDatesheetService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(termId: number, classSlug?: string): Promise<ExamDatesheetRow[]> {
    const rows = await this.prisma.db.exam_datesheet.findMany({
      where: { term_id: termId, ...(classSlug && { class_slug: classSlug }) },
      include: { exam_subjects: { select: { name: true } } },
      orderBy: [{ exam_date: "asc" }, { start_time: "asc" }],
    });
    return rows.map(toDto);
  }

  async create(input: ExamDatesheetUpsert): Promise<ExamDatesheetRow> {
    const row = await this.prisma.db.exam_datesheet.create({
      data: {
        term_id: input.termId,
        class_slug: input.classSlug,
        subject_id: input.subjectId,
        exam_date: new Date(input.examDate),
        start_time: input.startTime ? new Date(`1970-01-01T${normaliseTime(input.startTime)}Z`) : null,
        end_time: input.endTime ? new Date(`1970-01-01T${normaliseTime(input.endTime)}Z`) : null,
        max_marks: input.maxMarks,
        pass_marks: input.passMarks,
        syllabus_text: input.syllabusText ?? null,
      },
      include: { exam_subjects: { select: { name: true } } },
    });
    return toDto(row);
  }

  async update(id: number, input: ExamDatesheetUpsert): Promise<ExamDatesheetRow> {
    const existing = await this.prisma.db.exam_datesheet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const row = await this.prisma.db.exam_datesheet.update({
      where: { id },
      data: {
        exam_date: new Date(input.examDate),
        start_time: input.startTime ? new Date(`1970-01-01T${normaliseTime(input.startTime)}Z`) : null,
        end_time: input.endTime ? new Date(`1970-01-01T${normaliseTime(input.endTime)}Z`) : null,
        max_marks: input.maxMarks,
        pass_marks: input.passMarks,
        syllabus_text: input.syllabusText ?? null,
      },
      include: { exam_subjects: { select: { name: true } } },
    });
    return toDto(row);
  }

  async delete(id: number): Promise<{ ok: true }> {
    await this.prisma.db.exam_datesheet.delete({ where: { id } });
    return { ok: true };
  }
}

function toDto(r: {
  id: number; term_id: number; class_slug: string; subject_id: number;
  exam_date: Date; start_time: Date | null; end_time: Date | null;
  max_marks: number; pass_marks: number; syllabus_text: string | null;
  exam_subjects: { name: string };
}): ExamDatesheetRow {
  return {
    id: r.id,
    termId: r.term_id,
    classSlug: r.class_slug,
    subjectId: r.subject_id,
    subjectName: r.exam_subjects.name,
    examDate: r.exam_date.toISOString().slice(0, 10),
    startTime: r.start_time ? r.start_time.toISOString().slice(11, 16) : null,
    endTime: r.end_time ? r.end_time.toISOString().slice(11, 16) : null,
    maxMarks: r.max_marks,
    passMarks: r.pass_marks,
    syllabusText: r.syllabus_text,
  };
}

function normaliseTime(s: string): string {
  return s.length === 5 ? `${s}:00` : s;
}
