import { z } from "zod";

export const HolidayTypeSchema = z.enum(["public", "school", "optional", "weekend"]);
export type HolidayType = z.infer<typeof HolidayTypeSchema>;

export const HolidaySchema = z.object({
  id: z.number().int(),
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
  type: HolidayTypeSchema,
  isPaid: z.boolean(),
  notes: z.string().nullable(),
  createdBy: z.number().int().nullable(),
  createdAt: z.string().nullable(),
});
export type Holiday = z.infer<typeof HolidaySchema>;

export const HolidayUpsertSchema = z.object({
  holidayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
  type: HolidayTypeSchema.default("public"),
  isPaid: z.boolean().default(true),
  notes: z.string().max(255).nullable().optional(),
});
export type HolidayUpsert = z.infer<typeof HolidayUpsertSchema>;

/** Academic year — first 4 digits e.g. 2025 means AY 2025-26 (Apr→Mar). */
export const HolidayCalendarQuerySchema = z.object({
  academicYear: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type HolidayCalendarQuery = z.infer<typeof HolidayCalendarQuerySchema>;

export const HolidayCalendarResponseSchema = z.object({
  academicYear: z.number().int(),       // 2025 → covers 2025-04-01 to 2026-03-31
  totalHolidays: z.number().int().nonnegative(),
  upcomingIn60Days: z.number().int().nonnegative(),
  sundayCount: z.number().int().nonnegative(),
  workingDays: z.number().int().nonnegative(),
  items: z.array(HolidaySchema),
});
export type HolidayCalendarResponse = z.infer<typeof HolidayCalendarResponseSchema>;
