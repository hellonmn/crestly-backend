import type { PrismaClient } from "@prisma/client";

/* ============================================================
   Tools the AI can call. Each is a (1) JSON-schema definition
   for the LLM + (2) a TypeScript implementation that runs the
   query and returns a small JSON payload.

   Keep responses small (< ~1500 tokens) — the LLM has to fit
   them into its context. Round numbers, format dates, omit
   internal IDs unless useful.
   ============================================================ */

export interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolContext {
  prisma: PrismaClient;
  sessionCode: string;
}

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;

/* ─────────────────── Schemas (sent to the LLM) ─────────────────── */

export const TOOLS: ToolDef[] = [
  {
    name: "today_summary",
    description: "High-level snapshot of TODAY: total fees collected (₹), payments count, students marked present/absent, and pending fee count. No arguments — always returns today's data for the current academic session.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "fee_collection",
    description: "Total fees collected (₹ amount + receipt count + method breakdown) for a date range. Use this for queries like 'fees collected today', 'this week's collection', 'collection in October'. Dates must be YYYY-MM-DD format. If both omitted, defaults to today.",
    parameters: {
      type: "object",
      properties: {
        date_from: { type: "string", description: "Start date (inclusive) YYYY-MM-DD. Optional." },
        date_to:   { type: "string", description: "End date (inclusive) YYYY-MM-DD. Optional. If omitted, treated as same as date_from." },
      },
    },
  },
  {
    name: "student_lookup",
    description: "Find a student by SR number or name (case-insensitive partial match). Returns basic info (name, class, section, father/mother, phone) plus fee totals (charged, paid, pending). Use for queries like 'Rohit ki fees', 'show student SR 1234'.",
    parameters: {
      type: "object",
      properties: {
        sr_number: { type: "integer", description: "Exact SR number." },
        name:      { type: "string",  description: "Partial name match. Returns up to 5 best matches." },
      },
    },
  },
  {
    name: "pending_fees",
    description: "List students with pending fees, optionally scoped by class + section. Returns top 10 by pending amount (highest first). Use for queries like 'kis-kis ki fees baaki hai', 'pending fees of class 6'.",
    parameters: {
      type: "object",
      properties: {
        class:   { type: "string", description: "Class slug e.g. '6th', '10th'. Optional." },
        section: { type: "string", description: "Section code e.g. 'A'. Optional, requires class." },
        limit:   { type: "integer", description: "Max rows. Default 10, max 50." },
      },
    },
  },
  {
    name: "attendance_summary",
    description: "Attendance counts (present / absent / total) for a date, optionally scoped by class+section. Use for 'aaj attendance', 'class 10A ki attendance today'. Date format YYYY-MM-DD; defaults to today.",
    parameters: {
      type: "object",
      properties: {
        date:    { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        class:   { type: "string", description: "Class slug. Optional." },
        section: { type: "string", description: "Section code. Optional (requires class)." },
      },
    },
  },
];

/* ─────────────────── Implementations ─────────────────── */

export const HANDLERS: Record<string, ToolHandler> = {
  today_summary: async (_a, ctx) => {
    const today = isoDay(new Date());
    const [paySum, payCount, attn, pendingCount] = await Promise.all([
      ctx.prisma.fee_payments.aggregate({
        where: { session_code: ctx.sessionCode, paid_on: new Date(today), is_voided: false },
        _sum: { amount: true },
      }),
      ctx.prisma.fee_payments.count({
        where: { session_code: ctx.sessionCode, paid_on: new Date(today), is_voided: false },
      }),
      ctx.prisma.attendance.groupBy({
        by: ["status"],
        where: { session_code: ctx.sessionCode, attendance_date: new Date(today) },
        _count: { _all: true },
      }),
      pendingFeeCount(ctx),
    ]);
    const present = attn.find((a) => a.status === "present")?._count._all ?? 0;
    const absent  = attn.find((a) => a.status === "absent")?._count._all ?? 0;
    return {
      date: today,
      fees_collected_rs: paySum._sum.amount ?? 0,
      payments_count: payCount,
      attendance: { present, absent, total: present + absent },
      pending_fees_students: pendingCount,
    };
  },

  fee_collection: async (args, ctx) => {
    const from = parseDay(args.date_from) ?? isoDay(new Date());
    const to   = parseDay(args.date_to)   ?? from;
    const where = {
      session_code: ctx.sessionCode,
      paid_on: { gte: new Date(from), lte: new Date(to) },
      is_voided: false,
    };
    const [sum, count, byMethod] = await Promise.all([
      ctx.prisma.fee_payments.aggregate({ where, _sum: { amount: true } }),
      ctx.prisma.fee_payments.count({ where }),
      ctx.prisma.fee_payments.groupBy({ by: ["method"], where, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    return {
      date_from: from,
      date_to: to,
      total_rs: sum._sum.amount ?? 0,
      receipts_count: count,
      by_method: byMethod.map((m) => ({
        method: m.method, total_rs: m._sum.amount ?? 0, count: m._count._all,
      })),
    };
  },

  student_lookup: async (args, ctx) => {
    const sr = typeof args.sr_number === "number" ? args.sr_number : null;
    const name = typeof args.name === "string" ? args.name.trim() : "";
    if (!sr && !name) {
      return { error: "Provide either sr_number or name." };
    }
    const students = await ctx.prisma.student.findMany({
      where: sr
        ? { srNumber: sr }
        : { studentName: { contains: name } },
      take: 5,
      select: {
        srNumber: true, studentName: true, fatherName: true, motherName: true,
        class: true, section: true, fatherContact: true, motherContact: true,
        status: true,
        fees: {
          where: { sessionCode: ctx.sessionCode },
          select: { totalThisYear: true, paidAmount: true, dueAmount: true, paymentStatus: true },
          take: 1,
        },
      },
      orderBy: { studentName: "asc" },
    });
    if (students.length === 0) {
      return { matches: 0, hint: sr ? `No student with SR ${sr}.` : `No student name matches "${name}".` };
    }
    return {
      matches: students.length,
      students: students.map((s) => {
        const fee = s.fees[0];
        return {
          sr_number: s.srNumber,
          name: s.studentName,
          class: `${s.class}-${s.section}`,
          father: s.fatherName,
          mother: s.motherName,
          phone: s.fatherContact || s.motherContact,
          status: s.status,
          fees: fee
            ? {
                charged_rs: fee.totalThisYear,
                paid_rs: fee.paidAmount,
                pending_rs: fee.dueAmount,
                status: fee.paymentStatus,
              }
            : { note: "No fee record for current session." },
        };
      }),
    };
  },

  pending_fees: async (args, ctx) => {
    const limit = clampInt(args.limit, 10, 1, 50);
    const cls = typeof args.class === "string" ? args.class : "";
    const sec = typeof args.section === "string" ? args.section : "";
    const rows = await ctx.prisma.studentFee.findMany({
      where: {
        sessionCode: ctx.sessionCode,
        dueAmount: { gt: 0 },
        student: {
          status: "active",
          ...(cls && { class: cls }),
          ...(sec && { section: sec }),
        },
      },
      orderBy: { dueAmount: "desc" },
      take: limit,
      include: {
        student: {
          select: {
            srNumber: true, studentName: true, class: true, section: true,
            fatherContact: true, motherContact: true,
          },
        },
      },
    });
    const totalRs = rows.reduce((s, r) => s + r.dueAmount, 0);
    return {
      total_pending_students: rows.length,
      total_pending_rs: totalRs,
      students: rows.map((r) => ({
        sr_number: r.student.srNumber,
        name: r.student.studentName,
        class: `${r.student.class}-${r.student.section}`,
        phone: r.student.fatherContact || r.student.motherContact,
        charged_rs: r.totalThisYear,
        paid_rs: r.paidAmount,
        pending_rs: r.dueAmount,
        status: r.paymentStatus,
      })),
    };
  },

  attendance_summary: async (args, ctx) => {
    const day = parseDay(args.date) ?? isoDay(new Date());
    const where: {
      session_code: string;
      attendance_date: Date;
      students?: { class?: string; section?: string };
    } = {
      session_code: ctx.sessionCode,
      attendance_date: new Date(day),
    };
    const cls = typeof args.class === "string" ? args.class : "";
    const sec = typeof args.section === "string" ? args.section : "";
    if (cls || sec) {
      where.students = {};
      if (cls) where.students.class = cls;
      if (sec) where.students.section = sec;
    }
    const grouped = await ctx.prisma.attendance.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });
    const present = grouped.find((g) => g.status === "present")?._count._all ?? 0;
    const absent  = grouped.find((g) => g.status === "absent")?._count._all ?? 0;
    const late    = grouped.find((g) => g.status === "late")?._count._all ?? 0;
    const total   = present + absent + late;
    return {
      date: day,
      class: cls || "(all)",
      section: sec || "(all)",
      present, absent, late, total,
      attendance_pct: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  },
};

/* ─────────────────── Helpers ─────────────────── */

async function pendingFeeCount(ctx: ToolContext): Promise<number> {
  return ctx.prisma.studentFee.count({
    where: {
      sessionCode: ctx.sessionCode,
      dueAmount: { gt: 0 },
      student: { status: "active" },
    },
  });
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(v: unknown): string | null {
  if (typeof v !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
