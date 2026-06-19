import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  SchoolClass,
  Section,
  SchoolClassUpsert,
  SectionUpsert,
} from "@crestly/shared";

/**
 * Classes + Sections. Mirrors erp/classes/index.php which stacks classes
 * top-down (by sort_order) with their sections inline. Each section can
 * have a class-teacher assigned from the `users` table.
 *
 * Student counts are computed from `students.class` + `students.section`
 * matched against the class slug + section code — the same join used in
 * PHP. We don't trust the cached `class_section_summary` table here.
 */
@Injectable()
export class ClassesService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(): Promise<SchoolClass[]> {
    const classes = await this.prisma.db.classes.findMany({
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      include: {
        sections: {
          include: {
            users: { select: { id: true, name: true } },
          },
          orderBy: { code: "asc" },
        },
      },
    });

    // Compute student counts per (class slug, section code) in one shot.
    const counts = await this.prisma.db.student.groupBy({
      by: ["class", "section"],
      where: { status: "active" },
      _count: { _all: true },
    });
    const countMap = new Map<string, number>();
    for (const c of counts) {
      countMap.set(`${c.class}|${c.section}`, c._count._all);
    }

    return classes.map((c) => {
      const sections: Section[] = c.sections.map((s) => ({
        id: s.id,
        classId: s.class_id,
        code: s.code,
        capacity: s.capacity,
        teacherUserId: s.teacher_user_id,
        teacherName: s.users?.name ?? null,
        studentCount: countMap.get(`${c.slug}|${s.code}`) ?? 0,
      }));
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        sortOrder: c.sort_order,
        isSystem: Boolean(c.is_system),
        sections,
        totalStudents: sections.reduce((sum, s) => sum + s.studentCount, 0),
      };
    });
  }

  async findOne(id: number): Promise<SchoolClass> {
    const all = await this.list();
    const one = all.find((c) => c.id === id);
    if (!one) throw new NotFoundException(`Class #${id} not found`);
    return one;
  }

  async create(input: SchoolClassUpsert): Promise<SchoolClass> {
    const clash = await this.prisma.db.classes.findUnique({ where: { slug: input.slug } });
    if (clash) throw new ConflictException(`Class slug '${input.slug}' already in use`);
    const created = await this.prisma.db.classes.create({
      data: { slug: input.slug, name: input.name, sort_order: input.sortOrder ?? 0 },
    });
    return this.findOne(created.id);
  }

  async update(id: number, input: SchoolClassUpsert): Promise<SchoolClass> {
    const existing = await this.prisma.db.classes.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Class #${id} not found`);
    if (existing.is_system && input.slug !== existing.slug) {
      throw new BadRequestException("System class slug cannot be changed");
    }
    if (input.slug !== existing.slug) {
      const clash = await this.prisma.db.classes.findFirst({
        where: { slug: input.slug, NOT: { id } },
      });
      if (clash) throw new ConflictException(`Class slug '${input.slug}' already in use`);
    }
    await this.prisma.db.classes.update({
      where: { id },
      data: { slug: input.slug, name: input.name, sort_order: input.sortOrder ?? existing.sort_order },
    });
    return this.findOne(id);
  }

  async delete(id: number): Promise<{ ok: true }> {
    const cls = await this.prisma.db.classes.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException(`Class #${id} not found`);
    if (cls.is_system) throw new BadRequestException("System classes cannot be deleted");

    // Block deletion if any students reference this class.
    const count = await this.prisma.db.student.count({ where: { class: cls.slug } });
    if (count > 0) {
      throw new BadRequestException(`${count} student(s) are still enrolled in this class`);
    }
    await this.prisma.db.classes.delete({ where: { id } });
    return { ok: true };
  }

  // --- Sections ---

  async createSection(input: SectionUpsert): Promise<Section> {
    const cls = await this.prisma.db.classes.findUnique({ where: { id: input.classId } });
    if (!cls) throw new NotFoundException(`Class #${input.classId} not found`);
    const clash = await this.prisma.db.sections.findFirst({
      where: { class_id: input.classId, code: input.code },
    });
    if (clash) throw new ConflictException(`Section '${input.code}' already exists in this class`);
    const created = await this.prisma.db.sections.create({
      data: {
        class_id: input.classId,
        code: input.code,
        capacity: input.capacity ?? null,
        teacher_user_id: input.teacherUserId ?? null,
      },
      include: { users: { select: { id: true, name: true } } },
    });
    return {
      id: created.id,
      classId: created.class_id,
      code: created.code,
      capacity: created.capacity,
      teacherUserId: created.teacher_user_id,
      teacherName: created.users?.name ?? null,
      studentCount: 0,
    };
  }

  async updateSection(id: number, input: SectionUpsert): Promise<Section> {
    const existing = await this.prisma.db.sections.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Section #${id} not found`);
    const updated = await this.prisma.db.sections.update({
      where: { id },
      data: {
        code: input.code,
        capacity: input.capacity ?? null,
        teacher_user_id: input.teacherUserId ?? null,
      },
      include: {
        classes: true,
        users: { select: { id: true, name: true } },
      },
    });
    const count = await this.prisma.db.student.count({
      where: { class: updated.classes.slug, section: updated.code, status: "active" },
    });
    return {
      id: updated.id,
      classId: updated.class_id,
      code: updated.code,
      capacity: updated.capacity,
      teacherUserId: updated.teacher_user_id,
      teacherName: updated.users?.name ?? null,
      studentCount: count,
    };
  }

  async deleteSection(id: number): Promise<{ ok: true }> {
    const section = await this.prisma.db.sections.findUnique({
      where: { id },
      include: { classes: true },
    });
    if (!section) throw new NotFoundException(`Section #${id} not found`);
    const count = await this.prisma.db.student.count({
      where: { class: section.classes.slug, section: section.code },
    });
    if (count > 0) {
      throw new BadRequestException(`${count} student(s) are still assigned to this section`);
    }
    await this.prisma.db.sections.delete({ where: { id } });
    return { ok: true };
  }
}
