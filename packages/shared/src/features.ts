import { z } from "zod";

export const PlatformFeatureSchema = z.object({
  featureKey: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  benefit: z.string().nullable(),
  category: z.string(),
  monthlyPrice: z.number().int().nonnegative(),
  isCore: z.boolean(),
  sortOrder: z.number().int(),
});
export type PlatformFeature = z.infer<typeof PlatformFeatureSchema>;

export const SchoolFeatureSchema = PlatformFeatureSchema.extend({
  enabled: z.boolean(),
});
export type SchoolFeature = z.infer<typeof SchoolFeatureSchema>;

export const FeaturesCatalogResponseSchema = z.object({
  managed: z.boolean(),
  monthlyTotal: z.number().int(),
  features: z.array(SchoolFeatureSchema),
});
export type FeaturesCatalogResponse = z.infer<typeof FeaturesCatalogResponseSchema>;

// --- Razorpay purchase ---

export const RazorpayOrderResponseSchema = z.object({
  orderId: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  keyId: z.string(),
  featureLabel: z.string(),
});
export type RazorpayOrderResponse = z.infer<typeof RazorpayOrderResponseSchema>;

export const RazorpayVerifyInputSchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});
export type RazorpayVerifyInput = z.infer<typeof RazorpayVerifyInputSchema>;

// --- HDFC payment gateway (per-tenant; for parent fee payments) ---

export const HdfcSettingsSchema = z.object({
  enabled: z.boolean(),
  environment: z.enum(["sandbox", "production"]),
  merchantId: z.string().nullable(),
  apiKey: z.string().nullable(),               // masked when returned
  endpointProd: z.string().nullable(),
  endpointSandbox: z.string().nullable(),
  returnPath: z.string().nullable(),
  webhookPath: z.string().nullable(),
});
export type HdfcSettings = z.infer<typeof HdfcSettingsSchema>;

export const HdfcSettingsUpdateSchema = HdfcSettingsSchema.partial();
export type HdfcSettingsUpdate = z.infer<typeof HdfcSettingsUpdateSchema>;
