import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { SalaryResponse, SalaryDayRow, SalaryDayState } from "@crestly/shared";

/**
 * Per-user monthly salary ledger. Simple model:
 *   dailyGross = monthlySalary / monthDays
 *   net per day = dailyGross when present, else 0 (cut = full day)
 * Late/early deductions are computed against staff_schedules.duty_start/end
 * with a 15-minute grace; each minute over deducts dailyGross/720 (assumes
 * 12-hour gross-to-minute scale, matching the PHP version).
 */
@Injectable()
export class SalaryService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async monthly(userId: number, month: string): Promise<SalaryResponse> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, monthly_salary: true, designation: true, department: true },
    });
    if (!user) throw new NotFoundException(`User #${userId} not found`);

    const [yr, mo] = month.split("-").map(Number);
    const start = new Date(Date.UTC(yr!, mo! - 1, 1));
    const end = new Date(Date.UTC(yr!, mo!, 0));
    const monthDays = end.getUTCDate();
    const monthlySalary = user.monthly_salary ?? 0;
    const dailyGross = monthDays > 0 ? Math.round(monthlySalary / monthDays) : 0;
    const todayIso = new Date().toISOString().slice(0, 10);

    // Pull all punches in the window.
    const punches = await this.prisma.db.staff_attendance.findMany({
      where: {
        user_id: userId,
        punched_at: { gte: start, lte: new Date(end.getTime() + 86400000 - 1) },
      },
      select: { punched_at: true, punch_type: true },
      orderBy: { punched_at: "asc" },
    });
    const punchByDay = new Map<string, { in?: Date; out?: Date }>();
    for (const p of punches) {
      const iso = p.punched_at.toISOString().slice(0, 10);
      const slot = punchByDay.get(iso) ?? {};
      if (p.punch_type === "in" && !slot.in) slot.in = p.punched_at;
      if (p.punch_type === "out") slot.out = p.punched_at;
      punchByDay.set(iso, slot);
    }

    // Holiday + weekend lookup.
    const holidays = await this.prisma.db.holidays.findMany({
      where: { holiday_date: { gte: start, lte: end } },
      select: { holiday_date: true },
    });
    const holidaySet = new Set(holidays.map((h) => h.holiday_date.toISOString().slice(0, 10)));

    // Latest schedule effective on or before each day.
    const schedules = await this.prisma.db.staff_schedules.findMany({
      where: { user_id: userId },
      orderBy: { effective_from: "asc" },
    });

    const rows: SalaryDayRow[] = [];
    let totalCut = 0, daysMarked = 0, daysPresent = 0, daysAbsent = 0, daysPending = 0;

    for (let d = 1; d <= monthDays; d++) {
      const date = new Date(Date.UTC(yr!, mo! - 1, d));
      const iso = date.toISOString().slice(0, 10);
      const dow = date.getUTCDay();          // 0=Sun
      const isWeekend = dow === 0;
      const isHoliday = holidaySet.has(iso);
      const isFuture = iso > todayIso;

      const p = punchByDay.get(iso);
      const marked = !!p?.in;
      if (marked) daysMarked++;

      const schedule = [...schedules].reverse().find((s) => s.effective_from <= date) ?? null;
      let lateMin = 0, earlyMin = 0;
      if (marked && schedule) {
        const dutyStart = combineTime(date, schedule.duty_start);
        const dutyEnd = combineTime(date, schedule.duty_end);
        if (p?.in) lateMin = Math.max(0, Math.round((p.in.getTime() - dutyStart.getTime()) / 60_000) - 15);
        if (p?.out) earlyMin = Math.max(0, Math.round((dutyEnd.getTime() - p.out.getTime()) / 60_000) - 15);
      }

      const cutDay = !marked && !isWeekend && !isHoliday && !isFuture ? dailyGross : 0;
      const cutMinutes = Math.round(((lateMin + earlyMin) / 720) * dailyGross);
      const cut = cutDay + cutMinutes;
      const net = isFuture ? 0 : Math.max(0, dailyGross - cut);
      if (!isFuture) totalCut += cut;

      // Derive a coarse-grained state so the UI can pick the right pill.
      let state: SalaryDayState;
      if (isHoliday) state = "holiday";
      else if (isWeekend) state = "weekend";
      else if (isFuture) state = "future";
      else if (monthlySalary <= 0) state = "no_salary";
      else if (!schedule) state = "no_shift";
      else if (marked && !p?.out) { state = "pending"; daysPending++; }
      else if (marked) { state = "computed"; daysPresent++; }
      else { state = "absent"; daysAbsent++; }

      rows.push({
        date: iso,
        marked,
        punchIn: p?.in ? p.in.toISOString().slice(11, 16) : null,
        punchOut: p?.out ? p.out.toISOString().slice(11, 16) : null,
        lateMinutes: lateMin,
        earlyMinutes: earlyMin,
        cut,
        net,
        isHoliday,
        isWeekend,
        state,
      });
    }

    const netEarned = rows.reduce((s, r) => s + r.net, 0);

    const salaryVouchers = await this.prisma.db.vouchers.findMany({
      where: { salary_user_id: userId, salary_month: month, status: { not: "cancelled" } },
      select: { amount: true, payment_status: true, status: true },
    });
    const paidViaVoucher = salaryVouchers
      .filter((v) => v.payment_status === "paid")
      .reduce((s, v) => s + v.amount, 0);
    const pendingVouchers = salaryVouchers.filter(
      (v) => v.status === "pending_approval" || (v.status === "approved" && v.payment_status !== "paid"),
    ).length;

    return {
      userId, userName: user.name,
      userDesignation: user.designation ?? null,
      userDepartment: user.department ?? null,
      month, monthlySalary,
      dailyGross,
      daysInMonth: monthDays,
      daysMarked, daysPresent, daysAbsent, daysPending,
      totalCut, netEarned,
      paidViaVoucher, due: Math.max(0, netEarned - paidViaVoucher),
      pendingVouchers, rows,
    };
  }
}

function combineTime(date: Date, t: Date): Date {
  const out = new Date(date);
  out.setUTCHours(t.getUTCHours(), t.getUTCMinutes(), t.getUTCSeconds(), 0);
  return out;
}
