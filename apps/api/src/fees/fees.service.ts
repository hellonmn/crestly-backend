import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { WhatsappEvents } from "../whatsapp/events.service";
import type {
  FeeLedgerQuery,
  FeeLedgerResponse,
  FeePaymentMethod,
  ReceiptListQuery,
  ReceiptListResponse,
  ReceiptPrint,
  RecordPaymentInput,
  StudentFeeDetail,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class FeesService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
    private readonly wa: WhatsappEvents,
  ) {}

  async list(query: FeeLedgerQuery): Promise<FeeLedgerResponse> {
    const sessionCode = query.sessionCode ?? (await this.sessions.current()).code;

    // `with_balance` is a pseudo-status filter — any student with dueAmount > 0.
    const statusFilter: Prisma.StudentFeeWhereInput = (() => {
      if (!query.status) return {};
      if (query.status === "with_balance") return { dueAmount: { gt: 0 } };
      return { paymentStatus: query.status };
    })();

    const where: Prisma.StudentFeeWhereInput = {
      sessionCode,
      ...statusFilter,
      ...((query.class || query.section || query.q) && {
        student: {
          ...(query.class && { class: query.class }),
          ...(query.section && { section: query.section }),
          ...(query.q && {
            OR: [
              { studentName: { contains: query.q } },
              { fatherName: { contains: query.q } },
              ...(/^\d+$/.test(query.q.trim())
                ? [{ srNumber: Number(query.q.trim()) } as Prisma.StudentWhereInput]
                : []),
            ],
          }),
        },
      }),
    };

    const orderBy: Prisma.StudentFeeOrderByWithRelationInput = (() => {
      switch (query.sort) {
        case "due_asc":   return { dueAmount: "asc" };
        case "due_desc":  return { dueAmount: "desc" };
        case "paid_desc": return { paidAmount: "desc" };
        case "name_asc":  return { student: { studentName: "asc" } };
        case "class_asc":
        default:          return { student: { class: "asc" } };
      }
    })();

    const [total, rows, summary, overdueCount, fullyPaidCount, withBalanceCount,
           classesRaw, sectionsRaw] = await Promise.all([
      this.prisma.db.studentFee.count({ where }),
      this.prisma.db.studentFee.findMany({
        where,
        include: {
          student: {
            select: {
              srNumber: true, studentName: true, class: true, section: true,
              fatherName: true, familyId: true,
            },
          },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      // Aggregates over the FULL filter set, not just current page.
      this.prisma.db.studentFee.aggregate({
        where,
        _sum: { paidAmount: true, dueAmount: true, totalThisYear: true },
        _count: { _all: true },
      }),
      this.prisma.db.studentFee.count({ where: { ...where, paymentStatus: "overdue" } }),
      this.prisma.db.studentFee.count({ where: { ...where, paymentStatus: "paid" } }),
      this.prisma.db.studentFee.count({ where: { ...where, dueAmount: { gt: 0 } } }),
      this.prisma.db.student.findMany({
        distinct: ["class"], select: { class: true }, orderBy: { class: "asc" },
      }),
      this.prisma.db.student.findMany({
        distinct: ["section"], select: { section: true }, orderBy: { section: "asc" },
      }),
    ]);

    return {
      items: rows.map((r) => ({
        srNumber: r.student.srNumber,
        studentName: r.student.studentName,
        class: r.student.class,
        section: r.student.section,
        fatherName: r.student.fatherName,
        totalThisYear: r.totalThisYear,
        paidAmount: r.paidAmount,
        dueAmount: r.dueAmount,
        paymentStatus: r.paymentStatus,
        siblingDiscountPct: Number(r.siblingDiscountPct),
        familyId: r.student.familyId,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      sessionCode,
      collected: summary._sum.paidAmount ?? 0,
      outstanding: summary._sum.dueAmount ?? 0,
      overdueCount,
      fullyPaidCount,
      withBalanceCount,
      sessionTotal: summary._sum.totalThisYear ?? 0,
      sessionPaid: summary._sum.paidAmount ?? 0,
      sessionDue: summary._sum.dueAmount ?? 0,
      classes: classesRaw.map((c) => c.class),
      sections: sectionsRaw.map((s) => s.section),
    };
  }

  /**
   * Flat list of every fee_payment row — mirrors erp/fee-ledger/payments.php.
   * Voided rows are hidden by default; pass `showVoided=true` to include
   * them in the result so the audit trail is reachable.
   */
  async receipts(query: ReceiptListQuery): Promise<ReceiptListResponse> {
    const sessionCode = query.sessionCode ?? (await this.sessions.current()).code;

    const where: Prisma.fee_paymentsWhereInput = {
      session_code: sessionCode,
      ...(query.method && { method: query.method }),
      ...(query.from && { paid_on: { gte: new Date(query.from) } }),
      ...(query.to && {
        paid_on: { ...(query.from ? { gte: new Date(query.from) } : {}), lte: new Date(query.to) },
      }),
      ...(query.showVoided ? {} : { is_voided: false }),
      ...(query.q && {
        OR: [
          { receipt_no: { contains: query.q } },
          { students: { studentName: { contains: query.q } } },
          ...(/^\d+$/.test(query.q.trim())
            ? [{ sr_number: Number(query.q.trim()) } as Prisma.fee_paymentsWhereInput]
            : []),
        ],
      }),
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today.getTime() + 86400000 - 1);

    const [total, rows, agg, todayAgg, sessionsRaw] = await Promise.all([
      this.prisma.db.fee_payments.count({ where }),
      this.prisma.db.fee_payments.findMany({
        where,
        include: {
          students: { select: { studentName: true, class: true, section: true, is_hostel: true } },
        },
        orderBy: [{ paid_on: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.fee_payments.aggregate({ where, _sum: { amount: true } }),
      this.prisma.db.fee_payments.aggregate({
        where: { session_code: sessionCode, is_voided: false, paid_on: { gte: today, lte: todayEnd } },
        _sum: { amount: true }, _count: { _all: true },
      }),
      this.prisma.db.fee_payments.findMany({
        distinct: ["session_code"], select: { session_code: true }, orderBy: { session_code: "desc" },
      }),
    ]);

    const sessions = sessionsRaw.map((s) => s.session_code);
    if (!sessions.includes(sessionCode)) sessions.unshift(sessionCode);

    return {
      items: rows.map((r) => ({
        id: r.id,
        receiptNo: r.receipt_no,
        srNumber: r.sr_number,
        studentName: r.students.studentName,
        class: r.students.class,
        section: r.students.section,
        isHostel: r.students.is_hostel,
        amount: r.amount,
        paidOn: r.paid_on.toISOString().slice(0, 10),
        method: r.method,
        reference: r.reference,
        notes: r.notes,
        recordedBy: r.recorded_by,
        isVoided: r.is_voided,
        voidedAt: r.voided_at ? r.voided_at.toISOString() : null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      sessionCode,
      totalAmount: agg._sum?.amount ?? 0,
      todayCount: todayAgg._count?._all ?? 0,
      todayAmount: todayAgg._sum?.amount ?? 0,
      sessions,
    };
  }

  /**
   * Single receipt payload for the A5 print page. Joins payment + student
   * + the matching student_fees row for running totals, plus school_info
   * for the header (name/address/board).
   */
  async receiptDetail(paymentId: number): Promise<ReceiptPrint> {
    const p = await this.prisma.db.fee_payments.findUnique({
      where: { id: paymentId },
      include: {
        students: {
          select: {
            srNumber: true, studentName: true, class: true, section: true,
            fatherName: true, motherName: true, is_hostel: true,
          },
        },
      },
    });
    if (!p) throw new NotFoundException(`Receipt #${paymentId} not found`);

    const [fee, schoolInfoRows] = await Promise.all([
      this.prisma.db.studentFee.findUnique({
        where: { srNumber_sessionCode: { srNumber: p.sr_number, sessionCode: p.session_code } },
        select: { totalThisYear: true, paidAmount: true, dueAmount: true },
      }),
      this.prisma.db.schoolInfo.findMany().catch(() => []),
    ]);

    const info = new Map(schoolInfoRows.map((r) => [r.k, r.v ?? null]));

    return {
      id: p.id,
      receiptNo: p.receipt_no,
      sessionCode: p.session_code,
      amount: p.amount,
      paidOn: p.paid_on.toISOString().slice(0, 10),
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      recordedBy: p.recorded_by,
      isVoided: p.is_voided,
      voidedReason: p.voided_reason,
      createdAt: p.created_at ? p.created_at.toISOString() : new Date(0).toISOString(),
      srNumber: p.sr_number,
      studentName: p.students.studentName,
      class: p.students.class,
      section: p.students.section,
      fatherName: p.students.fatherName,
      motherName: p.students.motherName,
      isHostel: p.students.is_hostel,
      totalThisYear: fee?.totalThisYear ?? 0,
      totalPaid:     fee?.paidAmount    ?? 0,
      totalDue:      fee?.dueAmount     ?? 0,
      schoolName:    info.get("School Name") ?? "School",
      schoolAddress: info.get("Address") ?? null,
      schoolBoard:   info.get("Board") ?? null,
    };
  }

  async studentDetail(srNumber: number, sessionCode?: string): Promise<StudentFeeDetail> {
    const code = sessionCode ?? (await this.sessions.current()).code;
    const fee = await this.prisma.db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber, sessionCode: code } },
      include: {
        student: { select: { studentName: true, class: true, section: true } },
      },
    });
    if (!fee) throw new NotFoundException(`No fee allotment for student #${srNumber} in session ${code}`);

    const payments = await this.prisma.db.fee_payments.findMany({
      where: { sr_number: srNumber, session_code: code },
      orderBy: { paid_on: "desc" },
    });

    return {
      srNumber,
      studentName: fee.student.studentName,
      class: fee.student.class,
      section: fee.student.section,
      sessionCode: code,
      admissionStatus: fee.admissionStatus,
      tuitionOriginal: fee.tuitionOriginal,
      tuitionDiscount: fee.tuitionDiscount,
      tuitionPayable: fee.tuitionPayable,
      annualCharges: fee.annualCharges,
      activityFee: fee.activityFee,
      examFee: fee.examFee,
      transportFee: fee.transportFee,
      transportSlab: fee.transportSlab,
      hostelLodging: 0,                   // hostel fields require hostel migration to be present
      hostelMess: 0,
      hostelCommon: 0,
      hostelOneTime: 0,
      registrationFee: fee.registrationFee,
      admissionFee: fee.admissionFee,
      cautionMoney: fee.cautionMoney,
      firstYearExtras: fee.firstYearExtras,
      yearlyRecurringTotal: fee.yearlyRecurringTotal,
      totalThisYear: fee.totalThisYear,
      paidAmount: fee.paidAmount,
      dueAmount: fee.dueAmount,
      paymentStatus: fee.paymentStatus,
      quarterlyInstallment: fee.quarterlyInstallment,
      monthlyEmi: fee.monthlyEmi,
      siblingDiscountPct: Number(fee.siblingDiscountPct),
      payments: payments.map((p) => ({
        id: p.id,
        receiptNo: p.receipt_no,
        amount: p.amount,
        paidOn: p.paid_on.toISOString().slice(0, 10),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        recordedBy: p.recorded_by,
        isVoided: p.is_voided,
        voidedAt: p.voided_at ? p.voided_at.toISOString() : null,
        voidedReason: p.voided_reason,
        createdAt: p.created_at ? p.created_at.toISOString() : new Date(0).toISOString(),
      })),
    };
  }

  async recordPayment(srNumber: number, input: RecordPaymentInput, user: CurrentUser) {
    const session = await this.sessions.current();
    const fee = await this.prisma.db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber, sessionCode: session.code } },
    });
    if (!fee) throw new NotFoundException(`No fee allotment for student #${srNumber}`);
    if (input.amount > fee.dueAmount) {
      throw new BadRequestException(
        `Amount ₹${input.amount} is more than the outstanding ₹${fee.dueAmount}`,
      );
    }

    const receiptNo = await this.nextReceiptNo();
    await this.prisma.db.$transaction([
      this.prisma.db.fee_payments.create({
        data: {
          sr_number: srNumber,
          session_code: session.code,
          receipt_no: receiptNo,
          amount: input.amount,
          paid_on: new Date(input.paidOn),
          method: input.method,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          recorded_by: user.name,
        },
      }),
      this.prisma.db.studentFee.update({
        where: { srNumber_sessionCode: { srNumber, sessionCode: session.code } },
        data: {
          paidAmount: { increment: input.amount },
          dueAmount: { decrement: input.amount },
          paymentStatus:
            fee.dueAmount - input.amount === 0
              ? "paid"
              : fee.paidAmount + input.amount > 0
                ? "partial"
                : "pending",
        },
      }),
    ]);

    // Fire-and-forget WhatsApp receipt to the parent. Never blocks the
    // user-facing action — dispatcher silently logs success/failure.
    void this.wa.feePaymentReceived({
      srNumber,
      receiptNo,
      amount: input.amount,
      paidOn: input.paidOn,
      method: input.method,
      remainingDue: fee.dueAmount - input.amount,
    });

    return this.studentDetail(srNumber, session.code);
  }

  /** Manual "send fee reminder" trigger from the student profile / fee
   *  ledger. Looks up the current outstanding and fires the
   *  fee.reminder template. */
  async sendFeeReminder(srNumber: number): Promise<{ ok: true; due: number }> {
    const session = await this.sessions.current();
    const fee = await this.prisma.db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber, sessionCode: session.code } },
    });
    if (!fee) throw new NotFoundException(`No fee allotment for student #${srNumber}`);
    if (fee.dueAmount <= 0) {
      throw new BadRequestException("This student has no outstanding balance.");
    }
    void this.wa.feeReminder({
      srNumber,
      dueAmount: fee.dueAmount,
      sessionCode: session.code,
    });
    return { ok: true, due: fee.dueAmount };
  }

  async voidPayment(paymentId: number, reason: string | null, user: CurrentUser) {
    const payment = await this.prisma.db.fee_payments.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException(`Payment #${paymentId} not found`);
    if (payment.is_voided) throw new BadRequestException("Already voided");

    await this.prisma.db.$transaction([
      this.prisma.db.fee_payments.update({
        where: { id: paymentId },
        data: {
          is_voided: true,
          voided_at: new Date(),
          voided_reason: reason ?? `Voided by ${user.name}`,
        },
      }),
      this.prisma.db.studentFee.update({
        where: {
          srNumber_sessionCode: { srNumber: payment.sr_number, sessionCode: payment.session_code },
        },
        data: {
          paidAmount: { decrement: payment.amount },
          dueAmount: { increment: payment.amount },
          // Status recomputed by a follow-up service call; the simple update above
          // keeps things consistent without recomputing the state machine.
        },
      }),
    ]);

    return this.studentDetail(payment.sr_number, payment.session_code);
  }

  private async nextReceiptNo(): Promise<string> {
    const session = await this.sessions.current();
    const yr = session.code.replace("-", "");
    const last = await this.prisma.db.fee_payments.findFirst({
      where: { session_code: session.code, receipt_no: { startsWith: `R${yr}/` } },
      orderBy: { id: "desc" },
      select: { receipt_no: true },
    });
    const nextN = last
      ? Number(last.receipt_no.split("/").pop() ?? "0") + 1
      : 1;
    return `R${yr}/${String(nextN).padStart(5, "0")}`;
  }
}

// Re-export to make sure ts-node / tsc finds the type symbol.
export type _Method = FeePaymentMethod;
