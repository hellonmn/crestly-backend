import { z } from "zod";

export const ShiftRowSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  roleId: z.number().int().nullable(),
  roleName: z.string().nullable(),
  roleSlug: z.string().nullable(),
  monthlySalary: z.number().int().nullable(),
  dutyStart: z.string().nullable(),       // HH:MM:SS
  dutyEnd: z.string().nullable(),
  effectiveFrom: z.string().nullable(),
  scheduleId: z.number().int().nullable(),
});
export type ShiftRow = z.infer<typeof ShiftRowSchema>;

export const ShiftListQuerySchema = z.object({
  q: z.string().optional(),
  roleSlug: z.string().optional(),
  department: z.string().optional(),
});
export type ShiftListQuery = z.infer<typeof ShiftListQuerySchema>;

export const ShiftListResponseSchema = z.object({
  rows: z.array(ShiftRowSchema),
  withSchedule: z.number().int(),
  withoutSchedule: z.number().int(),
  total: z.number().int(),
  /** Distinct roles for the role filter dropdown. */
  roles: z.array(z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
  })),
  /** Distinct departments for the department dropdown. */
  departments: z.array(z.string()),
});
export type ShiftListResponse = z.infer<typeof ShiftListResponseSchema>;

export const ShiftUpsertSchema = z.object({
  userId: z.number().int().positive(),
  dutyStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  dutyEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(160).nullable().optional(),
});
export type ShiftUpsertInput = z.infer<typeof ShiftUpsertSchema>;

export const SalaryBulkUpdateSchema = z.object({
  userIds: z.array(z.number().int()).min(1),
  monthlySalary: z.number().int().nonnegative(),
});
export type SalaryBulkUpdate = z.infer<typeof SalaryBulkUpdateSchema>;

export const HoursBulkUpdateSchema = z.object({
  userIds: z.array(z.number().int()).min(1),
  dutyStart: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  dutyEnd: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type HoursBulkUpdate = z.infer<typeof HoursBulkUpdateSchema>;
