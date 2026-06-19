import { z } from "zod";

export const AccountStatusSchema = z.enum(["active", "inactive"]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const UserGenderSchema = z.enum(["Male", "Female", "Other"]);
export type UserGender = z.infer<typeof UserGenderSchema>;

/**
 * Team member as returned by the API. Matches the introspected `users`
 * table; only fields the team screens actually surface are included here.
 */
export const TeamMemberSchema = z.object({
  id: z.number().int(),
  employeeId: z.string().nullable(),
  name: z.string().min(1).max(120),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  gender: UserGenderSchema.nullable(),
  dob: z.string().nullable(),
  dateOfJoining: z.string().nullable(),
  experienceYears: z.number().int().nullable(),
  qualification: z.string().nullable(),
  employmentType: z.string().nullable(),
  classTeacherOf: z.string().nullable(),
  reportsTo: z.string().nullable(),
  reportingUserId: z.number().int().nullable(),
  geofencePickupId: z.number().int().nullable(),
  whatsapp: z.string().nullable(),
  emergencyContact: z.string().nullable(),
  address: z.string().nullable(),
  bloodGroup: z.string().nullable(),
  monthlySalary: z.number().int().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  roleId: z.number().int().nullable(),
  roleSlug: z.string().nullable(),
  roleName: z.string().nullable(),
  status: AccountStatusSchema,
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const TeamListQuerySchema = z.object({
  q: z.string().optional(),
  department: z.string().optional(),
  roleSlug: z.string().optional(),
  status: AccountStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});
export type TeamListQuery = z.infer<typeof TeamListQuerySchema>;

export const TeamDepartmentCountSchema = z.object({
  department: z.string(),
  count: z.number().int().nonnegative(),
});
export type TeamDepartmentCount = z.infer<typeof TeamDepartmentCountSchema>;

export const TeamListResponseSchema = z.object({
  items: z.array(TeamMemberSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  /** Active / inactive totals across ALL users (not just the page). */
  totalActive: z.number().int().nonnegative(),
  totalInactive: z.number().int().nonnegative(),
  /** Distinct departments with active member counts — feeds the
   *  department-pill row + the dropdown. */
  departments: z.array(TeamDepartmentCountSchema),
  /** Total distinct roles in the system — feeds the "Roles" stat tile. */
  rolesCount: z.number().int().nonnegative(),
});
export type TeamListResponse = z.infer<typeof TeamListResponseSchema>;

export const TeamUpsertSchema = TeamMemberSchema.omit({
  id: true,
  roleSlug: true,
  roleName: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
});
export type TeamUpsert = z.infer<typeof TeamUpsertSchema>;

export const SetPasswordSchema = z.object({
  password: z.string().min(8).max(255),
});
export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;

// --- Roles + Permissions ---

export const RoleSchema = z.object({
  id: z.number().int(),
  slug: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  permissions: z.array(z.string()),
});
export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.object({
  id: z.number().int(),
  permKey: z.string(),
  label: z.string(),
  module: z.string(),
  sortOrder: z.number().int(),
});
export type Permission = z.infer<typeof PermissionSchema>;

export const RolePermToggleSchema = z.object({
  permKey: z.string().min(1).max(60),
  enabled: z.boolean(),
});
export type RolePermToggle = z.infer<typeof RolePermToggleSchema>;
