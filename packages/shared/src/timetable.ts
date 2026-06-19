import { z } from "zod";

/* ============================================================
   PHP-faithful timetable schemas.
   Mirrors erp/lib/timetable.php + erp/timetable/*.php exactly:
   one row per (session, class, section, day, period); writes are
   per-cell with double-booking detection (override via `force`).
   ============================================================ */

export const TimetablePeriodSchema = z.object({
  id: z.number().int(),
  periodNo: z.number().int(),
  name: z.string(),
  startTime: z.string(),                // 'HH:MM:SS'
  endTime: z.string(),
  isBreak: z.boolean(),
  sortOrder: z.number().int(),
});
export type TimetablePeriod = z.infer<typeof TimetablePeriodSchema>;

export const TimetablePeriodUpsertSchema = z.object({
  periodNo: z.number().int().min(0).max(20),
  name: z.string().min(1).max(40),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  isBreak: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type TimetablePeriodUpsert = z.infer<typeof TimetablePeriodUpsertSchema>;

/** One filled-in cell of the timetable grid. */
export const TimetableCellSchema = z.object({
  id: z.number().int(),
  dayOfWeek: z.number().int().min(1).max(7),
  periodId: z.number().int(),
  classSlug: z.string(),
  sectionCode: z.string(),
  subjectId: z.number().int().nullable(),
  subjectName: z.string().nullable(),
  subjectShortCode: z.string().nullable(),
  teacherUserId: z.number().int().nullable(),
  teacherName: z.string().nullable(),
  subjectId2: z.number().int().nullable(),
  subjectName2: z.string().nullable(),
  subjectShortCode2: z.string().nullable(),
  teacherUserId2: z.number().int().nullable(),
  teacherName2: z.string().nullable(),
  room: z.string().nullable(),
  notes: z.string().nullable(),
});
export type TimetableCell = z.infer<typeof TimetableCellSchema>;

export const TimetableGridQuerySchema = z.object({
  /** Pick one: by section OR by teacher. */
  class: z.string().optional(),
  section: z.string().optional(),
  teacherUserId: z.coerce.number().int().optional(),
  sessionCode: z.string().optional(),
});
export type TimetableGridQuery = z.infer<typeof TimetableGridQuerySchema>;

export const TimetableGridResponseSchema = z.object({
  sessionCode: z.string(),
  scope: z.enum(["section", "teacher"]),
  scopeLabel: z.string(),
  periods: z.array(TimetablePeriodSchema),
  cells: z.array(TimetableCellSchema),
  /** Section view only — count of cells that have a subject OR teacher. */
  fillCount: z.number().int().optional(),
});
export type TimetableGridResponse = z.infer<typeof TimetableGridResponseSchema>;

/** Single-cell upsert (PHP-equivalent of tt_save_cell).
 *  When a teacher is double-booked across sections, the API throws unless
 *  `force: true`. The UI surfaces the conflict and lets the user re-save. */
export const TimetableCellUpsertSchema = z.object({
  classSlug: z.string().min(1),
  sectionCode: z.string().min(1),
  dayOfWeek: z.number().int().min(1).max(7),
  periodId: z.number().int().positive(),
  subjectId: z.number().int().nullable(),
  teacherUserId: z.number().int().nullable(),
  subjectId2: z.number().int().nullable().optional(),
  teacherUserId2: z.number().int().nullable().optional(),
  room: z.string().max(40).nullable().optional(),
  notes: z.string().max(120).nullable().optional(),
  /** Override the teacher double-booking guard. */
  force: z.boolean().optional().default(false),
});
export type TimetableCellUpsert = z.infer<typeof TimetableCellUpsertSchema>;

/* ============================================================
   Eligible teachers per subject — for the cell editor's smart
   filter. Mirrors tt_eligible_teachers_for_class().
   ============================================================ */

export const EligibleTeachersQuerySchema = z.object({
  class: z.string().min(1),
});
export type EligibleTeachersQuery = z.infer<typeof EligibleTeachersQuerySchema>;

export const EligibleTeachersResponseSchema = z.object({
  classSlug: z.string(),
  classBand: z.string(),
  /** Full roster — id + display label (name + designation). */
  teachers: z.array(z.object({
    id: z.number().int(),
    name: z.string(),
    designation: z.string().nullable(),
    department: z.string().nullable(),
  })),
  /** subjectId → list of eligible teacher ids (band + subject match). */
  bySubject: z.record(z.string(), z.array(z.number().int())),
});
export type EligibleTeachersResponse = z.infer<typeof EligibleTeachersResponseSchema>;

/* ============================================================
   Smart allot — auto-generate a section's (or all sections')
   weekly grid. Mirrors tt_auto_allot() + tt_auto_allot_all().
   ============================================================ */

export const SmartAllotInputSchema = z.object({
  scope: z.enum(["section", "all"]),
  /** Required when scope='section', ignored when scope='all'. */
  classSlug: z.string().min(1).optional(),
  sectionCode: z.string().min(1).optional(),
  /** Wipe the section (or whole session, for scope='all') before filling. */
  clearFirst: z.boolean().default(false),
}).refine(
  (v) => v.scope === "all" || (!!v.classSlug && !!v.sectionCode),
  { message: "classSlug + sectionCode are required when scope='section'" },
);
export type SmartAllotInput = z.infer<typeof SmartAllotInputSchema>;

export const SmartAllotResultSchema = z.object({
  ok: z.boolean(),
  /** Scope='section': filled cells; scope='all': total cells filled across all sections. */
  filled: z.number().int().optional(),
  /** Cells the algorithm couldn't find a teacher for. */
  unassigned: z.number().int().optional(),
  /** scope='all' only — how many sections were processed. */
  sections: z.number().int().optional(),
  /** scope='all' only — how many sections were skipped (e.g. no subjects mapped). */
  skipped: z.number().int().optional(),
  /** Human message — set when nothing happened or something blocked the run. */
  msg: z.string().optional(),
});
export type SmartAllotResult = z.infer<typeof SmartAllotResultSchema>;

/* ============================================================
   Workload report.
   ============================================================ */

export const WorkloadRowSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  assignedSlots: z.number().int(),
  capacitySlots: z.number().int(),
  sectionsCount: z.number().int(),
  utilizationPct: z.number(),
});
export type WorkloadRow = z.infer<typeof WorkloadRowSchema>;
