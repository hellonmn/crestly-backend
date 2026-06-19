import { z } from "zod";

/**
 * Dashboard daily-review checklist audit log. Each admin/principal ticks off
 * which dashboard tiles they reviewed each day; this surfaces the history.
 */

export const ReviewDaySchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().int().nonnegative(),
  reviewed: z.array(z.object({
    key: z.string(),
    label: z.string().nullable(),
    reviewedAt: z.string(),
  })),
  pending: z.array(z.object({
    key: z.string(),
    label: z.string().nullable(),
  })),
});
export type ReviewDay = z.infer<typeof ReviewDaySchema>;

export const ReviewHistoryQuerySchema = z.object({
  window: z.coerce.number().int().min(7).max(180).default(30),
});
export type ReviewHistoryQuery = z.infer<typeof ReviewHistoryQuerySchema>;

export const ReviewHistoryResponseSchema = z.object({
  window: z.number().int(),
  avg7d: z.number(),
  avg30d: z.number(),
  fullReviewStreak: z.number().int(),
  allTimeChecks: z.number().int(),
  /** ISO date → percent complete. Driven by the most-recent review keys per day. */
  sparkline: z.array(z.object({ date: z.string(), percent: z.number() })),
  days: z.array(ReviewDaySchema),
});
export type ReviewHistoryResponse = z.infer<typeof ReviewHistoryResponseSchema>;

export const ReviewCheckSchema = z.object({
  reviewKey: z.string().min(1).max(60),
  reviewLabel: z.string().max(120).optional(),
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),     // defaults to today
  action: z.enum(["check", "uncheck"]).default("check"),
});
export type ReviewCheckInput = z.infer<typeof ReviewCheckSchema>;
