import { z } from "zod";

// --- Auth ---

export const SuperLoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SuperLoginInput = z.infer<typeof SuperLoginInputSchema>;

export const SuperLoginResponseSchema = z.object({
  accessToken: z.string(),
  admin: z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    lastLoginAt: z.string().nullable(),
  }),
});
export type SuperLoginResponse = z.infer<typeof SuperLoginResponseSchema>;

export const SuperAdminProfileSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  status: z.enum(["active", "inactive"]),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type SuperAdminProfile = z.infer<typeof SuperAdminProfileSchema>;

export const SuperAdminUpsertSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(20).nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});
export type SuperAdminUpsert = z.infer<typeof SuperAdminUpsertSchema>;

export const SuperAccountUpdateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(20).nullable().optional(),
});
export type SuperAccountUpdate = z.infer<typeof SuperAccountUpdateSchema>;

export const SuperChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type SuperChangePassword = z.infer<typeof SuperChangePasswordSchema>;

// --- Schools ---

export const PartnerSchoolStatusSchema = z.enum(["onboarding", "active", "suspended"]);
export type PartnerSchoolStatus = z.infer<typeof PartnerSchoolStatusSchema>;

export const PartnerSchoolListItemSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  status: PartnerSchoolStatusSchema,
  city: z.string().nullable(),
  state: z.string().nullable(),
  plan: z.string().nullable(),
  contactPerson: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  onboardedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
});
export type PartnerSchoolListItem = z.infer<typeof PartnerSchoolListItemSchema>;

export const SchoolListResponseSchema = z.object({
  items: z.array(PartnerSchoolListItemSchema),
  totals: z.object({
    all: z.number().int(),
    active: z.number().int(),
    onboarding: z.number().int(),
    suspended: z.number().int(),
  }),
});
export type SchoolListResponse = z.infer<typeof SchoolListResponseSchema>;

export const PartnerSchoolDetailSchema = PartnerSchoolListItemSchema.extend({
  dbHost: z.string(),
  dbName: z.string(),
  dbUser: z.string(),
  address: z.string().nullable(),
  board: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  mapsLink: z.string().nullable(),
  geofenceSchoolM: z.number().int().nullable(),
  geofenceDriverM: z.number().int().nullable(),
  brandColor: z.string().nullable(),
  logoPath: z.string().nullable(),
  notes: z.string().nullable(),
});
export type PartnerSchoolDetail = z.infer<typeof PartnerSchoolDetailSchema>;

export const SchoolUpsertSchema = z.object({
  name: z.string().min(1).max(160),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  status: PartnerSchoolStatusSchema.default("onboarding"),
  dbHost: z.string().min(1).max(120),
  dbName: z.string().min(1).max(120),
  dbUser: z.string().min(1).max(120),
  dbPassword: z.string().max(128).nullable().optional(),     // null → keep existing
  contactPerson: z.string().max(120).nullable().optional(),
  contactPhone: z.string().max(20).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  board: z.string().max(60).nullable().optional(),
  brandColor: z.string().max(16).nullable().optional(),
  logoPath: z.string().max(255).nullable().optional(),
  plan: z.string().max(40).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type SchoolUpsert = z.infer<typeof SchoolUpsertSchema>;

// --- Per-school feature management ---

export const SchoolFeatureToggleSchema = z.object({
  featureKey: z.string().min(1).max(40),
  enabled: z.boolean(),
});
export type SchoolFeatureToggle = z.infer<typeof SchoolFeatureToggleSchema>;

// --- Master catalog management ---

export const CatalogUpsertSchema = z.object({
  featureKey: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  description: z.string().max(255).nullable().optional(),
  benefit: z.string().max(2000).nullable().optional(),
  category: z.string().max(40).default("General"),
  monthlyPrice: z.number().int().nonnegative(),
  isCore: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});
export type CatalogUpsertInput = z.infer<typeof CatalogUpsertSchema>;

// --- Billing (platform-side Razorpay creds) ---

export const PlatformBillingSchema = z.object({
  enabled: z.boolean(),
  keyId: z.string().nullable(),
  keySecret: z.string().nullable(),         // masked
  gstRate: z.number(),
  invoicePrefix: z.string(),
  invoiceSeq: z.number().int(),
});
export type PlatformBilling = z.infer<typeof PlatformBillingSchema>;

export const PlatformBillingUpdateSchema = PlatformBillingSchema.partial();
export type PlatformBillingUpdate = z.infer<typeof PlatformBillingUpdateSchema>;

// --- Purchases / ledger ---

export const FeaturePurchaseRowSchema = z.object({
  id: z.number().int(),
  schoolId: z.number().int(),
  schoolName: z.string(),
  featureKey: z.string(),
  amount: z.number().int(),
  gateway: z.string(),
  orderId: z.string().nullable(),
  paymentId: z.string().nullable(),
  status: z.string(),
  invoiceNo: z.string().nullable(),
  gstAmount: z.number().int().nullable(),
  totalAmount: z.number().int().nullable(),
  createdAt: z.string().nullable(),
  paidAt: z.string().nullable(),
});
export type FeaturePurchaseRow = z.infer<typeof FeaturePurchaseRowSchema>;

export const PlatformLedgerOverviewSchema = z.object({
  totalCollected: z.number().int(),
  pending: z.number().int(),
  failed: z.number().int(),
  bySchool: z.array(z.object({
    schoolId: z.number().int(),
    schoolName: z.string(),
    purchases: z.number().int(),
    revenue: z.number().int(),
  })),
  recent: z.array(FeaturePurchaseRowSchema),
});
export type PlatformLedgerOverview = z.infer<typeof PlatformLedgerOverviewSchema>;

// --- Pricing strategy ---

export const PricingTierSchema = z.object({
  key: z.string(),
  label: z.string(),
  monthly: z.number().int(),
  description: z.string().nullable(),
  features: z.array(z.string()),
  highlighted: z.boolean().default(false),
});
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const PricingStrategySchema = z.object({
  tiers: z.array(PricingTierSchema),
});
export type PricingStrategy = z.infer<typeof PricingStrategySchema>;

// --- Marketing enquiries ---

export const MarketingLeadSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  schoolName: z.string().nullable(),
  city: z.string().nullable(),
  message: z.string().nullable(),
  status: z.string(),
  createdAt: z.string().nullable(),
});
export type MarketingLead = z.infer<typeof MarketingLeadSchema>;

// --- Upgrades (tenant DB migrations) ---

export const UpgradePlanSchema = z.object({
  schools: z.array(z.object({
    id: z.number().int(),
    name: z.string(),
    slug: z.string(),
    applied: z.array(z.string()),
    pending: z.array(z.string()),
  })),
  availableMigrations: z.array(z.string()),
});
export type UpgradePlan = z.infer<typeof UpgradePlanSchema>;

export const ApplyUpgradeSchema = z.object({
  schoolId: z.number().int(),
  migrationName: z.string().min(1).max(120).optional(),  // omit → run every pending
});
export type ApplyUpgradeInput = z.infer<typeof ApplyUpgradeSchema>;

export const ApplyUpgradeResponseSchema = z.object({
  schoolId: z.number().int(),
  applied: z.array(z.string()),
  skipped: z.array(z.string()),
  errors: z.array(z.object({ migration: z.string(), message: z.string() })),
});
export type ApplyUpgradeResponse = z.infer<typeof ApplyUpgradeResponseSchema>;
