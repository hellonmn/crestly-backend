import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { HrDashboard } from "@crestly/shared";

@Injectable()
export class HrService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async dashboard(): Promise<HrDashboard> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today.getTime() + 86400000 - 1);
    const monthStart = new Date(today);
    monthStart.setUTCDate(1);
    const in60 = new Date(today);
    in60.setUTCDate(in60.getUTCDate() + 60);

    const [
      activeStaff,
      punchInsToday,
      pendingLeaves,
      onLeaveToday,
      upcomingHolidays,
      leaveTakenAgg,
      headcountByDept,
      salaryThisMonthAgg,
    ] = await Promise.all([
      this.prisma.db.user.count({ where: { status: "active" } }),
      this.prisma.db.staff_attendance.findMany({
        where: { punched_at: { gte: today, lte: todayEnd }, punch_type: "in" },
        select: { user_id: true },
        distinct: ["user_id"],
      }),
      this.prisma.db.leaves.findMany({
        where: { status: "pending" },
        include: {
          users_leaves_user_idTousers: { select: { name: true } },
          leave_types: { select: { name: true } },
        },
        orderBy: { applied_at: "asc" },
        take: 8,
      }),
      this.prisma.db.leaves.findMany({
        where: { status: "approved", from_date: { lte: todayEnd }, to_date: { gte: today } },
        include: {
          users_leaves_user_idTousers: { select: { id: true, name: true } },
          leave_types: { select: { name: true } },
        },
        take: 20,
      }),
      this.prisma.db.holidays.findMany({
        where: { holiday_date: { gte: today, lte: in60 } },
        orderBy: { holiday_date: "asc" },
        take: 12,
      }),
      this.prisma.db.leaves.groupBy({
        by: ["leave_type_id"],
        where: { status: "approved", from_date: { gte: monthStart } },
        _sum: { days: true },
      }),
      this.prisma.db.user.groupBy({
        by: ["department"],
        where: { status: "active" },
        _count: { _all: true },
      }),
      this.prisma.db.vouchers.aggregate({
        where: {
          voucher_date: { gte: monthStart },
          category: { contains: "salar" },
          status: { not: "cancelled" },
        },
        _sum: { amount: true },
      }),
    ]);

    const leaveTypes = await this.prisma.db.leave_types.findMany({
      where: { id: { in: leaveTakenAgg.map((x) => x.leave_type_id) } },
      select: { id: true, name: true },
    });
    const ltById = new Map(leaveTypes.map((t) => [t.id, t.name]));

    return {
      totals: {
        activeStaff,
        punchedInToday: punchInsToday.length,
        onLeaveToday: onLeaveToday.length,
        salaryThisMonth: salaryThisMonthAgg._sum.amount ?? 0,
      },
      pendingLeaves: pendingLeaves.map((l) => ({
        id: l.id,
        userName: l.users_leaves_user_idTousers.name,
        leaveType: l.leave_types.name,
        fromDate: l.from_date.toISOString().slice(0, 10),
        toDate: l.to_date.toISOString().slice(0, 10),
        days: Number(l.days),
      })),
      onLeaveToday: onLeaveToday.map((l) => ({
        userId: l.users_leaves_user_idTousers.id,
        userName: l.users_leaves_user_idTousers.name,
        leaveType: l.leave_types.name,
        until: l.to_date.toISOString().slice(0, 10),
      })),
      upcomingHolidays: upcomingHolidays.map((h) => ({
        holidayDate: h.holiday_date.toISOString().slice(0, 10),
        name: h.name,
        type: h.type,
      })),
      leaveTaken: leaveTakenAgg.map((a) => ({
        leaveType: ltById.get(a.leave_type_id) ?? `Type #${a.leave_type_id}`,
        days: Number(a._sum.days ?? 0),
      })),
      headcountByDepartment: headcountByDept.map((h) => ({
        department: h.department ?? "Unassigned",
        count: h._count._all,
      })),
    };
  }
}
