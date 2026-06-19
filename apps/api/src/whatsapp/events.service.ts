import { Injectable, Logger } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { WhatsappDispatcher } from "./dispatcher.service";

/**
 * Domain → WhatsApp event helper. Each method:
 *   1. Loads the bits of state the bound template might want
 *      (student name, parent phones, school name, …).
 *   2. Builds a unified `context` object — keys match the field
 *      catalog in WA_ACTION_CATALOG so any bound variable can
 *      resolve.
 *   3. Calls dispatcher.dispatch(...) and FORGETS the result
 *      (the dispatcher itself logs success/failure to
 *      wa_message_log).
 *
 * Business endpoints (fees, vouchers, attendance, salary) call
 * these methods AFTER their DB transaction succeeds. A Meta hiccup
 * never blocks the user-facing action.
 */
@Injectable()
export class WhatsappEvents {
  private readonly logger = new Logger(WhatsappEvents.name);

  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly dispatcher: WhatsappDispatcher,
  ) {}

  // ────────────────────────────────────────────────────────────
  // fee.payment.received
  // ────────────────────────────────────────────────────────────
  async feePaymentReceived(params: {
    srNumber: number;
    receiptNo: string;
    amount: number;
    paidOn: string;
    method: string;
    remainingDue: number;
  }): Promise<void> {
    const stu = await this.prisma.db.student.findUnique({
      where: { srNumber: params.srNumber },
      select: {
        studentName: true, class: true, section: true,
        fatherContact: true, father_whatsapp: true,
        motherContact: true, mother_whatsapp: true,
        local_guardian_contact: true,
      },
    });
    if (!stu) return;
    const schoolName = await this.lookupSchoolName();

    void this.dispatcher.dispatch("fee.payment.received", {
      student_name:  stu.studentName,
      class:         stu.class,
      section:       stu.section,
      amount:        formatRupees(params.amount),
      paid_on:       formatDate(params.paidOn),
      method:        methodLabel(params.method),
      receipt_no:    params.receiptNo,
      remaining_due: formatRupees(params.remainingDue),
      school_name:   schoolName,
      // Recipient candidates (binding picks one via recipient_field):
      father_whatsapp:        stu.father_whatsapp ?? stu.fatherContact ?? "",
      mother_whatsapp:        stu.mother_whatsapp ?? stu.motherContact ?? "",
      father_contact:         stu.fatherContact ?? "",
      mother_contact:         stu.motherContact ?? "",
      local_guardian_contact: stu.local_guardian_contact ?? "",
    }).catch((e) => this.logger.warn(`feePaymentReceived dispatch error: ${(e as Error).message}`));
  }

  // ────────────────────────────────────────────────────────────
  // fee.reminder — manual nudge
  // ────────────────────────────────────────────────────────────
  async feeReminder(params: {
    srNumber: number;
    dueAmount: number;
    sessionCode: string;
  }): Promise<void> {
    const stu = await this.prisma.db.student.findUnique({
      where: { srNumber: params.srNumber },
      select: {
        studentName: true, class: true, section: true,
        fatherContact: true, father_whatsapp: true,
        motherContact: true, mother_whatsapp: true,
        local_guardian_contact: true,
      },
    });
    if (!stu) return;
    const schoolName = await this.lookupSchoolName();

    void this.dispatcher.dispatch("fee.reminder", {
      student_name: stu.studentName,
      class:        stu.class,
      section:      stu.section,
      due_amount:   formatRupees(params.dueAmount),
      session_code: params.sessionCode,
      school_name:  schoolName,
      father_whatsapp:        stu.father_whatsapp ?? stu.fatherContact ?? "",
      mother_whatsapp:        stu.mother_whatsapp ?? stu.motherContact ?? "",
      father_contact:         stu.fatherContact ?? "",
      mother_contact:         stu.motherContact ?? "",
      local_guardian_contact: stu.local_guardian_contact ?? "",
    }).catch((e) => this.logger.warn(`feeReminder dispatch error: ${(e as Error).message}`));
  }

  // ────────────────────────────────────────────────────────────
  // voucher.pending_approval — fan out one send per approver
  // ────────────────────────────────────────────────────────────
  async voucherPendingApproval(voucherId: number): Promise<void> {
    const v = await this.prisma.db.vouchers.findUnique({
      where: { id: voucherId },
      include: {
        voucher_approvers: {
          include: { users: { select: { id: true, name: true, phone: true, whatsapp: true } } },
        },
        users_vouchers_created_byTousers: { select: { name: true } },
      },
    });
    if (!v) return;
    const schoolName = await this.lookupSchoolName();

    for (const a of v.voucher_approvers) {
      if (a.status !== "pending") continue;
      const phone = a.users?.whatsapp ?? a.users?.phone ?? "";
      if (!phone) continue;
      void this.dispatcher.dispatch("voucher.pending_approval", {
        voucher_no:     v.voucher_no,
        title:          v.title,
        amount:         formatRupees(v.amount),
        created_by:     v.users_vouchers_created_byTousers?.name ?? "—",
        school_name:    schoolName,
        approver_phone: phone,
      }).catch((e) => this.logger.warn(`voucher.pending_approval dispatch error: ${(e as Error).message}`));
    }
  }

  // ────────────────────────────────────────────────────────────
  // voucher.paid
  // ────────────────────────────────────────────────────────────
  async voucherPaid(voucherId: number): Promise<void> {
    const v = await this.prisma.db.vouchers.findUnique({
      where: { id: voucherId },
      include: {
        users_vouchers_created_byTousers: { select: { phone: true, whatsapp: true } },
        users_vouchers_salary_user_idTousers: { select: { phone: true, whatsapp: true } },
      },
    });
    if (!v) return;
    const schoolName = await this.lookupSchoolName();

    // Recipient candidates — salary recipient first (if voucher pays a salary),
    // otherwise the voucher creator.
    const recipientPhone =
      v.users_vouchers_salary_user_idTousers?.whatsapp ??
      v.users_vouchers_salary_user_idTousers?.phone ??
      v.users_vouchers_created_byTousers?.whatsapp ??
      v.users_vouchers_created_byTousers?.phone ??
      "";

    void this.dispatcher.dispatch("voucher.paid", {
      voucher_no:      v.voucher_no,
      title:           v.title,
      amount:          formatRupees(v.amount),
      paid_on:         v.payment_date ? formatDate(v.payment_date.toISOString()) : "",
      method:          v.payment_method ?? "",
      school_name:     schoolName,
      recipient_phone: recipientPhone,
    }).catch((e) => this.logger.warn(`voucher.paid dispatch error: ${(e as Error).message}`));
  }

  // ────────────────────────────────────────────────────────────
  // student.absent
  // ────────────────────────────────────────────────────────────
  async studentAbsent(params: {
    srNumber: number;
    date: string;
  }): Promise<void> {
    const stu = await this.prisma.db.student.findUnique({
      where: { srNumber: params.srNumber },
      select: {
        studentName: true, class: true, section: true,
        fatherContact: true, father_whatsapp: true,
        motherContact: true, mother_whatsapp: true,
      },
    });
    if (!stu) return;
    const schoolName = await this.lookupSchoolName();

    void this.dispatcher.dispatch("student.absent", {
      student_name: stu.studentName,
      class:        stu.class,
      section:      stu.section,
      date:         formatDate(params.date),
      school_name:  schoolName,
      father_whatsapp: stu.father_whatsapp ?? stu.fatherContact ?? "",
      mother_whatsapp: stu.mother_whatsapp ?? stu.motherContact ?? "",
      father_contact:  stu.fatherContact ?? "",
      mother_contact:  stu.motherContact ?? "",
    }).catch((e) => this.logger.warn(`student.absent dispatch error: ${(e as Error).message}`));
  }

  // ────────────────────────────────────────────────────────────
  // salary.paid
  // ────────────────────────────────────────────────────────────
  async salaryPaid(params: {
    userId: number;
    amount: number;
    month: string;       // "May 2026"
  }): Promise<void> {
    const u = await this.prisma.db.user.findUnique({
      where: { id: params.userId },
      select: { name: true, phone: true, whatsapp: true },
    });
    if (!u) return;
    const schoolName = await this.lookupSchoolName();

    void this.dispatcher.dispatch("salary.paid", {
      staff_name:  u.name,
      amount:      formatRupees(params.amount),
      month:       params.month,
      school_name: schoolName,
      staff_phone: u.whatsapp ?? u.phone ?? "",
    }).catch((e) => this.logger.warn(`salary.paid dispatch error: ${(e as Error).message}`));
  }

  // ────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────

  /** Cached per-request school name lookup (the request-scoped Prisma
   *  already de-dupes the row read; this is just a thin wrapper). */
  private async lookupSchoolName(): Promise<string> {
    const row = await this.prisma.db.schoolInfo.findUnique({
      where: { k: "School Name" },
    }).catch(() => null);
    return row?.v ?? "School";
  }
}

function formatRupees(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
function formatDate(iso: string): string {
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(d);
}
function methodLabel(m: string): string {
  switch (m) {
    case "cash":          return "Cash";
    case "upi":           return "UPI";
    case "bank_transfer": return "Bank transfer";
    case "cheque":        return "Cheque";
    case "card":          return "Card";
    default:              return m;
  }
}
