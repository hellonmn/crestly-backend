import { z } from "zod";

export const LeaveStatusSchema = z.enum(["pending", "approved", "rejected", "cancelled"]);
export type LeaveStatus = z.infer<typeof LeaveStatusSchema>;

export const HalfDaySchema = z.enum(["none", "first_half", "second_half"]);
export type HalfDay = z.infer<typeof HalfDaySchema>;

export const LeaveTypeSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  shortCode: z.string(),
  annualQuota: z.number(),
  isPaid: z.boolean(),
  carryForward: z.boolean(),
  isSystem: z.boolean(),
  colorHex: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type LeaveType = z.infer<typeof LeaveTypeSchema>;

export const LeaveSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  userName: z.string().nullable(),
  leaveTypeId: z.number().int(),
  leaveType: z.string(),
  leaveShortCode: z.string(),
  fromDate: z.string(),
  toDate: z.string(),
  halfDay: HalfDaySchema,
  days: z.number(),
  reason: z.string().nullable(),
  attachmentPath: z.string().nullable(),
  status: LeaveStatusSchema,
  appliedAt: z.string().nullable(),
  decidedByName: z.string().nullable(),
  decidedAt: z.string().nullable(),
  decisionNote: z.string().nullable(),
});
export type Leave = z.infer<typeof LeaveSchema>;

export const LeaveBalanceSchema = z.object({
  leaveTypeId: z.number().int(),
  leaveType: z.string(),
  shortCode: z.string(),
  quota: z.number(),
  taken: z.number(),
  pending: z.number(),
  left: z.number(),
});
export type LeaveBalance = z.infer<typeof LeaveBalanceSchema>;

export const LeaveListQuerySchema = z.object({
  status: LeaveStatusSchema.optional(),
  leaveTypeId: z.coerce.number().int().optional(),
  scope: z.enum(["mine", "queue", "all"]).default("mine"),
});
export type LeaveListQuery = z.infer<typeof LeaveListQuerySchema>;

export const LeaveListResponseSchema = z.object({
  items: z.array(LeaveSchema),
  pendingCount: z.number().int(),
  balances: z.array(LeaveBalanceSchema),
});
export type LeaveListResponse = z.infer<typeof LeaveListResponseSchema>;

export const LeaveApplySchema = z.object({
  leaveTypeId: z.number().int().positive(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  halfDay: HalfDaySchema.default("none"),
  reason: z.string().max(500).nullable().optional(),
});
export type LeaveApplyInput = z.infer<typeof LeaveApplySchema>;

export const LeaveDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  decisionNote: z.string().max(500).nullable().optional(),
});
export type LeaveDecisionInput = z.infer<typeof LeaveDecisionSchema>;
