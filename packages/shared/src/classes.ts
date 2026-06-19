import { z } from "zod";

export const SectionSchema = z.object({
  id: z.number().int(),
  classId: z.number().int(),
  code: z.string().min(1).max(8),       // 'A', 'B', 'C', ...
  capacity: z.number().int().nullable(),
  teacherUserId: z.number().int().nullable(),
  teacherName: z.string().nullable(),
  studentCount: z.number().int().nonnegative(),
});
export type Section = z.infer<typeof SectionSchema>;

export const SchoolClassSchema = z.object({
  id: z.number().int(),
  slug: z.string().min(1).max(16),       // 'nur', '10', '11', '11-c', etc.
  name: z.string().min(1).max(40),       // 'Nursery', 'Class 10', ...
  sortOrder: z.number().int(),
  isSystem: z.boolean(),
  sections: z.array(SectionSchema),
  totalStudents: z.number().int().nonnegative(),
});
export type SchoolClass = z.infer<typeof SchoolClassSchema>;

export const SchoolClassUpsertSchema = z.object({
  slug: z.string().min(1).max(16),
  name: z.string().min(1).max(40),
  sortOrder: z.number().int().default(0),
});
export type SchoolClassUpsert = z.infer<typeof SchoolClassUpsertSchema>;

export const SectionUpsertSchema = z.object({
  classId: z.number().int().positive(),
  code: z.string().min(1).max(8),
  capacity: z.number().int().nullable().optional(),
  teacherUserId: z.number().int().nullable().optional(),
});
export type SectionUpsert = z.infer<typeof SectionUpsertSchema>;
