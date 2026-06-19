import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { TenantService } from "../tenant/tenant.service";
import type { CurrentUser } from "@crestly/shared";

/**
 * Home-page dashboard payload. Mirrors `erp/index.php` aggregates 1:1 so the
 * React page can render the same panels. Each block is wrapped so a single
 * missing migration (e.g. exam_terms or vouchers) doesn't blank the whole
 * dashboard — failures collapse to zero / null.
 *
 * Money fields stay raw paise; the frontend formats with `money_compact`.
 */
export interface DashboardSummary {
  // Top KPI row
  activeStudents: number;
  inactiveStudents: number;
  dayCount: number;
  hostelCount: number;
  sections: number;

  todayAttendance: {
    present: number;
    absent: number;          // effective absent = total − present − late − excused
    late: number;
    excused: number;
    marked: number;
    total: number;
    pct: number | null;
  };

  // Fee collection (session)
  fee: {
    sessionCode: string;
    yearlyTotal: number;
    collected: number;
    due: number;
    withBalance: number;
    overdue: number;
    pct: number;
  };
  fee7day: Array<{ d: string; amt: number }>;

  // This-month cashflow
  monthIncome: number;
  monthExpense: number;
  monthExpensePending: number;   // count of unpaid/pending vouchers
  monthExpenseDue: number;       // money on credit bills
  monthNet: number;

  // Expense breakdown — top 5 categories this month
  expenseTop: Array<{ category: string; paid: number }>;
  voucherPending: number;

  // Leaves
  leavePending: number;
  leaveToday: number;

  // Staff / payroll
  staffCount: number;
  staffPunched: number;
  payrollMonth: number;
  payrollUnset: number;

  // Hostel
  hostel: {
    total: number;
    boys: number;
    girls: number;
    boysCapacity: number;
    girlsCapacity: number;
    rooms: number;
    annual: number;
  } | null;

  // Transport
  transport: {
    students: number;
    pickups: number;
    slabs: number;
    revenue: number;
  } | null;

  // Upcoming
  nextExam: { termName: string; termCode: string; date: string; daysAway: number } | null;
  nextHoliday: { date: string; name: string; daysAway: number } | null;

  // Recent
  recentStudents: Array<{ srNumber: number; name: string; class: string; section: string; isHostel: boolean }>;
  classDist: Array<{ class: string; n: number; hostelN: number }>;

  // Approvals composite
  pendingApprovals: number; // student edit requests
  allPending: number;

  // Per-user daily review state
  reviewedToday: string[];

  // School name comes from tenant config so the lede can render correctly.
  schoolName: string;
}

const CLASS_ORDER: Record<string, number> = {
  Nursery: 0, LKG: 1, UKG: 2, "1st": 3, "2nd": 4, "3rd": 5, "4th": 6, "5th": 7,
  "6th": 8, "7th": 9, "8th": 10, "9th": 11, "10th": 12, "11th": 13, "12th": 14,
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly tenant: TenantService,
  ) {}

  async summary(user: CurrentUser): Promise<DashboardSummary> {
    const db = this.prisma.db;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(today.getTime() + 86400000 - 1);
    const monthStart = new Date(today);
    monthStart.setUTCDate(1);
    const monthEnd = new Date(today);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 1);
    const past7 = new Date(today);
    past7.setUTCDate(past7.getUTCDate() - 6);
    const in60 = new Date(today);
    in60.setUTCDate(in60.getUTCDate() + 60);

    // Current session — best-effort: find the most recent active session row.
    const session = await db.session.findFirst({
      where: { isCurrent: true },
      select: { code: true },
    }).catch(() => null);
    const sessionCode = session?.code ?? "";

    // Resolve school name from tenant configuration (best-effort).
    let schoolName = "Your school";
    try {
      const info = await db.schoolInfo.findUnique({ where: { k: "school_name" } }).catch(() => null);
      if (info?.v) schoolName = info.v;
    } catch { /* ignore */ }

    const [
      activeStudents,
      totalStudents,
      hostelCount,
      sectionsAgg,
      attendanceTodayBuckets,
      attendanceTodayMarked,
      feeAgg,
      fee7dayRaw,
      monthIncomeAgg,
      monthExpenseAgg,
      monthExpensePending,
      monthExpenseDue,
      expenseTopRaw,
      voucherPending,
      leavePending,
      leaveTodayCount,
      staffCount,
      staffPunchedRaw,
      payrollMonthAgg,
      payrollUnset,
      hostelRoomsAgg,
      pickupCount,
      transportStudents,
      transportSlabsCount,
      nextExamRaw,
      nextHolidayRaw,
      recentStudentsRaw,
      classDistRaw,
      pendingApprovals,
      reviewedTodayRows,
    ] = await Promise.all([
      db.student.count({ where: { status: "active" } }),
      db.student.count(),
      db.student.count({ where: { is_hostel: true, status: "active" } }),
      db.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(DISTINCT CONCAT(class,'-',section)) AS n FROM students WHERE status='active'`
      ).catch(() => [{ n: 0n }]),
      db.attendance.groupBy({
        by: ["status"],
        where: { attendance_date: { gte: today, lte: todayEnd } },
        _count: { _all: true },
      }).catch(() => []),
      db.attendance.count({ where: { attendance_date: { gte: today, lte: todayEnd } } }).catch(() => 0),
      sessionCode
        ? db.$queryRawUnsafe<Array<{ total: bigint; paid: bigint; due: bigint; with_bal: bigint; overdue: bigint }>>(
            `SELECT
              COALESCE(SUM(total_this_year),0) AS total,
              COALESCE(SUM(paid_amount),0)     AS paid,
              COALESCE(SUM(due_amount),0)      AS due,
              SUM(CASE WHEN due_amount > 0 THEN 1 ELSE 0 END) AS with_bal,
              SUM(CASE WHEN payment_status='overdue' THEN 1 ELSE 0 END) AS overdue
             FROM student_fees WHERE session_code = ?`,
            sessionCode,
          ).catch(() => [{ total: 0n, paid: 0n, due: 0n, with_bal: 0n, overdue: 0n }])
        : Promise.resolve([{ total: 0n, paid: 0n, due: 0n, with_bal: 0n, overdue: 0n }]),
      db.$queryRawUnsafe<Array<{ d: Date; amt: bigint }>>(
        `SELECT paid_on AS d, COALESCE(SUM(amount),0) AS amt
         FROM fee_payments
         WHERE paid_on BETWEEN ? AND ? AND is_voided = 0
         GROUP BY paid_on`,
        past7.toISOString().slice(0, 10),
        today.toISOString().slice(0, 10),
      ).catch(() => []),
      db.fee_payments.aggregate({
        where: { paid_on: { gte: monthStart, lt: monthEnd }, is_voided: false },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
      db.vouchers.aggregate({
        where: { voucher_date: { gte: monthStart, lt: monthEnd }, payment_status: "paid" },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
      db.vouchers.count({
        where: { voucher_date: { gte: monthStart, lt: monthEnd }, payment_status: { not: "paid" }, status: { not: "rejected" } },
      }).catch(() => 0),
      db.vouchers.aggregate({
        where: { voucher_date: { gte: monthStart, lt: monthEnd }, is_credit_bill: true, payment_status: { not: "paid" } },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: 0 } })),
      db.$queryRawUnsafe<Array<{ category: string | null; paid: bigint }>>(
        `SELECT category, COALESCE(SUM(amount),0) AS paid
         FROM vouchers
         WHERE voucher_date BETWEEN ? AND ?
           AND payment_status = 'paid'
           AND category IS NOT NULL AND category <> ''
         GROUP BY category
         ORDER BY paid DESC
         LIMIT 5`,
        monthStart.toISOString().slice(0, 10),
        monthEnd.toISOString().slice(0, 10),
      ).catch(() => []),
      db.vouchers.count({ where: { status: "pending_approval" } }).catch(() => 0),
      db.leaves.count({ where: { status: "pending" } }).catch(() => 0),
      db.leaves.count({
        where: { status: "approved", from_date: { lte: todayEnd }, to_date: { gte: today } },
      }).catch(() => 0),
      db.user.count({ where: { status: "active" } }),
      db.staff_attendance.findMany({
        where: { punch_type: "in", punched_at: { gte: today, lte: todayEnd } },
        distinct: ["user_id"],
        select: { user_id: true },
      }).catch(() => []),
      db.user.aggregate({
        where: { status: "active", monthly_salary: { gt: 0 } },
        _sum: { monthly_salary: true },
      }).catch(() => ({ _sum: { monthly_salary: 0 } })),
      db.user.count({
        where: { status: "active", OR: [{ monthly_salary: null }, { monthly_salary: 0 }] },
      }).catch(() => 0),
      db.hostel_rooms.aggregate({ _sum: { capacity: true }, _count: { _all: true } }).catch(() => ({ _sum: { capacity: 0 }, _count: { _all: 0 } })),
      db.pickupPoint.count().catch(() => 0),
      db.student.count({ where: { status: "active", pickupPointId: { not: null } } }).catch(() => 0),
      db.transport_slabs.count().catch(() => 0),
      sessionCode
        ? db.$queryRawUnsafe<Array<{ d_min: Date; term_name: string; term_code: string }>>(
            `SELECT MIN(d.exam_date) AS d_min, t.name AS term_name, t.short_code AS term_code
             FROM exam_datesheet d JOIN exam_terms t ON t.id = d.term_id
             WHERE t.session_code = ? AND d.exam_date >= ?
             GROUP BY t.id, t.name, t.short_code
             ORDER BY d_min ASC LIMIT 1`,
            sessionCode, today.toISOString().slice(0, 10),
          ).catch(() => [])
        : Promise.resolve([]),
      db.holidays.findFirst({
        where: { holiday_date: { gte: today, lte: in60 } },
        orderBy: { holiday_date: "asc" },
      }).catch(() => null),
      db.student.findMany({
        orderBy: [{ createdAt: "desc" }, { srNumber: "desc" }],
        take: 6,
        select: {
          srNumber: true, studentName: true, class: true, section: true, is_hostel: true,
        },
      }).catch(() => []),
      db.$queryRawUnsafe<Array<{ class: string; n: bigint; hostel_n: bigint }>>(
        `SELECT class,
                COUNT(*) AS n,
                SUM(CASE WHEN is_hostel=1 THEN 1 ELSE 0 END) AS hostel_n
         FROM students
         WHERE status='active'
         GROUP BY class`
      ).catch(() => []),
      db.student_edit_requests.count({ where: { status: "pending" } }).catch(() => 0),
      db.dashboard_reviews.findMany({
        where: { user_id: user.id, review_date: today },
        select: { review_key: true },
      }).catch(() => []),
    ]);

    // -------- Build derived/grouped values --------

    const attMap = new Map<string, number>();
    for (const row of attendanceTodayBuckets) attMap.set(row.status, row._count._all);
    const att = {
      present: attMap.get("present") ?? 0,
      absent:  attMap.get("absent")  ?? 0,
      late:    attMap.get("late")    ?? 0,
      excused: attMap.get("excused") ?? 0,
      marked:  attendanceTodayMarked,
      total:   activeStudents,                   // total denominator = active students
      pct: null as number | null,
    };
    const absentEff = Math.max(0, att.total - att.present - att.late - att.excused);
    att.absent = absentEff;
    if (att.total > 0) att.pct = Math.round(((att.present + att.late) / att.total) * 1000) / 10;

    const fa = feeAgg[0] ?? { total: 0n, paid: 0n, due: 0n, with_bal: 0n, overdue: 0n };
    const yearlyTotal = Number(fa.total);
    const collected = Number(fa.paid);
    const due = Number(fa.due);
    const fee = {
      sessionCode,
      yearlyTotal,
      collected,
      due,
      withBalance: Number(fa.with_bal),
      overdue: Number(fa.overdue),
      pct: yearlyTotal > 0 ? Math.round((collected / yearlyTotal) * 1000) / 10 : 0,
    };

    // Pad fee 7-day window with zeros for missing days.
    const fee7day: Array<{ d: string; amt: number }> = [];
    const byDay = new Map<string, number>();
    for (const r of fee7dayRaw) {
      const k = (r.d instanceof Date ? r.d : new Date(r.d)).toISOString().slice(0, 10);
      byDay.set(k, Number(r.amt));
    }
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const k = d.toISOString().slice(0, 10);
      fee7day.push({ d: k, amt: byDay.get(k) ?? 0 });
    }

    const monthIncome = Number(monthIncomeAgg._sum?.amount ?? 0);
    const monthExpense = Number(monthExpenseAgg._sum?.amount ?? 0);
    const monthExpDue = Number(monthExpenseDue._sum?.amount ?? 0);

    const expenseTop = expenseTopRaw.map((r) => ({
      category: r.category ?? "Uncategorized",
      paid: Number(r.paid),
    }));

    // Hostel summary — best-effort. boys/girls are heuristic counts based on
    // allocations; we report capacity from rooms only.
    let hostel: DashboardSummary["hostel"] = null;
    try {
      const totalCap = Number(hostelRoomsAgg._sum?.capacity ?? 0);
      const rooms = hostelRoomsAgg._count?._all ?? 0;
      // Boys/Girls from students: we use gender on Student joined with is_hostel.
      const [boys, girls] = await Promise.all([
        db.student.count({ where: { is_hostel: true, status: "active", gender: "Male" } }).catch(() => 0),
        db.student.count({ where: { is_hostel: true, status: "active", gender: "Female" } }).catch(() => 0),
      ]);
      // Capacity split assumed 60/40 in absence of explicit gender on rooms.
      const boysCap = Math.round(totalCap * 0.6);
      const girlsCap = Math.max(0, totalCap - boysCap);
      // Annual billing = sum of hostel_lodging+mess+common × current session, best-effort.
      let annual = 0;
      try {
        const sumRow = await db.$queryRawUnsafe<Array<{ annual: bigint | null }>>(
          `SELECT COALESCE(SUM(hostel_lodging + hostel_mess + hostel_common), 0) AS annual
           FROM student_fees WHERE is_hostel = 1 AND session_code = ?`,
          sessionCode,
        );
        annual = Number(sumRow[0]?.annual ?? 0);
      } catch { /* ignore */ }

      hostel = {
        total: hostelCount,
        boys,
        girls,
        boysCapacity: boysCap,
        girlsCapacity: girlsCap,
        rooms,
        annual,
      };
    } catch { /* hostel stays null */ }

    // Transport summary
    const transport = pickupCount > 0 || transportStudents > 0 ? {
      students: transportStudents,
      pickups: pickupCount,
      slabs: transportSlabsCount,
      revenue: 0, // computed in PHP via slab × counts; left for a later pass
    } : null;

    // Upcoming exam / holiday
    const nextExam = nextExamRaw[0]
      ? {
          termName: nextExamRaw[0].term_name,
          termCode: nextExamRaw[0].term_code,
          date: nextExamRaw[0].d_min.toISOString().slice(0, 10),
          daysAway: Math.max(0, Math.round((nextExamRaw[0].d_min.getTime() - today.getTime()) / 86400000)),
        }
      : null;
    const nextHoliday = nextHolidayRaw
      ? {
          date: nextHolidayRaw.holiday_date.toISOString().slice(0, 10),
          name: nextHolidayRaw.name,
          daysAway: Math.max(0, Math.round((nextHolidayRaw.holiday_date.getTime() - today.getTime()) / 86400000)),
        }
      : null;

    // Sort class distribution by canonical order.
    const classDist = classDistRaw
      .map((r) => ({ class: r.class, n: Number(r.n), hostelN: Number(r.hostel_n) }))
      .sort((a, b) => (CLASS_ORDER[a.class] ?? 99) - (CLASS_ORDER[b.class] ?? 99));

    const monthNet = monthIncome - monthExpense;
    const sections = Number(sectionsAgg[0]?.n ?? 0);
    const allPending = pendingApprovals + voucherPending + leavePending;

    return {
      activeStudents,
      inactiveStudents: totalStudents - activeStudents,
      dayCount: activeStudents - hostelCount,
      hostelCount,
      sections,
      todayAttendance: att,
      fee,
      fee7day,
      monthIncome,
      monthExpense,
      monthExpensePending,
      monthExpenseDue: monthExpDue,
      monthNet,
      expenseTop,
      voucherPending,
      leavePending,
      leaveToday: leaveTodayCount,
      staffCount,
      staffPunched: staffPunchedRaw.length,
      payrollMonth: Number(payrollMonthAgg._sum?.monthly_salary ?? 0),
      payrollUnset,
      hostel,
      transport,
      nextExam,
      nextHoliday,
      recentStudents: recentStudentsRaw.map((r) => ({
        srNumber: r.srNumber,
        name: r.studentName,
        class: r.class,
        section: r.section,
        isHostel: r.is_hostel,
      })),
      classDist,
      pendingApprovals,
      allPending,
      reviewedToday: reviewedTodayRows.map((r) => r.review_key),
      schoolName,
    };
  }

  /** Mark a tile reviewed for today. Idempotent. */
  async reviewCheck(user: CurrentUser, key: string, label?: string | null): Promise<{ ok: true }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await this.prisma.db.dashboard_reviews.upsert({
      where: { user_id_review_date_review_key: { user_id: user.id, review_date: today, review_key: key } },
      update: { review_label: label ?? null, reviewed_at: new Date() },
      create: { user_id: user.id, review_date: today, review_key: key, review_label: label ?? null },
    });
    return { ok: true };
  }

  async reviewUncheck(user: CurrentUser, key: string): Promise<{ ok: true }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await this.prisma.db.dashboard_reviews.deleteMany({
      where: { user_id: user.id, review_date: today, review_key: key },
    });
    return { ok: true };
  }

  async reviewResetToday(user: CurrentUser): Promise<{ ok: true; cleared: number }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const r = await this.prisma.db.dashboard_reviews.deleteMany({
      where: { user_id: user.id, review_date: today },
    });
    return { ok: true, cleared: r.count };
  }
}
