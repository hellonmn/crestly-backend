import { z } from "zod";

export const AttendanceStatusSchema = z.enum(["present", "absent", "late", "excused"]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

export const AttendanceRowSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  fatherName: z.string().nullable(),
  status: AttendanceStatusSchema.nullable(),    // null = not marked yet
  remarks: z.string().nullable(),
  markedAt: z.string().nullable(),
});
export type AttendanceRow = z.infer<typeof AttendanceRowSchema>;

export const AttendanceRosterQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  class: z.string().min(1),
  section: z.string().min(1),
});
export type AttendanceRosterQuery = z.infer<typeof AttendanceRosterQuerySchema>;

export const AttendanceRosterResponseSchema = z.object({
  date: z.string(),
  class: z.string(),
  section: z.string(),
  sessionCode: z.string(),
  present: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  excused: z.number().int().nonnegative(),
  notMarked: z.number().int().nonnegative(),
  rows: z.array(AttendanceRowSchema),
});
export type AttendanceRosterResponse = z.infer<typeof AttendanceRosterResponseSchema>;

export const AttendanceMarkSchema = z.object({
  srNumber: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: AttendanceStatusSchema,
  remarks: z.string().max(255).optional().nullable(),
});
export type AttendanceMark = z.infer<typeof AttendanceMarkSchema>;

export const AttendanceBulkSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  marks: z.array(z.object({
    srNumber: z.number().int().positive(),
    status: AttendanceStatusSchema,
    remarks: z.string().max(255).optional().nullable(),
  })),
});
export type AttendanceBulk = z.infer<typeof AttendanceBulkSchema>;

export const AttendanceHistoryQuerySchema = z.object({
  srNumber: z.coerce.number().int().positive(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
export type AttendanceHistoryQuery = z.infer<typeof AttendanceHistoryQuerySchema>;

export const AttendanceHistoryResponseSchema = z.object({
  srNumber: z.number().int(),
  year: z.number().int(),
  month: z.number().int(),
  marked: z.number().int().nonnegative(),
  present: z.number().int().nonnegative(),
  absent: z.number().int().nonnegative(),
  late: z.number().int().nonnegative(),
  excused: z.number().int().nonnegative(),
  /** Map of YYYY-MM-DD → status. Days with no mark are absent from the map. */
  days: z.record(z.string(), AttendanceStatusSchema),
});
export type AttendanceHistoryResponse = z.infer<typeof AttendanceHistoryResponseSchema>;
