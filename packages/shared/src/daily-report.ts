import { z } from "zod";
import { FeePaymentMethodSchema } from "./fees";

export const DailyReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type DailyReportQuery = z.infer<typeof DailyReportQuerySchema>;

const ReceiptRowSchema = z.object({
  receiptNo: z.string(),
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  amount: z.number().int(),
  method: FeePaymentMethodSchema,
  reference: z.string().nullable(),
});

const VoucherRowSchema = z.object({
  voucherNo: z.string(),
  title: z.string(),
  vendor: z.string().nullable(),
  amount: z.number().int(),
  method: z.string().nullable(),
  reference: z.string().nullable(),
});

const CashRowSchema = z.object({
  method: FeePaymentMethodSchema,
  opening: z.number().int(),
  collection: z.number().int(),
  expenses: z.number().int(),
  closing: z.number().int(),
});

export const DailyReportResponseSchema = z.object({
  date: z.string(),
  cashPosition: z.array(CashRowSchema),
  totalCollection: z.number().int(),
  totalExpenses: z.number().int(),
  netFlow: z.number().int(),
  receipts: z.array(ReceiptRowSchema),
  vouchers: z.array(VoucherRowSchema),
});
export type DailyReportResponse = z.infer<typeof DailyReportResponseSchema>;
