import { z } from "zod";

export const FeePaymentStatusSchema = z.enum(["paid", "partial", "pending", "overdue"]);
export type FeePaymentStatus = z.infer<typeof FeePaymentStatusSchema>;

export const FeePaymentMethodSchema = z.enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"]);
export type FeePaymentMethod = z.infer<typeof FeePaymentMethodSchema>;

/** A single row of the fee-ledger list page. */
export const FeeLedgerRowSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  fatherName: z.string().nullable(),
  totalThisYear: z.number().int(),
  paidAmount: z.number().int(),
  dueAmount: z.number().int(),
  paymentStatus: FeePaymentStatusSchema,
  siblingDiscountPct: z.number(),
  familyId: z.number().int().nullable(),
});
export type FeeLedgerRow = z.infer<typeof FeeLedgerRowSchema>;

/**
 * Status filter accepts an extra "with_balance" pseudo-state that matches
 * any student whose `due_amount > 0` regardless of payment_status — mirrors
 * the PHP filter dropdown.
 */
export const FeeLedgerStatusFilterSchema = z.enum([
  "paid", "partial", "pending", "overdue", "with_balance",
]);
export type FeeLedgerStatusFilter = z.infer<typeof FeeLedgerStatusFilterSchema>;

export const FeeLedgerSortSchema = z.enum([
  "due_desc", "due_asc", "name_asc", "class_asc", "paid_desc",
]);
export type FeeLedgerSort = z.infer<typeof FeeLedgerSortSchema>;

export const FeeLedgerQuerySchema = z.object({
  q: z.string().optional(),
  class: z.string().optional(),
  section: z.string().optional(),
  status: FeeLedgerStatusFilterSchema.optional(),
  sessionCode: z.string().optional(),       // defaults to current
  sort: FeeLedgerSortSchema.default("class_asc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});
export type FeeLedgerQuery = z.infer<typeof FeeLedgerQuerySchema>;

export const FeeLedgerResponseSchema = z.object({
  items: z.array(FeeLedgerRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  sessionCode: z.string(),
  // KPIs across the filter set
  collected: z.number().int(),
  outstanding: z.number().int(),
  overdueCount: z.number().int(),
  fullyPaidCount: z.number().int(),
  withBalanceCount: z.number().int(),
  sessionTotal: z.number().int(),
  sessionPaid: z.number().int(),
  sessionDue: z.number().int(),
  // Distinct values for filter selects (driven by students, not student_fees,
  // so empty classes still show up).
  classes: z.array(z.string()),
  sections: z.array(z.string()),
});
export type FeeLedgerResponse = z.infer<typeof FeeLedgerResponseSchema>;

/** Per-student fee detail returned by GET /api/fees/:sr. */
export const StudentFeeDetailSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  sessionCode: z.string(),
  admissionStatus: z.enum(["Continuing", "New"]),
  // Breakdown
  tuitionOriginal: z.number().int(),
  tuitionDiscount: z.number().int(),
  tuitionPayable: z.number().int(),
  annualCharges: z.number().int(),
  activityFee: z.number().int(),
  examFee: z.number().int(),
  transportFee: z.number().int(),
  transportSlab: z.string().nullable(),
  // Hostel (may be 0 for day scholars)
  hostelLodging: z.number().int(),
  hostelMess: z.number().int(),
  hostelCommon: z.number().int(),
  hostelOneTime: z.number().int(),
  // One-time joining
  registrationFee: z.number().int(),
  admissionFee: z.number().int(),
  cautionMoney: z.number().int(),
  firstYearExtras: z.number().int(),
  // Totals
  yearlyRecurringTotal: z.number().int(),
  totalThisYear: z.number().int(),
  paidAmount: z.number().int(),
  dueAmount: z.number().int(),
  paymentStatus: FeePaymentStatusSchema,
  quarterlyInstallment: z.number().int(),
  monthlyEmi: z.number().int(),
  siblingDiscountPct: z.number(),
  payments: z.array(z.object({
    id: z.number().int(),
    receiptNo: z.string(),
    amount: z.number().int(),
    paidOn: z.string(),
    method: FeePaymentMethodSchema,
    reference: z.string().nullable(),
    notes: z.string().nullable(),
    recordedBy: z.string().nullable(),
    isVoided: z.boolean(),
    voidedAt: z.string().nullable(),
    voidedReason: z.string().nullable(),
    createdAt: z.string(),
  })),
});
export type StudentFeeDetail = z.infer<typeof StudentFeeDetailSchema>;

export const RecordPaymentSchema = z.object({
  amount: z.number().int().positive(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: FeePaymentMethodSchema.default("cash"),
  reference: z.string().max(64).nullable().optional(),
  notes: z.string().max(255).nullable().optional(),
});
export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

/* ------------------------------------------------------------------ */
/* All receipts list — drives /fee-ledger/receipts                     */
/* ------------------------------------------------------------------ */

export const ReceiptListQuerySchema = z.object({
  q: z.string().optional(),
  sessionCode: z.string().optional(),    // defaults to current
  method: FeePaymentMethodSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  showVoided: z.coerce.boolean().default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
});
export type ReceiptListQuery = z.infer<typeof ReceiptListQuerySchema>;

export const ReceiptRowSchema = z.object({
  id: z.number().int(),
  receiptNo: z.string(),
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  isHostel: z.boolean(),
  amount: z.number().int(),
  paidOn: z.string(),
  method: FeePaymentMethodSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  recordedBy: z.string().nullable(),
  isVoided: z.boolean(),
  voidedAt: z.string().nullable(),
});
export type ReceiptRow = z.infer<typeof ReceiptRowSchema>;

export const ReceiptListResponseSchema = z.object({
  items: z.array(ReceiptRowSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  sessionCode: z.string(),
  /** Sum of `amount` across the filter set (not just the current page). */
  totalAmount: z.number().int(),
  /** Today's totals for the same session (separate from the filter set). */
  todayCount: z.number().int(),
  todayAmount: z.number().int(),
  /** Distinct sessions that have any payments — for the dropdown. */
  sessions: z.array(z.string()),
});
export type ReceiptListResponse = z.infer<typeof ReceiptListResponseSchema>;

/* ------------------------------------------------------------------ */
/* Receipt print payload — drives the A5 landscape two-up print page  */
/* ------------------------------------------------------------------ */

export const ReceiptPrintSchema = z.object({
  id: z.number().int(),
  receiptNo: z.string(),
  sessionCode: z.string(),
  amount: z.number().int(),
  paidOn: z.string(),
  method: FeePaymentMethodSchema,
  reference: z.string().nullable(),
  notes: z.string().nullable(),
  recordedBy: z.string().nullable(),
  isVoided: z.boolean(),
  voidedReason: z.string().nullable(),
  createdAt: z.string(),
  // Student
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  isHostel: z.boolean(),
  // Running totals (from student_fees row for the same session)
  totalThisYear: z.number().int(),
  totalPaid: z.number().int(),
  totalDue: z.number().int(),
  // School identity (from school_info)
  schoolName: z.string(),
  schoolAddress: z.string().nullable(),
  schoolBoard: z.string().nullable(),
});
export type ReceiptPrint = z.infer<typeof ReceiptPrintSchema>;

// --- Fee structure ---

export const FeeStructureRowSchema = z.object({
  class: z.string(),
  tuitionYearly: z.number().int(),
  annualCharges: z.number().int(),
  activityFee: z.number().int(),
  examFee: z.number().int(),
  recurringTotal: z.number().int(),
  registrationFee: z.number().int(),
  admissionFee: z.number().int(),
  cautionMoney: z.number().int(),
  oneTimeTotal: z.number().int(),
  studentCount: z.number().int().nonnegative(),
});
export type FeeStructureRow = z.infer<typeof FeeStructureRowSchema>;

export const FeeStructureUpsertSchema = z.object({
  class: z.string().min(1).max(16),
  tuitionYearly: z.number().int().nonnegative(),
  annualCharges: z.number().int().nonnegative(),
  activityFee: z.number().int().nonnegative(),
  examFee: z.number().int().nonnegative(),
  registrationFee: z.number().int().nonnegative(),
  admissionFee: z.number().int().nonnegative(),
  cautionMoney: z.number().int().nonnegative(),
});
export type FeeStructureUpsert = z.infer<typeof FeeStructureUpsertSchema>;

export const TransportSlabRowSchema = z.object({
  slab: z.string(),
  distanceRange: z.string(),
  minKm: z.number(),
  maxKm: z.number(),
  yearlyFee: z.number().int(),
  quarterlyFee: z.number().int(),
  monthlyFee: z.number().int(),
});
export type TransportSlabRow = z.infer<typeof TransportSlabRowSchema>;
