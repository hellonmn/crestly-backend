import { z } from "zod";

export const DiaryEntrySchema = z.object({
  id: z.number().int().nullable(),
  sessionCode: z.string(),
  classSlug: z.string(),
  sectionCode: z.string(),
  diaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodId: z.number().int().nullable(),
  periodNo: z.number().int().nullable(),
  periodName: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  subjectId: z.number().int().nullable(),
  subjectName: z.string().nullable(),
  teacherUserId: z.number().int().nullable(),
  teacherName: z.string().nullable(),
  topic: z.string(),
  homework: z.string().nullable(),
});
export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

export const DiaryDayQuerySchema = z.object({
  class: z.string().min(1),
  section: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type DiaryDayQuery = z.infer<typeof DiaryDayQuerySchema>;

export const DiaryDayResponseSchema = z.object({
  date: z.string(),
  class: z.string(),
  section: z.string(),
  isHoliday: z.boolean(),
  holidayName: z.string().nullable(),
  /** One entry per timetable period (with topic + homework possibly empty). */
  entries: z.array(DiaryEntrySchema),
});
export type DiaryDayResponse = z.infer<typeof DiaryDayResponseSchema>;

export const DiarySaveSchema = z.object({
  classSlug: z.string().min(1),
  sectionCode: z.string().min(1),
  diaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodId: z.number().int(),
  topic: z.string().max(600),
  homework: z.string().max(1200).nullable().optional(),
});
export type DiarySaveInput = z.infer<typeof DiarySaveSchema>;
