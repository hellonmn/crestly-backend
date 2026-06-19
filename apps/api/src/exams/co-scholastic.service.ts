import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { CoArea, CoGradeSave } from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class ExamCoScholasticService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async areas(): Promise<CoArea[]> {
    const rows = await this.prisma.db.exam_co_areas.findMany({
      orderBy: { sort_order: "asc" },
    });
    return rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, description: r.description, sortOrder: r.sort_order,
    }));
  }

  async grid(termId: number, classSlug: string, section: string) {
    const term = await this.prisma.db.exam_terms.findUnique({ where: { id: termId } });
    if (!term) throw new NotFoundException();
    const areas = await this.areas();
    const students = await this.prisma.db.student.findMany({
      where: { class: classSlug, section, status: "active" },
      select: { srNumber: true, studentName: true },
      orderBy: { studentName: "asc" },
    });
    const grades = await this.prisma.db.exam_co_grades.findMany({
      where: { term_id: termId, sr_number: { in: students.map((s) => s.srNumber) } },
    });
    const map = new Map<string, "A" | "B" | "C">();
    for (const g of grades) map.set(`${g.sr_number}|${g.area_id}`, g.grade);

    return {
      term: { id: term.id, name: term.name, isFinalized: term.is_finalized },
      areas,
      students: students.map((s) => ({
        srNumber: s.srNumber,
        studentName: s.studentName,
        grades: Object.fromEntries(areas.map((a) => [a.id, map.get(`${s.srNumber}|${a.id}`) ?? null])),
      })),
    };
  }

  async save(input: CoGradeSave, user: CurrentUser): Promise<{ ok: true }> {
    const term = await this.prisma.db.exam_terms.findUnique({ where: { id: input.termId } });
    if (!term) throw new NotFoundException();
    if (term.is_finalized) throw new BadRequestException("Term is finalized.");

    const existing = await this.prisma.db.exam_co_grades.findFirst({
      where: { term_id: input.termId, sr_number: input.srNumber, area_id: input.areaId },
    });

    if (existing) {
      await this.prisma.db.exam_co_grades.update({
        where: { id: existing.id },
        data: { grade: input.grade, marked_by: user.id, marked_at: new Date() },
      });
    } else {
      await this.prisma.db.exam_co_grades.create({
        data: {
          term_id: input.termId,
          sr_number: input.srNumber,
          area_id: input.areaId,
          grade: input.grade,
          marked_by: user.id,
        },
      });
    }
    return { ok: true };
  }
}
