import { z } from "zod";

export const FamilyMemberSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  status: z.string(),
  dob: z.string().nullable(),
  /** Per-row sibling discount % (0 for eldest, ~12 for 2nd, ~18 for 3rd+). */
  siblingDiscountPct: z.number().nonnegative(),
  /** Current-session payment status, if a fee row exists. */
  paymentStatus: z.string().nullable(),
  /** Outstanding due in rupees, if a fee row exists. */
  dueAmount: z.number().int().nonnegative(),
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const FamilySchema = z.object({
  familyId: z.number().int(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  siblingCount: z.number().int().nullable(),
  membersText: z.string().nullable(),
  enrolledCount: z.number().int().nonnegative(),
  /** Members whose status is "active" (subset of enrolledCount). */
  activeCount: z.number().int().nonnegative(),
  members: z.array(FamilyMemberSchema),
  /** Total tuition discount given this session across all enrolled siblings. */
  yearlyDiscountTotal: z.number().int().nonnegative(),
  /** Sum of `total_this_year` across enrolled members — the denominator for the
   *  "of ₹X total fee" line under the discount card. */
  totalYearlyFee: z.number().int().nonnegative(),
});
export type Family = z.infer<typeof FamilySchema>;

export const FamilyListItemSchema = z.object({
  familyId: z.number().int(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  siblingCount: z.number().int().nullable(),
  enrolledCount: z.number().int().nonnegative(),
  yearlyDiscountTotal: z.number().int().nonnegative(),
});
export type FamilyListItem = z.infer<typeof FamilyListItemSchema>;

export const FamilyListQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type FamilyListQuery = z.infer<typeof FamilyListQuerySchema>;

export const FamilyListResponseSchema = z.object({
  items: z.array(FamilyListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  // Aggregated KPIs for the top of the list view.
  totalFamilies: z.number().int().nonnegative(),
  totalEnrolled: z.number().int().nonnegative(),
  totalReceivingDiscount: z.number().int().nonnegative(),
  totalDiscountGiven: z.number().int().nonnegative(),
});
export type FamilyListResponse = z.infer<typeof FamilyListResponseSchema>;

export const FamilyUpsertSchema = z.object({
  familyId: z.number().int().positive().optional(),
  fatherName: z.string().max(120).nullable(),
  motherName: z.string().max(120).nullable(),
  siblingCount: z.number().int().nullable(),
  membersText: z.string().nullable(),
});
export type FamilyUpsert = z.infer<typeof FamilyUpsertSchema>;
