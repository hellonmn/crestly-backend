import { z } from "zod";

export const EditRequestStatusSchema = z.enum(["pending", "approved", "rejected", "partial"]);
export type EditRequestStatus = z.infer<typeof EditRequestStatusSchema>;

export const EditFieldStatusSchema = z.enum(["pending", "approved", "rejected"]);
export type EditFieldStatus = z.infer<typeof EditFieldStatusSchema>;

export const EditRequestFieldSchema = z.object({
  id: z.number().int(),
  fieldName: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
  fieldStatus: EditFieldStatusSchema,
  rejectionReason: z.string().nullable(),
  reviewedAt: z.string().nullable(),
});
export type EditRequestField = z.infer<typeof EditRequestFieldSchema>;

export const EditRequestSchema = z.object({
  id: z.number().int(),
  srNumber: z.number().int(),
  studentName: z.string(),
  studentClass: z.string(),
  studentSection: z.string(),
  requestedBy: z.number().int(),
  requestedByName: z.string().nullable(),
  requestedAt: z.string(),
  status: EditRequestStatusSchema,
  reviewedBy: z.number().int().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  note: z.string().nullable(),
  reviewNote: z.string().nullable(),
  fields: z.array(EditRequestFieldSchema),
});
export type EditRequest = z.infer<typeof EditRequestSchema>;

export const EditRequestListQuerySchema = z.object({
  status: EditRequestStatusSchema.optional(),
  mine: z.coerce.boolean().optional(),       // own requests vs. queue
});
export type EditRequestListQuery = z.infer<typeof EditRequestListQuerySchema>;

export const ReviewDecisionFieldSchema = z.object({
  fieldId: z.number().int(),
  decision: z.enum(["approve", "reject"]),
  rejectionReason: z.string().nullable().optional(),
});
export type ReviewDecisionField = z.infer<typeof ReviewDecisionFieldSchema>;

export const ReviewDecisionSchema = z.object({
  decisions: z.array(ReviewDecisionFieldSchema),
  reviewNote: z.string().max(500).nullable().optional(),
});
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionSchema>;
