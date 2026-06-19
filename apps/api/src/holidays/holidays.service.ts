import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  Holiday,
  HolidayUpsert,
  HolidayCalendarResponse,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/**
 * Holiday calendar bucketed by Indian academic year (Apr → Mar).
 *
 * Mirrors erp/holidays/index.php's KPI tiles (total, upcoming-60d,
 * sundays counted, working days) + month-by-month grid. Sundays are
 * computed in-memory because the PHP version doesn't store them as
 * holiday rows — it just counts the Sundays in the AY window.
 */
@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async calendar(academicYearIn?: number): Promise<HolidayCalendarResponse> {
    const today = new Date();
    const academicYear =
      academicYearIn ?? (today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1);

    const from = new Date(Date.UTC(academicYear, 3, 1));        // Apr 01
    const to = new Date(Date.UTC(academicYear + 1, 2, 31));     // Mar 31 (next calendar year)

    const rows = await this.prisma.db.holidays.findMany({
      where: { holiday_date: { gte: from, lte: to } },
      orderBy: { holiday_date: "asc" },
    });

    const in60 = new Date(today);
    in60.setDate(in60.getDate() + 60);
    const upcomingIn60Days = rows.filter(
      (r) => r.holiday_date >= today && r.holiday_date <= in60,
    ).length;

    const sundayCount = countSundays(from, to);
    const totalDays = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
    const workingDays = Math.max(0, totalDays - rows.length - sundayCount);

    return {
      academicYear,
      totalHolidays: rows.length,
      upcomingIn60Days,
      sundayCount,
      workingDays,
      items: rows.map(toDto),
    };
  }

  async findOne(id: number): Promise<Holiday> {
    const row = await this.prisma.db.holidays.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Holiday #${id} not found`);
    return toDto(row);
  }

  async create(input: HolidayUpsert, user: CurrentUser): Promise<Holiday> {
    const date = new Date(input.holidayDate);
    const clash = await this.prisma.db.holidays.findUnique({
      where: { holiday_date: date },
    });
    if (clash) throw new ConflictException(`A holiday already exists on ${input.holidayDate}`);
    const created = await this.prisma.db.holidays.create({
      data: {
        holiday_date: date,
        name: input.name,
        type: input.type,
        is_paid: input.isPaid,
        notes: input.notes ?? null,
        created_by: user.id,
      },
    });
    return toDto(created);
  }

  async update(id: number, input: HolidayUpsert): Promise<Holiday> {
    await this.findOne(id);
    const data: Prisma.holidaysUpdateInput = {
      holiday_date: new Date(input.holidayDate),
      name: input.name,
      type: input.type,
      is_paid: input.isPaid,
      notes: input.notes ?? null,
    };
    const updated = await this.prisma.db.holidays.update({ where: { id }, data });
    return toDto(updated);
  }

  async delete(id: number): Promise<{ ok: true }> {
    await this.findOne(id);
    await this.prisma.db.holidays.delete({ where: { id } });
    return { ok: true };
  }
}

type HolidayRow = Prisma.holidaysGetPayload<Record<string, never>>;

function toDto(r: HolidayRow): Holiday {
  return {
    id: r.id,
    holidayDate: r.holiday_date.toISOString().slice(0, 10),
    name: r.name,
    type: r.type,
    isPaid: Boolean(r.is_paid),
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
  };
}

function countSundays(from: Date, to: Date): number {
  let n = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    if (cursor.getUTCDay() === 0) n++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return n;
}
