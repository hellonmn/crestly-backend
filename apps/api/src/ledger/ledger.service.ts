import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { LedgerOverview, StaffSalaryQuery, StaffSalaryResponse } from "@crestly/shared";

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async overview(from: string, to: string): Promise<LedgerOverview> {
    const fromD = new Date(from);
    const toD = new Date(to);

    // Group all (non-cancelled) vouchers in range by category.
    const rows = await this.prisma.db.vouchers.groupBy({
      by: ["category", "payment_status"],
      where: {
        voucher_date: { gte: fromD, lte: toD },
        status: { not: "cancelled" },
      },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const byCategory = new Map<string, { count: number; total: number; paid: number; due: number }>();
    for (const r of rows) {
      const cat = r.category ?? "Uncategorised";
      const slot = byCategory.get(cat) ?? { count: 0, total: 0, paid: 0, due: 0 };
      slot.count += r._count._all;
      slot.total += r._sum.amount ?? 0;
      if (r.payment_status === "paid") slot.paid += r._sum.amount ?? 0;
      else slot.due += r._sum.amount ?? 0;
      byCategory.set(cat, slot);
    }

    let totalExpense = 0, paid = 0, due = 0;
    for (const v of byCategory.values()) {
      totalExpense += v.total;
      paid += v.paid;
      due += v.due;
    }

    // Salary this month — sum salary-attributed vouchers for current calendar month.
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const salaryMonthAgg = await this.prisma.db.vouchers.aggregate({
      where: {
        voucher_date: { gte: monthStart },
        category: { contains: "salar" },
        status: { not: "cancelled" },
      },
      _sum: { amount: true },
    });

    return {
      from, to,
      totalExpense, paid, due,
      staffSalaryThisMonth: salaryMonthAgg._sum.amount ?? 0,
      byCategory: Array.from(byCategory.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.total - a.total),
    };
  }

  async staffSalary(query: StaffSalaryQuery): Promise<StaffSalaryResponse> {
    const [yr, mo] = query.month.split("-").map(Number);
    const start = new Date(Date.UTC(yr!, mo! - 1, 1));
    const end = new Date(Date.UTC(yr!, mo!, 0));
    const monthDays = end.getUTCDate();

    const where: Parameters<typeof this.prisma.db.user.findMany>[0] = {
      where: {
        status: "active",
        ...(query.q && {
          OR: [
            { name: { contains: query.q } },
            { phone: { contains: query.q } },
            { employee_id: { contains: query.q } },
          ],
        }),
        ...(query.department && { department: query.department }),
      },
      select: {
        id: true, name: true, designation: true, department: true, monthly_salary: true,
      },
      orderBy: { name: "asc" },
    };

    const users = await this.prisma.db.user.findMany(where as never);

    const userIds = users.map((u: any) => u.id);
    const vouchers = await this.prisma.db.vouchers.findMany({
      where: {
        salary_user_id: { in: userIds },
        salary_month: query.month,
        status: { not: "cancelled" },
      },
      select: { salary_user_id: true, amount: true, payment_status: true, status: true },
    });
    const paidByUser = new Map<number, number>();
    const pendingByUser = new Map<number, number>();
    for (const v of vouchers) {
      if (!v.salary_user_id) continue;
      if (v.payment_status === "paid") {
        paidByUser.set(v.salary_user_id, (paidByUser.get(v.salary_user_id) ?? 0) + v.amount);
      } else if (v.status === "pending_approval" || v.status === "approved") {
        pendingByUser.set(v.salary_user_id, (pendingByUser.get(v.salary_user_id) ?? 0) + 1);
      }
    }

    const attendance = await this.prisma.db.staff_attendance.findMany({
      where: {
        user_id: { in: userIds },
        punched_at: { gte: start, lte: new Date(end.getTime() + 86400000 - 1) },
        punch_type: "in",
      },
      select: { user_id: true, punched_at: true },
    });
    const presentDaysByUser = new Map<number, Set<string>>();
    for (const p of attendance) {
      const set = presentDaysByUser.get(p.user_id) ?? new Set<string>();
      set.add(p.punched_at.toISOString().slice(0, 10));
      presentDaysByUser.set(p.user_id, set);
    }

    const rows = users.map((u: any) => {
      const monthlySalary = u.monthly_salary ?? 0;
      const dailyGross = monthlySalary > 0 ? Math.round(monthlySalary / monthDays) : 0;
      const present = presentDaysByUser.get(u.id)?.size ?? 0;
      const computed = dailyGross * present;
      const paid = paidByUser.get(u.id) ?? 0;
      return {
        userId: u.id,
        name: u.name,
        designation: u.designation,
        department: u.department,
        monthlySalary,
        computed,
        paid,
        due: Math.max(0, computed - paid),
        pendingVouchers: pendingByUser.get(u.id) ?? 0,
        presentDays: present,
        absentDays: monthDays - present,
        monthDays,
      };
    });

    return {
      month: query.month,
      totalComputed: rows.reduce((s, r) => s + r.computed, 0),
      totalPaid: rows.reduce((s, r) => s + r.paid, 0),
      totalDue: rows.reduce((s, r) => s + r.due, 0),
      pendingVouchers: rows.reduce((s, r) => s + r.pendingVouchers, 0),
      staffCount: rows.length,
      rows,
    };
  }
}
