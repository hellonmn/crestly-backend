import { z } from "zod";

/**
 * Streams (PCM / PCB / Commerce) reference data + per-stream rosters.
 *
 * The `stream_subjects` table maps a stream code → its catalog subjects.
 * The roster comes from `students.stream` for class 11/12 students.
 */

export const StreamCode = z.enum(["PCM", "PCB", "Commerce"]);
export type StreamCode = z.infer<typeof StreamCode>;

export const StreamSubjectSchema = z.object({
  id: z.number().int(),
  stream: z.string(),
  subjectId: z.number().int(),
  subjectName: z.string(),
  isOptional: z.boolean(),
  sortOrder: z.number().int(),
});
export type StreamSubject = z.infer<typeof StreamSubjectSchema>;

export const StreamSummarySchema = z.object({
  stream: z.string(),       // 'PCM'
  subjects: z.array(StreamSubjectSchema),
  sectionsCount: z.number().int().nonnegative(),
  studentCount: z.number().int().nonnegative(),
});
export type StreamSummary = z.infer<typeof StreamSummarySchema>;
