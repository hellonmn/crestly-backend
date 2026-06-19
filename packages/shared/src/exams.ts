import { z } from "zod";

// --- terms ---

export const ExamTermSchema = z.object({
  id: z.number().int(),
  sessionCode: z.string(),
  slug: z.string(),
  name: z.string(),
  shortCode: z.string(),
  weightPercent: z.number(),
  defaultMaxMarks: z.number().int(),
  sortOrder: z.number().int(),
  isFinalized: z.boolean(),
  /** Counts populated by the list endpoint so the table can show usage stats. */
  papersCount: z.number().int().nonnegative().optional(),
  marksCount: z.number().int().nonnegative().optional(),
});
export type ExamTerm = z.infer<typeof ExamTermSchema>;

export const ExamTermUpsertSchema = z.object({
  slug: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  shortCode: z.string().min(1).max(8),
  weightPercent: z.number().min(0).max(100),
  defaultMaxMarks: z.number().int().min(1).max(1000).default(100),
  sortOrder: z.number().int().default(0),
});
export type ExamTermUpsert = z.infer<typeof ExamTermUpsertSchema>;

// --- subjects ---

export const ExamSubjectSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  shortCode: z.string(),
  isLanguage: z.boolean(),
  sortOrder: z.number().int(),
  /** classes that include this subject (slugs). */
  classes: z.array(z.string()),
});
export type ExamSubject = z.infer<typeof ExamSubjectSchema>;

export const ExamSubjectUpsertSchema = z.object({
  slug: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  shortCode: z.string().min(1).max(8),
  isLanguage: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type ExamSubjectUpsert = z.infer<typeof ExamSubjectUpsertSchema>;

export const ExamClassSubjectToggleSchema = z.object({
  classSlug: z.string().min(1),
  subjectId: z.number().int(),
  enabled: z.boolean(),
});
export type ExamClassSubjectToggle = z.infer<typeof ExamClassSubjectToggleSchema>;

// --- datesheet ---

export const ExamDatesheetRowSchema = z.object({
  id: z.number().int(),
  termId: z.number().int(),
  classSlug: z.string(),
  subjectId: z.number().int(),
  subjectName: z.string(),
  examDate: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  maxMarks: z.number().int(),
  passMarks: z.number().int(),
  syllabusText: z.string().nullable(),
});
export type ExamDatesheetRow = z.infer<typeof ExamDatesheetRowSchema>;

export const ExamDatesheetUpsertSchema = z.object({
  termId: z.number().int(),
  classSlug: z.string().min(1),
  subjectId: z.number().int(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  maxMarks: z.number().int().min(1).default(100),
  passMarks: z.number().int().min(0).default(33),
  syllabusText: z.string().max(500).nullable().optional(),
});
export type ExamDatesheetUpsert = z.infer<typeof ExamDatesheetUpsertSchema>;

// --- marks ---

export const ExamMarksRowSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  marksObtained: z.number().nullable(),
  isAbsent: z.boolean(),
  remarks: z.string().nullable(),
});
export type ExamMarksRow = z.infer<typeof ExamMarksRowSchema>;

export const ExamMarksQuerySchema = z.object({
  termId: z.coerce.number().int(),
  class: z.string().min(1),
  section: z.string().min(1),
  subjectId: z.coerce.number().int(),
});
export type ExamMarksQuery = z.infer<typeof ExamMarksQuerySchema>;

export const ExamMarksResponseSchema = z.object({
  termId: z.number().int(),
  termName: z.string(),
  isFinalized: z.boolean(),
  class: z.string(),
  section: z.string(),
  subjectId: z.number().int(),
  subjectName: z.string(),
  maxMarks: z.number().int(),
  passMarks: z.number().int(),
  rows: z.array(ExamMarksRowSchema),
});
export type ExamMarksResponse = z.infer<typeof ExamMarksResponseSchema>;

export const ExamMarkSaveSchema = z.object({
  termId: z.number().int(),
  subjectId: z.number().int(),
  srNumber: z.number().int(),
  marksObtained: z.number().min(0).nullable(),
  isAbsent: z.boolean().default(false),
});
export type ExamMarkSave = z.infer<typeof ExamMarkSaveSchema>;

// --- marksheet print payload ---

/**
 * Single-student marksheet aggregate. Drives /print/marksheet/:sr.
 * Mirrors erp/lib/exams.php :: exam_build_marksheet() — pass/fail is
 * gated by the Annual paper for each subject.
 */
export const MarksheetQuerySchema = z.object({
  sessionCode: z.string().optional(),    // defaults to current
  termId: z.coerce.number().int().optional(),  // single-term mode if set
});
export type MarksheetQuery = z.infer<typeof MarksheetQuerySchema>;

export const MarksheetSubjectRowSchema = z.object({
  subjectId: z.number().int(),
  subjectName: z.string(),
  shortCode: z.string(),
  isLanguage: z.boolean(),
  /** Per-term marks: { termId: { obtained, max, isAbsent } | null }. */
  perTerm: z.record(z.string(), z.object({
    obtained: z.number().nullable(),
    max: z.number().int(),
    isAbsent: z.boolean(),
  }).nullable()),
  obtained: z.number(),    // summed across all visible terms
  max: z.number().int(),
  weightedPercent: z.number(),
  finalGrade: z.string(),
  failed: z.boolean(),
  annualStatus: z.enum(["pending", "pass", "fail", "absent"]),
});
export type MarksheetSubjectRow = z.infer<typeof MarksheetSubjectRowSchema>;

export const MarksheetCoRowSchema = z.object({
  areaId: z.number().int(),
  areaName: z.string(),
  description: z.string().nullable(),
  /** Per-term grade: { termId: 'A'|'B'|'C' | null }. */
  perTerm: z.record(z.string(), z.enum(["A", "B", "C"]).nullable()),
});
export type MarksheetCoRow = z.infer<typeof MarksheetCoRowSchema>;

export const MarksheetSchema = z.object({
  student: z.object({
    srNumber: z.number().int(),
    studentName: z.string(),
    fatherName: z.string().nullable(),
    motherName: z.string().nullable(),
    dob: z.string().nullable(),
    class: z.string(),
    section: z.string(),
    address: z.string().nullable(),
  }),
  session: z.string(),
  /** Terms shown in the marksheet (single term when filtered, all otherwise). */
  terms: z.array(z.object({
    id: z.number().int(),
    name: z.string(),
    shortCode: z.string(),
    weightPercent: z.number(),
    isFinalized: z.boolean(),
  })),
  isSingleTerm: z.boolean(),
  /** When isSingleTerm, the picked term; null otherwise. */
  filterTerm: z.object({
    id: z.number().int(),
    name: z.string(),
    shortCode: z.string(),
  }).nullable(),
  /** "Decision" term — Annual (when present) or the last term. */
  annualTerm: z.object({
    id: z.number().int(),
    name: z.string(),
    shortCode: z.string(),
  }).nullable(),
  subjects: z.array(MarksheetSubjectRowSchema),
  coScholastic: z.array(MarksheetCoRowSchema),
  overall: z.object({
    obtained: z.number(),
    max: z.number().int(),
    percent: z.number(),
    grade: z.string(),
    result: z.enum(["PASS", "FAIL"]),
    rank: z.number().int().nullable(),
    classSize: z.number().int(),
  }),
  /** Promotion mapping (Nursery→LKG, …, 11th→12th). Null after 12th
   *  or on a non-annual single-term view. */
  nextClass: z.string().nullable(),
  /** Top-level school info for the printed header. */
  school: z.object({
    name: z.string(),
    address: z.string().nullable(),
    board: z.string().nullable(),
    sessionLabel: z.string().nullable(),
  }),
});
export type Marksheet = z.infer<typeof MarksheetSchema>;

// --- co-scholastic ---

export const CoGradeSchema = z.enum(["A", "B", "C"]);
export type CoGrade = z.infer<typeof CoGradeSchema>;

export const CoAreaSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
});
export type CoArea = z.infer<typeof CoAreaSchema>;

export const CoGradeSaveSchema = z.object({
  termId: z.number().int(),
  srNumber: z.number().int(),
  areaId: z.number().int(),
  grade: CoGradeSchema,
});
export type CoGradeSave = z.infer<typeof CoGradeSaveSchema>;

// --- results ---

export const ResultRowSchema = z.object({
  rank: z.number().int(),
  srNumber: z.number().int(),
  studentName: z.string(),
  totalObtained: z.number(),
  totalMax: z.number(),
  percentage: z.number(),
  grade: z.string(),
  passFail: z.enum(["PASS", "FAIL"]),
});
export type ResultRow = z.infer<typeof ResultRowSchema>;

export const ResultsQuerySchema = z.object({
  termId: z.coerce.number().int().optional(),       // omit → full-session aggregate
  class: z.string().min(1),
  section: z.string().min(1),
});
export type ResultsQuery = z.infer<typeof ResultsQuerySchema>;

export const ResultsResponseSchema = z.object({
  scope: z.enum(["term", "session"]),
  termId: z.number().int().nullable(),
  termName: z.string().nullable(),
  class: z.string(),
  section: z.string(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  classAverage: z.number(),
  topper: z.object({ srNumber: z.number().int(), studentName: z.string(), percentage: z.number() }).nullable(),
  /** Grade distribution: e.g. {"A+": 5, "A": 12, "B+": 8 ...} */
  gradeDistribution: z.record(z.string(), z.number().int()),
  rows: z.array(ResultRowSchema),
});
export type ResultsResponse = z.infer<typeof ResultsResponseSchema>;
