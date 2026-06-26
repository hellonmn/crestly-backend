import { z } from "zod";

/* ============================================================
   School calendar.

   A NEW `calendar_events` table holds general school events
   (PTM, functions, activities, fee-due reminders, notices …).
   The read API (`/calendar/feed`) MERGES those rows with the
   existing `holidays` and `exam_datesheet` data so the client
   gets one unified day-by-day feed — no need to overlay three
   separate calls.

   Only `event` rows are editable; holiday + exam items are
   read-only mirrors managed by their own modules.
   ============================================================ */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM" 24h

/** Coerce a query-string flag into a real boolean ("false"/"0" → false). */
const QueryBool = z
  .union([z.boolean(), z.enum(["true", "false", "0", "1"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const CalendarCategorySchema = z.enum([
  "event",
  "ptm", // parent–teacher meeting
  "function",
  "activity",
  "sports",
  "exam",
  "fee",
  "meeting",
  "notice",
  "holiday",
  "other",
]);
export type CalendarCategory = z.infer<typeof CalendarCategorySchema>;

/** Who the entry is visible to. Parents see `all` + `parents`. */
export const CalendarAudienceSchema = z.enum(["all", "staff", "parents"]);
export type CalendarAudience = z.infer<typeof CalendarAudienceSchema>;

/* ─────────────────── Stored event (calendar_events row) ─────────────────── */

export const CalendarEventSchema = z.object({
  id: z.number().int(),
  sessionCode: z.string(),
  title: z.string().min(1).max(160),
  description: z.string().nullable(),
  category: CalendarCategorySchema,
  startDate: z.string().regex(ISO_DATE),
  endDate: z.string().regex(ISO_DATE).nullable(),
  startTime: z.string().nullable(), // "HH:MM" 24h
  endTime: z.string().nullable(),
  allDay: z.boolean(),
  /** Marks a non-working day (so the frontend can grey it like a holiday). */
  isHoliday: z.boolean(),
  audience: CalendarAudienceSchema,
  classSlug: z.string().nullable(),
  location: z.string().nullable(),
  color: z.string().nullable(),
  createdBy: z.number().int().nullable(),
  createdAt: z.string().nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarEventUpsertSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(1000).nullable().optional(),
    category: CalendarCategorySchema.default("event"),
    startDate: z.string().regex(ISO_DATE),
    endDate: z.string().regex(ISO_DATE).nullable().optional(),
    startTime: z.string().regex(HM).nullable().optional(),
    endTime: z.string().regex(HM).nullable().optional(),
    allDay: z.boolean().default(true),
    isHoliday: z.boolean().default(false),
    audience: CalendarAudienceSchema.default("all"),
    classSlug: z.string().max(16).nullable().optional(),
    location: z.string().max(160).nullable().optional(),
    color: z.string().max(16).nullable().optional(),
    /** Defaults to the current academic session when omitted. */
    sessionCode: z.string().max(10).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  })
  .refine(
    (v) => v.allDay || !(v.startTime && v.endTime) || v.endTime > v.startTime,
    { message: "endTime must be after startTime", path: ["endTime"] },
  );
export type CalendarEventUpsert = z.infer<typeof CalendarEventUpsertSchema>;

/* ─────────────────── Merged feed ─────────────────── */

export const CalendarFeedSourceSchema = z.enum(["event", "holiday", "exam"]);
export type CalendarFeedSource = z.infer<typeof CalendarFeedSourceSchema>;

export const CalendarFeedItemSchema = z.object({
  /** Stable composite id across sources, e.g. "event:12", "holiday:3", "exam:45". */
  key: z.string(),
  source: CalendarFeedSourceSchema,
  refId: z.number().int(), // underlying row id within its source table
  title: z.string(),
  category: CalendarCategorySchema,
  date: z.string().regex(ISO_DATE), // the day the item falls on
  endDate: z.string().regex(ISO_DATE).nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  allDay: z.boolean(),
  isHoliday: z.boolean(),
  audience: CalendarAudienceSchema,
  classLabel: z.string().nullable(),
  location: z.string().nullable(),
  color: z.string().nullable(),
  /** Only `event` rows can be edited/deleted via the calendar module. */
  editable: z.boolean(),
});
export type CalendarFeedItem = z.infer<typeof CalendarFeedItemSchema>;

export const CalendarFeedQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE).optional(),
    to: z.string().regex(ISO_DATE).optional(),
    /** Shortcut for a whole month — overrides from/to when present. */
    month: z.string().regex(ISO_MONTH).optional(),
    sessionCode: z.string().max(10).optional(),
    classSlug: z.string().max(16).optional(),
    includeHolidays: QueryBool.optional(),
    includeExams: QueryBool.optional(),
  })
  .refine((v) => !!v.month || !!v.from || !!v.to, {
    message: "Provide either `month` or a `from`/`to` range",
  });
export type CalendarFeedQuery = z.infer<typeof CalendarFeedQuerySchema>;

export const CalendarFeedResponseSchema = z.object({
  from: z.string().regex(ISO_DATE),
  to: z.string().regex(ISO_DATE),
  items: z.array(CalendarFeedItemSchema),
});
export type CalendarFeedResponse = z.infer<typeof CalendarFeedResponseSchema>;
