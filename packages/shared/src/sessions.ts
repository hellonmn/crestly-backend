import { z } from "zod";

export const AcademicSessionSchema = z.object({
  code: z.string().min(4).max(10), // '2025-26'
  label: z.string().min(1).max(40),
  isCurrent: z.boolean(),
  startedAt: z.string(),
  endedAt: z.string(),
  promotedFrom: z.string().nullable(),
  promotedAt: z.string().nullable(),
});
export type AcademicSession = z.infer<typeof AcademicSessionSchema>;

export const AcademicSessionUpsertSchema = AcademicSessionSchema.omit({
  isCurrent: true,
  promotedFrom: true,
  promotedAt: true,
});
export type AcademicSessionUpsert = z.infer<typeof AcademicSessionUpsertSchema>;
