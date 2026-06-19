import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  HoursBulkUpdate, SalaryBulkUpdate, ShiftListQuery, ShiftListResponse, ShiftRow, ShiftUpsertInput,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: ShiftListQuery): Promise<ShiftListResponse> {
    const [users, allRoles, deptRows] = await Promise.all([
      this.prisma.db.user.findMany({
        where: {
          status: "active",
          ...(query.q && {
            OR: [
              { name: { contains: query.q } },
              { employee_id: { contains: query.q } },
              { phone: { contains: query.q } },
              { designation: { contains: query.q } },
            ],
          }),
          ...(query.department && { department: query.department }),
          ...(query.roleSlug && { role: { slug: query.roleSlug } }),
        },
        include: {
          role: { select: { id: true, slug: true, name: true } },
          staff_schedules_staff_schedules_user_idTousers: {
            orderBy: { effective_from: "desc" },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.db.role.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.db.user.findMany({
        distinct: ["department"],
        where: { status: "active", department: { not: null } },
        select: { department: true },
        orderBy: { department: "asc" },
      }),
    ]);

    const rows: ShiftRow[] = users.map((u) => {
      const sch = u.staff_schedules_staff_schedules_user_idTousers[0] ?? null;
      return {
        userId: u.id,
        name: u.name,
        designation: u.designation,
        department: u.department,
        roleId: u.role?.id ?? null,
        roleName: u.role?.name ?? null,
        roleSlug: u.role?.slug ?? null,
        monthlySalary: u.monthly_salary,
        dutyStart: sch?.duty_start ? sch.duty_start.toISOString().slice(11, 19) : null,
        dutyEnd: sch?.duty_end ? sch.duty_end.toISOString().slice(11, 19) : null,
        effectiveFrom: sch?.effective_from ? sch.effective_from.toISOString().slice(0, 10) : null,
        scheduleId: sch?.id ?? null,
      };
    });

    const withSchedule = rows.filter((r) => r.scheduleId).length;
    return {
      rows,
      withSchedule,
      withoutSchedule: rows.length - withSchedule,
      total: rows.length,
      roles: allRoles,
      departments: deptRows
        .map((r) => r.department)
        .filter((d): d is string => d !== null),
    };
  }

  async upsertSchedule(input: ShiftUpsertInput, user: CurrentUser): Promise<{ ok: true; id: number }> {
    const u = await this.prisma.db.user.findUnique({ where: { id: input.userId } });
    if (!u) throw new NotFoundException();

    const created = await this.prisma.db.staff_schedules.create({
      data: {
        user_id: input.userId,
        duty_start: new Date(`1970-01-01T${normaliseTime(input.dutyStart)}Z`),
        duty_end: new Date(`1970-01-01T${normaliseTime(input.dutyEnd)}Z`),
        effective_from: new Date(input.effectiveFrom),
        notes: input.notes ?? null,
        created_by: user.id,
      },
    });
    return { ok: true, id: created.id };
  }

  async bulkSalary(input: SalaryBulkUpdate): Promise<{ ok: true; count: number }> {
    const r = await this.prisma.db.user.updateMany({
      where: { id: { in: input.userIds } },
      data: { monthly_salary: input.monthlySalary },
    });
    return { ok: true, count: r.count };
  }

  async bulkHours(input: HoursBulkUpdate, user: CurrentUser): Promise<{ ok: true; count: number }> {
    const dutyStart = new Date(`1970-01-01T${normaliseTime(input.dutyStart)}Z`);
    const dutyEnd = new Date(`1970-01-01T${normaliseTime(input.dutyEnd)}Z`);
    const effectiveFrom = new Date(input.effectiveFrom);
    for (const userId of input.userIds) {
      await this.prisma.db.staff_schedules.create({
        data: {
          user_id: userId,
          duty_start: dutyStart,
          duty_end: dutyEnd,
          effective_from: effectiveFrom,
          created_by: user.id,
        },
      });
    }
    return { ok: true, count: input.userIds.length };
  }
}

function normaliseTime(s: string): string {
  return s.length === 5 ? `${s}:00` : s;
}
