import { z } from "zod";

export const PickupPointSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  distanceKm: z.number().nullable(),
  googleMapsLink: z.string().nullable(),
  slab: z.string().nullable(),
  studentCount: z.number().int(),
  revenue: z.number().int(),
});
export type PickupPoint = z.infer<typeof PickupPointSchema>;

export const PickupPointListResponseSchema = z.object({
  items: z.array(PickupPointSchema),
  /** Total pickups in the system — may exceed items.length when the search is filtered. */
  totalPickups: z.number().int(),
  /** Pickups that have at least one active student assigned. */
  activePickups: z.number().int(),
  totalStudents: z.number().int(),
  totalRevenue: z.number().int(),
  totalSlabs: z.number().int(),
});
export type PickupPointListResponse = z.infer<typeof PickupPointListResponseSchema>;

export const PickupPointStudentSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  feeStatus: z.string().nullable(),
});
export type PickupPointStudent = z.infer<typeof PickupPointStudentSchema>;

export const PickupPointDetailSchema = PickupPointSchema.extend({
  yearlyFee: z.number().int().nullable(),
  quarterlyFee: z.number().int().nullable(),
  monthlyFee: z.number().int().nullable(),
  students: z.array(PickupPointStudentSchema),
});
export type PickupPointDetail = z.infer<typeof PickupPointDetailSchema>;

export const PickupPointUpsertSchema = z.object({
  name: z.string().min(1).max(160),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  distanceKm: z.number().nullable().optional(),
  googleMapsLink: z.string().max(255).nullable().optional(),
});
export type PickupPointUpsertInput = z.infer<typeof PickupPointUpsertSchema>;
