import { z } from "zod";

/**
 * Convention: Zod schemas are exported with a `Schema` suffix; the inferred
 * type keeps the clean name. See packages/shared/src/auth.ts for rationale.
 */

export const GenderSchema = z.enum(["Male", "Female", "Other"]);
export type Gender = z.infer<typeof GenderSchema>;

export const StudentStatusSchema = z.enum(["active", "inactive"]);
export type StudentStatus = z.infer<typeof StudentStatusSchema>;

/**
 * Student row as returned by the API. `srNumber` is the admission roll
 * number and the primary key — no surrogate id.
 */
/**
 * Per-row payment summary the list endpoint may carry inline (parity with
 * the PHP page's STATUS column pill). Optional because not every caller
 * needs the join (e.g. SR-pickers).
 */
export const StudentPaymentStatusSchema = z.enum(["paid", "partial", "pending", "overdue"]);
export type StudentPaymentStatus = z.infer<typeof StudentPaymentStatusSchema>;

export const StudentSchema = z.object({
  srNumber: z.number().int().positive(),
  studentName: z.string().min(1).max(120),
  fatherName: z.string().max(120).nullable(),
  motherName: z.string().max(120).nullable(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  age: z.number().int().min(0).max(255).nullable(),
  gender: GenderSchema.nullable(),
  address: z.string().nullable(),
  class: z.string().min(1).max(16),
  section: z.string().min(1).max(8),
  schoolName: z.string().max(120).nullable(),
  board: z.string().max(32).nullable(),
  fatherContact: z.string().max(20).nullable(),
  motherContact: z.string().max(20).nullable(),
  callingNumber: z.string().max(20).nullable(),
  whatsappNumber: z.string().max(20).nullable(),
  pickupPointId: z.number().int().nullable(),
  familyId: z.number().int().nullable(),
  status: StudentStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Joined display fields (only when the list endpoint hydrates them). */
  pickupName: z.string().nullable().optional(),
  isHostel: z.boolean().optional(),
  paymentStatus: StudentPaymentStatusSchema.nullable().optional(),
  dueAmount: z.number().int().nonnegative().optional(),
});
export type Student = z.infer<typeof StudentSchema>;

/**
 * Mirrors filters from erp/students/index.php:
 *   q, class, section, gender, status, accom, page
 * `accom` follows the PHP convention: "" (all) | "day" | "hostel".
 */
export const StudentAccomSchema = z.enum(["day", "hostel"]);
export type StudentAccom = z.infer<typeof StudentAccomSchema>;

export const StudentListQuerySchema = z.object({
  q: z.string().optional(),
  class: z.string().optional(),
  section: z.string().optional(),
  gender: GenderSchema.optional(),
  status: z.enum(["active", "inactive", "all"]).optional(),
  accom: StudentAccomSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type StudentListQuery = z.infer<typeof StudentListQuerySchema>;

export const StudentListResponseSchema = z.object({
  items: z.array(StudentSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  /** Distinct values for the desktop/mobile filter selects. */
  classes: z.array(z.string()).optional(),
  sections: z.array(z.string()).optional(),
});
export type StudentListResponse = z.infer<typeof StudentListResponseSchema>;

/**
 * Student create / update payload — superset of the list-view Student
 * schema. Mirrors every field the PHP students/edit.php form posts so
 * the React edit page is a 1:1 port. SR number is optional on create
 * (auto-assigned to MAX(sr_number)+1) and required on update via the URL.
 */
export const StudentUpsertSchema = z.object({
  srNumber: z.number().int().positive().optional(),

  // Identity
  studentName: z.string().min(1).max(120),
  fatherName: z.string().max(120).nullable().optional(),
  motherName: z.string().max(120).nullable().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  age: z.number().int().min(0).max(255).nullable().optional(),
  gender: GenderSchema.nullable().optional(),
  bloodGroup: z.string().max(8).nullable().optional(),
  address: z.string().nullable().optional(),

  // Academic
  class: z.string().min(1).max(16),
  section: z.string().min(1).max(8),
  schoolName: z.string().max(120).nullable().optional(),
  board: z.string().max(32).nullable().optional(),
  status: StudentStatusSchema.default("active"),
  stream: z.string().max(16).nullable().optional(),
  subStream: z.string().max(16).nullable().optional(),
  isHostel: z.boolean().default(false),

  // Contact numbers
  fatherContact: z.string().max(20).nullable().optional(),
  fatherWhatsapp: z.string().max(20).nullable().optional(),
  motherContact: z.string().max(20).nullable().optional(),
  motherWhatsapp: z.string().max(20).nullable().optional(),
  callingNumber: z.string().max(20).nullable().optional(),
  whatsappNumber: z.string().max(20).nullable().optional(),

  // Local guardian
  localGuardianName: z.string().max(120).nullable().optional(),
  guardianRelation: z.string().max(60).nullable().optional(),
  localGuardianContact: z.string().max(20).nullable().optional(),
  localGuardianWhatsapp: z.string().max(20).nullable().optional(),
  localGuardianAddress: z.string().nullable().optional(),

  // Specialised contacts
  academicContactPerson: z.string().max(120).nullable().optional(),
  academicCallingNumber: z.string().max(20).nullable().optional(),
  academicWhatsappNumber: z.string().max(20).nullable().optional(),
  feeContactPerson: z.string().max(120).nullable().optional(),
  feeCallingNumber: z.string().max(20).nullable().optional(),
  feeWhatsappNumber: z.string().max(20).nullable().optional(),

  // Pickup + family
  pickupPointId: z.number().int().nullable().optional(),
  pickupPointName: z.string().max(120).nullable().optional(),
  familyId: z.number().int().nullable().optional(),

  // Home (hostellers)
  homeCity: z.string().max(80).nullable().optional(),
  homeState: z.string().max(80).nullable().optional(),
  homeAddress: z.string().nullable().optional(),
});
export type StudentUpsert = z.infer<typeof StudentUpsertSchema>;

/* ============================================================
   StudentDetail — the full payload powering the View page.
   Superset of StudentSchema with hostel, fees, family + siblings,
   pickup geometry, additional contacts. Mirrors what PHP's
   students/view.php joins together so the UI gets all of it
   in a single roundtrip.
   ============================================================ */

export const StudentFeeBreakdownSchema = z.object({
  sessionCode: z.string(),
  admissionStatus: z.string(),
  siblingDiscountPct: z.number(),
  siblingPosition: z.string().nullable(),
  /** Day-scholar columns */
  tuitionOriginal: z.number().int(),
  tuitionDiscount: z.number().int(),
  tuitionPayable: z.number().int(),
  annualCharges: z.number().int(),
  activityFee: z.number().int(),
  examFee: z.number().int(),
  transportSlab: z.string().nullable(),
  transportFee: z.number().int(),
  /** Hosteller-only columns */
  isHostel: z.boolean(),
  roomType: z.string().nullable(),
  lodgingDiscountPct: z.number(),
  hostelLodging: z.number().int(),
  hostelMess: z.number().int(),
  hostelCommon: z.number().int(),
  hostelOneTime: z.number().int(),
  /** Year totals */
  yearlyRecurringTotal: z.number().int(),
  registrationFee: z.number().int(),
  admissionFee: z.number().int(),
  cautionMoney: z.number().int(),
  firstYearExtras: z.number().int(),
  totalThisYear: z.number().int(),
  quarterlyInstallment: z.number().int(),
  monthlyEmi: z.number().int(),
  paidAmount: z.number().int(),
  dueAmount: z.number().int(),
  paymentStatus: StudentPaymentStatusSchema,
});
export type StudentFeeBreakdown = z.infer<typeof StudentFeeBreakdownSchema>;

export const StudentHostelInfoSchema = z.object({
  block: z.string().nullable(),
  roomNo: z.string().nullable(),
  roomType: z.string().nullable(),
  floor: z.string().nullable(),
  roommates: z.string().nullable(),
  bloodGroup: z.string().nullable(),
  homeCity: z.string().nullable(),
  homeState: z.string().nullable(),
  homeAddress: z.string().nullable(),
});
export type StudentHostelInfo = z.infer<typeof StudentHostelInfoSchema>;

export const SiblingRowSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  class: z.string(),
  section: z.string(),
  status: StudentStatusSchema,
});
export type SiblingRow = z.infer<typeof SiblingRowSchema>;

export const StudentFamilySummarySchema = z.object({
  familyId: z.number().int(),
  fatherName: z.string().nullable(),
  siblingCount: z.number().int(),
});
export type StudentFamilySummary = z.infer<typeof StudentFamilySummarySchema>;

export const StudentDetailSchema = z.object({
  // Core (mirrors StudentSchema)
  srNumber: z.number().int(),
  studentName: z.string(),
  fatherName: z.string().nullable(),
  motherName: z.string().nullable(),
  dob: z.string().nullable(),
  age: z.number().int().nullable(),
  gender: GenderSchema.nullable(),
  bloodGroup: z.string().nullable(),
  address: z.string().nullable(),
  class: z.string(),
  section: z.string(),
  stream: z.string().nullable(),
  subStream: z.string().nullable(),
  schoolName: z.string().nullable(),
  board: z.string().nullable(),
  status: StudentStatusSchema,
  isHostel: z.boolean(),
  familyId: z.number().int().nullable(),

  // Parent + extra contact numbers
  fatherContact: z.string().nullable(),
  fatherWhatsapp: z.string().nullable(),
  motherContact: z.string().nullable(),
  motherWhatsapp: z.string().nullable(),
  callingNumber: z.string().nullable(),
  whatsappNumber: z.string().nullable(),

  // Local guardian (relevant for hostellers + day scholars alike)
  localGuardianName: z.string().nullable(),
  guardianRelation: z.string().nullable(),
  localGuardianContact: z.string().nullable(),
  localGuardianWhatsapp: z.string().nullable(),
  localGuardianAddress: z.string().nullable(),

  // Specialised contacts (academic / fee)
  academicContactPerson: z.string().nullable(),
  academicCallingNumber: z.string().nullable(),
  academicWhatsappNumber: z.string().nullable(),
  feeContactPerson: z.string().nullable(),
  feeCallingNumber: z.string().nullable(),
  feeWhatsappNumber: z.string().nullable(),

  // Pickup point — prefer joined pickup_points row, fall back to inline
  pickupPointId: z.number().int().nullable(),
  pickupName: z.string().nullable(),
  pickupDistanceKm: z.number().nullable(),
  pickupLatitude: z.number().nullable(),
  pickupLongitude: z.number().nullable(),
  pickupMapsLink: z.string().nullable(),

  // Hostel-specific block (boarders only)
  hostel: StudentHostelInfoSchema.nullable(),

  // Family summary + siblings (excluding this student)
  family: StudentFamilySummarySchema.nullable(),
  siblings: z.array(SiblingRowSchema),

  // Fee breakdown for the current session (or null if no fee row yet)
  fees: StudentFeeBreakdownSchema.nullable(),

  // Audit
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StudentDetail = z.infer<typeof StudentDetailSchema>;
