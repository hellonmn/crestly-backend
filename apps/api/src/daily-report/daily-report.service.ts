import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { DailyReportResponse, FeePaymentMethod } from "@crestly/shared";

/**
 * One-day cash-position report. Aggregates non-voided fee_payments and any
 * paid vouchers dated on the given day. Mirrors erp/daily-report/index.php.
 */
@Injectable()
export class DailyReportService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async report(dateStr: string): Promise<DailyReportResponse> {
    const day = new Date(dateStr);

    const receipts = await this.prisma.db.fee_payments.findMany({
      where: { paid_on: day, is_voided: false },
      include: {
        students: { select: { srNumber: true, studentName: true, class: true, section: true } },
      },
      orderBy: { id: "asc" },
    });

    const vouchers = await this.prisma.db.vouchers.findMany({
      where: { payment_date: day, payment_status: "paid" },
      orderBy: { voucher_no: "asc" },
    });

    const methods: FeePaymentMethod[] = ["cash", "upi", "bank_transfer", "cheque", "card", "other"];
    const collection = new Map<FeePaymentMethod, number>();
    for (const m of methods) collection.set(m, 0);
    for (const r of receipts) {
      collection.set(r.method, (collection.get(r.method) ?? 0) + r.amount);
    }

    const expenseByMethod = new Map<FeePaymentMethod, number>();
    for (const m of methods) expenseByMethod.set(m, 0);
    for (const v of vouchers) {
      const m = (v.payment_method ?? "other") as FeePaymentMethod;
      expenseByMethod.set(m, (expenseByMethod.get(m) ?? 0) + v.amount);
    }

    // Opening balance = sum of all paid (non-voided) up to but not including the day,
    //   minus sum of voucher payments up to but not including the day.
    const openingIn = await this.prisma.db.fee_payments.groupBy({
      by: ["method"],
      where: { paid_on: { lt: day }, is_voided: false },
      _sum: { amount: true },
    });
    const openingOut = await this.prisma.db.vouchers.groupBy({
      by: ["payment_method"],
      where: { payment_date: { lt: day }, payment_status: "paid" },
      _sum: { amount: true },
    });
    const opening = new Map<FeePaymentMethod, number>();
    for (const m of methods) opening.set(m, 0);
    for (const r of openingIn) opening.set(r.method, (opening.get(r.method) ?? 0) + (r._sum.amount ?? 0));
    for (const r of openingOut) {
      const m = (r.payment_method ?? "other") as FeePaymentMethod;
      opening.set(m, (opening.get(m) ?? 0) - (r._sum.amount ?? 0));
    }

    const cashPosition = methods.map((m) => {
      const op = opening.get(m) ?? 0;
      const col = collection.get(m) ?? 0;
      const ex = expenseByMethod.get(m) ?? 0;
      return {
        method: m,
        opening: op,
        collection: col,
        expenses: ex,
        closing: op + col - ex,
      };
    });

    const totalCollection = Array.from(collection.values()).reduce((s, v) => s + v, 0);
    const totalExpenses = Array.from(expenseByMethod.values()).reduce((s, v) => s + v, 0);

    return {
      date: dateStr,
      cashPosition,
      totalCollection,
      totalExpenses,
      netFlow: totalCollection - totalExpenses,
      receipts: receipts.map((r) => ({
        receiptNo: r.receipt_no,
        srNumber: r.students.srNumber,
        studentName: r.students.studentName,
        class: r.students.class,
        section: r.students.section,
        amount: r.amount,
        method: r.method,
        reference: r.reference,
      })),
      vouchers: vouchers.map((v) => ({
        voucherNo: v.voucher_no,
        title: v.title,
        vendor: v.vendor_name,
        amount: v.amount,
        method: v.payment_method,
        reference: v.payment_ref,
      })),
    };
  }
}
