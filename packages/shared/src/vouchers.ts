import { z } from "zod";

export const VoucherStatusSchema = z.enum([
  "draft", "pending_approval", "approved", "rejected", "cancelled",
]);
export type VoucherStatus = z.infer<typeof VoucherStatusSchema>;

export const VoucherPaymentStatusSchema = z.enum(["unpaid", "paid", "partial"]);
export type VoucherPaymentStatus = z.infer<typeof VoucherPaymentStatusSchema>;

export const VoucherPaymentMethodSchema = z.enum([
  "cash", "upi", "bank_transfer", "cheque", "card", "other",
]);
export type VoucherPaymentMethod = z.infer<typeof VoucherPaymentMethodSchema>;

export const VoucherApproverDecisionSchema = z.enum(["pending", "approved", "rejected"]);
export type VoucherApproverDecision = z.infer<typeof VoucherApproverDecisionSchema>;

export const VoucherAttachmentSchema = z.object({
  id: z.number().int(),
  filePath: z.string(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  uploadedByName: z.string().nullable(),
  uploadedAt: z.string().nullable(),
});
export type VoucherAttachment = z.infer<typeof VoucherAttachmentSchema>;

export const VoucherApproverSchema = z.object({
  id: z.number().int(),
  approverUserId: z.number().int(),
  approverName: z.string(),
  status: VoucherApproverDecisionSchema,
  remarks: z.string().nullable(),
  actionAt: z.string().nullable(),
});
export type VoucherApprover = z.infer<typeof VoucherApproverSchema>;

export const VoucherSchema = z.object({
  id: z.number().int(),
  voucherNo: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  amount: z.number().int(),
  vendorName: z.string().nullable(),
  vendorContact: z.string().nullable(),
  salaryUserId: z.number().int().nullable(),
  salaryUserName: z.string().nullable(),
  salaryMonth: z.string().nullable(),
  voucherDate: z.string(),
  status: VoucherStatusSchema,
  paymentStatus: VoucherPaymentStatusSchema,
  isCreditBill: z.boolean(),
  paymentMethod: VoucherPaymentMethodSchema.nullable(),
  paymentDate: z.string().nullable(),
  paymentRef: z.string().nullable(),
  notes: z.string().nullable(),
  rejectedReason: z.string().nullable(),
  createdBy: z.number().int(),
  createdByName: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedByName: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  paidByName: z.string().nullable(),
  paidAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  approvers: z.array(VoucherApproverSchema),
  attachments: z.array(VoucherAttachmentSchema),
});
export type Voucher = z.infer<typeof VoucherSchema>;

export const VoucherListQuerySchema = z.object({
  q: z.string().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: VoucherStatusSchema.optional(),
  payment: VoucherPaymentStatusSchema.optional(),
  category: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type VoucherListQuery = z.infer<typeof VoucherListQuerySchema>;

export const VoucherListResponseSchema = z.object({
  items: z.array(VoucherSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalAmount: z.number().int(),
  paidAmount: z.number().int(),
  creditUnpaid: z.number().int(),
  pendingApproval: z.number().int(),
  /** Distinct category values for the filter dropdown. */
  categories: z.array(z.string()),
});
export type VoucherListResponse = z.infer<typeof VoucherListResponseSchema>;

export const VoucherCreateSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  amount: z.number().int().positive(),
  vendorName: z.string().max(160).nullable().optional(),
  vendorContact: z.string().max(40).nullable().optional(),
  salaryUserId: z.number().int().nullable().optional(),
  salaryMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  voucherDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isCreditBill: z.boolean().default(false),
  notes: z.string().max(500).nullable().optional(),
  approverUserIds: z.array(z.number().int()).default([]),
});
export type VoucherCreateInput = z.infer<typeof VoucherCreateSchema>;

export const VoucherApproveSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  remarks: z.string().max(255).nullable().optional(),
});
export type VoucherApproveInput = z.infer<typeof VoucherApproveSchema>;

export const VoucherMarkPaidSchema = z.object({
  paymentMethod: VoucherPaymentMethodSchema,
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentRef: z.string().max(80).nullable().optional(),
});
export type VoucherMarkPaidInput = z.infer<typeof VoucherMarkPaidSchema>;
