import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { ExamClassSubjectToggle, ExamSubject, ExamSubjectUpsert } from "@crestly/shared";

@Injectable()
export class ExamSubjectsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(): Promise<ExamSubject[]> {
    const rows = await this.prisma.db.exam_subjects.findMany({
      include: { exam_class_subjects: { select: { class_slug: true } } },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      shortCode: r.short_code,
      isLanguage: r.is_language,
      sortOrder: r.sort_order,
      classes: r.exam_class_subjects.map((c) => c.class_slug),
    }));
  }

  async create(input: ExamSubjectUpsert): Promise<ExamSubject> {
    const created = await this.prisma.db.exam_subjects.create({
      data: {
        slug: input.slug,
        name: input.name,
        short_code: input.shortCode,
        is_language: input.isLanguage,
        sort_order: input.sortOrder,
      },
    });
    return {
      id: created.id, slug: created.slug, name: created.name, shortCode: created.short_code,
      isLanguage: created.is_language, sortOrder: created.sort_order, classes: [],
    };
  }

  async update(id: number, input: ExamSubjectUpsert): Promise<ExamSubject> {
    const row = await this.prisma.db.exam_subjects.update({
      where: { id },
      data: {
        slug: input.slug, name: input.name, short_code: input.shortCode,
        is_language: input.isLanguage, sort_order: input.sortOrder,
      },
      include: { exam_class_subjects: { select: { class_slug: true } } },
    });
    return {
      id: row.id, slug: row.slug, name: row.name, shortCode: row.short_code,
      isLanguage: row.is_language, sortOrder: row.sort_order,
      classes: row.exam_class_subjects.map((c) => c.class_slug),
    };
  }

  async delete(id: number): Promise<{ ok: true }> {
    await this.prisma.db.exam_subjects.delete({ where: { id } });
    return { ok: true };
  }

  async toggleClass(input: ExamClassSubjectToggle): Promise<{ ok: true }> {
    if (input.enabled) {
      await this.prisma.db.exam_class_subjects.upsert({
        where: { class_slug_subject_id: { class_slug: input.classSlug, subject_id: input.subjectId } },
        update: {},
        create: { class_slug: input.classSlug, subject_id: input.subjectId },
      });
    } else {
      await this.prisma.db.exam_class_subjects
        .delete({
          where: { class_slug_subject_id: { class_slug: input.classSlug, subject_id: input.subjectId } },
        })
        .catch(() => undefined);
    }
    return { ok: true };
  }
}
