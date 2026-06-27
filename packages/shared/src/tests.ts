import { z } from "zod";

/* ============================================================
   Online tests — MCQ + fill-in-the-blanks.

   Teachers author tests against a class/section/subject; students
   attempt them through the parent portal; MCQ and fill-blank
   answers are auto-graded on submit and the score is stored and
   shown back to parents.

   Tables:
     tests                 — the test (draft → published → closed)
     test_questions        — questions (mcq | fill_blank)
     test_attempts         — one attempt per child per test
     test_attempt_answers  — per-question response + grading
   ============================================================ */

export const TestStatusSchema = z.enum(["draft", "published", "closed"]);
export type TestStatus = z.infer<typeof TestStatusSchema>;

export const QuestionTypeSchema = z.enum(["mcq", "fill_blank"]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

/* ─────────────────── Authoring (teacher) ─────────────────── */

/** One option of an MCQ question. */
export const McqOptionSchema = z.object({
  text: z.string().min(1).max(500),
});
export type McqOption = z.infer<typeof McqOptionSchema>;

/** A question as the teacher authors it (includes the answer key). */
export const TestQuestionUpsertSchema = z
  .object({
    type: QuestionTypeSchema,
    prompt: z.string().min(1).max(2000),
    marks: z.number().int().min(1).max(100).default(1),
    /** MCQ only: 2–6 options. */
    options: z.array(McqOptionSchema).min(2).max(6).optional(),
    /** MCQ: indices of correct options (supports multi-correct). */
    correctOptions: z.array(z.number().int().nonnegative()).optional(),
    /** fill_blank: accepted answers (any match = correct). */
    acceptedAnswers: z.array(z.string().min(1).max(200)).optional(),
    /** fill_blank: case-sensitive matching (default false). */
    caseSensitive: z.boolean().default(false),
  })
  .superRefine((q, ctx) => {
    if (q.type === "mcq") {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "MCQ needs at least 2 options", path: ["options"] });
      }
      const max = q.options?.length ?? 0;
      if (!q.correctOptions || q.correctOptions.length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Mark at least one correct option", path: ["correctOptions"] });
      } else if (q.correctOptions.some((i) => i >= max)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "correctOptions index out of range", path: ["correctOptions"] });
      }
    } else {
      if (!q.acceptedAnswers || q.acceptedAnswers.length < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide at least one accepted answer", path: ["acceptedAnswers"] });
      }
    }
  });
export type TestQuestionUpsert = z.infer<typeof TestQuestionUpsertSchema>;

export const TestUpsertSchema = z
  .object({
    title: z.string().min(1).max(160),
    instructions: z.string().max(2000).nullable().optional(),
    classSlug: z.string().min(1).max(16),
    sectionCode: z.string().max(8).nullable().optional(),
    subjectId: z.number().int().positive().nullable().optional(),
    /** Marks needed to pass; null = no pass/fail line. Clamped ≤ total in the service. */
    passMarks: z.number().int().min(0).max(10000).nullable().optional(),
    durationMin: z.number().int().min(1).max(600).nullable().optional(),
    availableFrom: z.string().datetime().nullable().optional(),
    availableTo: z.string().datetime().nullable().optional(),
    shuffle: z.boolean().default(false),
    sessionCode: z.string().max(10).optional(), // defaults to current session
    questions: z.array(TestQuestionUpsertSchema).min(1).max(100),
  })
  .refine(
    (t) => !t.availableFrom || !t.availableTo || t.availableTo >= t.availableFrom,
    { message: "availableTo must be after availableFrom", path: ["availableTo"] },
  );
export type TestUpsert = z.infer<typeof TestUpsertSchema>;

/* ─────────────────── Read shapes (teacher) ─────────────────── */

/** A question WITH its answer key — staff view only. */
export const TestQuestionSchema = z.object({
  id: z.number().int(),
  type: QuestionTypeSchema,
  prompt: z.string(),
  marks: z.number().int(),
  sortOrder: z.number().int(),
  options: z.array(McqOptionSchema).nullable(),
  correctOptions: z.array(z.number().int()).nullable(),
  acceptedAnswers: z.array(z.string()).nullable(),
  caseSensitive: z.boolean(),
});
export type TestQuestion = z.infer<typeof TestQuestionSchema>;

export const TestSchema = z.object({
  id: z.number().int(),
  sessionCode: z.string(),
  title: z.string(),
  instructions: z.string().nullable(),
  classSlug: z.string(),
  sectionCode: z.string().nullable(),
  subjectId: z.number().int().nullable(),
  subjectName: z.string().nullable(),
  status: TestStatusSchema,
  durationMin: z.number().int().nullable(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  shuffle: z.boolean(),
  totalMarks: z.number().int(),
  passMarks: z.number().int().nullable(),
  questionCount: z.number().int(),
  createdBy: z.number().int().nullable(),
  createdAt: z.string().nullable(),
  questions: z.array(TestQuestionSchema),
});
export type Test = z.infer<typeof TestSchema>;

export const TestListItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  classSlug: z.string(),
  sectionCode: z.string().nullable(),
  subjectName: z.string().nullable(),
  status: TestStatusSchema,
  totalMarks: z.number().int(),
  passMarks: z.number().int().nullable(),
  questionCount: z.number().int(),
  attemptCount: z.number().int(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type TestListItem = z.infer<typeof TestListItemSchema>;

export const TestListQuerySchema = z.object({
  sessionCode: z.string().max(10).optional(),
  classSlug: z.string().max(16).optional(),
  status: TestStatusSchema.optional(),
});
export type TestListQuery = z.infer<typeof TestListQuerySchema>;

/** Teacher results view — one row per child who attempted. */
export const TestResultRowSchema = z.object({
  attemptId: z.number().int(),
  srNumber: z.number().int(),
  studentName: z.string(),
  classLabel: z.string(),
  score: z.number().int().nullable(),
  maxScore: z.number().int(),
  /** score >= passMarks; null when no pass mark set or not yet submitted. */
  passed: z.boolean().nullable(),
  status: z.enum(["in_progress", "submitted"]),
  submittedAt: z.string().nullable(),
});
export type TestResultRow = z.infer<typeof TestResultRowSchema>;

export const TestResultsResponseSchema = z.object({
  testId: z.number().int(),
  title: z.string(),
  totalMarks: z.number().int(),
  passMarks: z.number().int().nullable(),
  attempts: z.array(TestResultRowSchema),
  averagePct: z.number().nullable(),
});
export type TestResultsResponse = z.infer<typeof TestResultsResponseSchema>;

/* ─────────────────── Parent / student attempt ─────────────────── */

/** A question as shown to the student — NO answer key. */
export const AttemptQuestionSchema = z.object({
  id: z.number().int(),
  type: QuestionTypeSchema,
  prompt: z.string(),
  marks: z.number().int(),
  /** MCQ options without any correct flag. */
  options: z.array(McqOptionSchema).nullable(),
});
export type AttemptQuestion = z.infer<typeof AttemptQuestionSchema>;

/** A test a parent can see for a child, with prior result if any. */
export const ParentTestListItemSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  subjectName: z.string().nullable(),
  totalMarks: z.number().int(),
  questionCount: z.number().int(),
  durationMin: z.number().int().nullable(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  /** "available" | "upcoming" | "closed" | "attempted". */
  state: z.enum(["available", "upcoming", "closed", "attempted"]),
  score: z.number().int().nullable(),
  passMarks: z.number().int().nullable(),
  /** score >= passMarks; null until attempted or when no pass mark set. */
  passed: z.boolean().nullable(),
});
export type ParentTestListItem = z.infer<typeof ParentTestListItemSchema>;

export const ParentTestListResponseSchema = z.object({
  srNumber: z.number().int(),
  tests: z.array(ParentTestListItemSchema),
});
export type ParentTestListResponse = z.infer<typeof ParentTestListResponseSchema>;

/** The playable test for a child (questions without answers). */
export const ParentTestDetailSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  instructions: z.string().nullable(),
  subjectName: z.string().nullable(),
  durationMin: z.number().int().nullable(),
  totalMarks: z.number().int(),
  alreadyAttempted: z.boolean(),
  questions: z.array(AttemptQuestionSchema),
});
export type ParentTestDetail = z.infer<typeof ParentTestDetailSchema>;

/** A single answer in a submission. */
export const TestAnswerInputSchema = z.object({
  questionId: z.number().int().positive(),
  /** MCQ: selected option indices. */
  selectedOptions: z.array(z.number().int().nonnegative()).optional(),
  /** fill_blank: the typed answer. */
  responseText: z.string().max(500).optional(),
});
export type TestAnswerInput = z.infer<typeof TestAnswerInputSchema>;

export const TestSubmitSchema = z.object({
  sr: z.number().int().positive(),
  answers: z.array(TestAnswerInputSchema).min(1),
});
export type TestSubmitInput = z.infer<typeof TestSubmitSchema>;

/** Per-question outcome returned after grading (reveals the correct answer). */
export const GradedAnswerSchema = z.object({
  questionId: z.number().int(),
  type: QuestionTypeSchema,
  prompt: z.string(),
  marks: z.number().int(),
  awardedMarks: z.number().int(),
  isCorrect: z.boolean(),
  /** Echo of what the student answered. */
  selectedOptions: z.array(z.number().int()).nullable(),
  responseText: z.string().nullable(),
  /** The answer key, revealed post-submit. */
  correctOptions: z.array(z.number().int()).nullable(),
  acceptedAnswers: z.array(z.string()).nullable(),
});
export type GradedAnswer = z.infer<typeof GradedAnswerSchema>;

export const TestSubmitResultSchema = z.object({
  testId: z.number().int(),
  srNumber: z.number().int(),
  score: z.number().int(),
  maxScore: z.number().int(),
  percent: z.number(),
  passMarks: z.number().int().nullable(),
  /** score >= passMarks; null when no pass mark is set. */
  passed: z.boolean().nullable(),
  submittedAt: z.string(),
  answers: z.array(GradedAnswerSchema),
});
export type TestSubmitResult = z.infer<typeof TestSubmitResultSchema>;

/* ─────────────────── Question import (paste / CSV) ─────────────────── */

/**
 * Bulk-import questions by pasting text (copied from Google Docs / Word) or
 * CSV. The server parses into draft questions the teacher reviews before
 * saving. Supported text format (blank line separates questions):
 *
 *   What is 2 + 2? [1]      ← prompt, optional [marks]
 *   - 3                     ← MCQ option ('-' wrong)
 *   * 4                     ← MCQ option ('*' correct)
 *   - 5
 *
 *   Capital of France is ___ [2]
 *   = Paris                 ← fill-blank accepted answer ('=')
 *   = paris
 *
 * CSV (header required): type,prompt,marks,options,correct,accepted,caseSensitive
 *   options '|'-separated; correct = 0-based indices '|'-separated; accepted '|'-separated.
 */
export const TestImportRequestSchema = z.object({
  text: z.string().min(1).max(50_000),
  /** "auto" (default) detects CSV vs the block text format. */
  format: z.enum(["auto", "text", "csv"]).default("auto"),
});
export type TestImportRequest = z.infer<typeof TestImportRequestSchema>;

export const TestImportResultSchema = z.object({
  questions: z.array(TestQuestionUpsertSchema),
  /** Human-readable problems for blocks that couldn't be parsed. */
  errors: z.array(z.string()),
});
export type TestImportResult = z.infer<typeof TestImportResultSchema>;
