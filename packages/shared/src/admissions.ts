import { z } from "zod";

export const EnquirySourceSchema = z.enum([
  "walk_in", "phone", "website", "referral", "social",
  "newspaper", "hoarding", "event", "other",
]);
export type EnquirySource = z.infer<typeof EnquirySourceSchema>;

export const EnquiryStatusSchema = z.enum([
  "new", "contacted", "visit_scheduled", "visited",
  "application", "admitted", "lost",
]);
export type EnquiryStatus = z.infer<typeof EnquiryStatusSchema>;

export const AdmissionEnquirySchema = z.object({
  id: z.number().int(),
  childName: z.string(),
  parentName: z.string().nullable(),
  phone: z.string(),
  email: z.string().nullable(),
  classSeeking: z.string().nullable(),
  source: EnquirySourceSchema,
  sourceDetail: z.string().nullable(),
  status: EnquiryStatusSchema,
  followUpDate: z.string().nullable(),
  assignedTo: z.number().int().nullable(),
  assignedToName: z.string().nullable(),
  city: z.string().nullable(),
  notes: z.string().nullable(),
  lostReason: z.string().nullable(),
  convertedSrNumber: z.number().int().nullable(),
  createdBy: z.number().int().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AdmissionEnquiry = z.infer<typeof AdmissionEnquirySchema>;

export const AdmissionFollowupSchema = z.object({
  id: z.number().int(),
  enquiryId: z.number().int(),
  note: z.string().nullable(),
  statusTo: z.string().nullable(),
  nextFollowUp: z.string().nullable(),
  createdBy: z.number().int().nullable(),
  createdByName: z.string().nullable(),
  createdAt: z.string(),
});
export type AdmissionFollowup = z.infer<typeof AdmissionFollowupSchema>;

export const EnquiryListQuerySchema = z.object({
  q: z.string().optional(),
  status: EnquiryStatusSchema.optional(),
  source: EnquirySourceSchema.optional(),
  followupsDue: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type EnquiryListQuery = z.infer<typeof EnquiryListQuerySchema>;

export const EnquiryListResponseSchema = z.object({
  items: z.array(AdmissionEnquirySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totals: z.object({
    all: z.number().int(),
    open: z.number().int(),
    admitted: z.number().int(),
    lost: z.number().int(),
    followupsDue: z.number().int(),
    /** Created during the current calendar month. */
    thisMonth: z.number().int(),
    /** admitted ÷ all, rounded to integer percent. */
    conversion: z.number().int(),
  }),
});
export type EnquiryListResponse = z.infer<typeof EnquiryListResponseSchema>;

export const EnquiryUpsertSchema = z.object({
  childName: z.string().min(1).max(120),
  parentName: z.string().max(120).nullable().optional(),
  phone: z.string().min(10).max(20),
  email: z.string().email().nullable().optional(),
  classSeeking: z.string().max(16).nullable().optional(),
  source: EnquirySourceSchema.default("walk_in"),
  sourceDetail: z.string().max(160).nullable().optional(),
  status: EnquiryStatusSchema.default("new"),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  assignedTo: z.number().int().nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EnquiryUpsertInput = z.infer<typeof EnquiryUpsertSchema>;

export const FollowupAddSchema = z.object({
  note: z.string().nullable().optional(),
  statusTo: EnquiryStatusSchema.nullable().optional(),
  nextFollowUp: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lostReason: z.string().max(160).nullable().optional(),
});
export type FollowupAddInput = z.infer<typeof FollowupAddSchema>;
