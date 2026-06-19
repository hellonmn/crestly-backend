import { z } from "zod";

export const PromotionStatusSchema = z.enum(["pending", "promoted", "held_back", "graduated"]);
export type PromotionStatus = z.infer<typeof PromotionStatusSchema>;

export const PromotionStudentSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  fromClass: z.string(),
  fromSection: z.string(),
  toClass: z.string().nullable(),
  toSection: z.string().nullable(),
  status: PromotionStatusSchema,
  outstandingDue: z.number().int().nonnegative(),
});
export type PromotionStudent = z.infer<typeof PromotionStudentSchema>;

export const PromotionOverviewSchema = z.object({
  fromSession: z.string(),
  toSession: z.string(),
  totals: z.object({
    active: z.number().int(),
    decided: z.number().int(),
    pending: z.number().int(),
    duesCarried: z.number().int(),
  }),
  sections: z.array(z.object({
    classSlug: z.string(),
    sectionCode: z.string(),
    pending: z.number().int(),
    promoted: z.number().int(),
    heldBack: z.number().int(),
    graduated: z.number().int(),
  })),
});
export type PromotionOverview = z.infer<typeof PromotionOverviewSchema>;

export const PromotionSectionQuerySchema = z.object({
  class: z.string().min(1),
  section: z.string().min(1),
});
export type PromotionSectionQuery = z.infer<typeof PromotionSectionQuerySchema>;

export const PromoteOneSchema = z.object({
  srNumber: z.number().int().positive(),
  action: z.enum(["promote", "hold_back", "graduate"]),
  toClass: z.string().nullable().optional(),
  toSection: z.string().nullable().optional(),
});
export type PromoteOneInput = z.infer<typeof PromoteOneSchema>;

export const PromoteSectionBulkSchema = z.object({
  class: z.string().min(1),
  section: z.string().min(1),
  defaultToClass: z.string().nullable().optional(),
  defaultToSection: z.string().nullable().optional(),
  decisions: z.array(PromoteOneSchema),
});
export type PromoteSectionBulk = z.infer<typeof PromoteSectionBulkSchema>;
