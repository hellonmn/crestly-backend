import { z } from "zod";

/* ============================================================
   HDFC SmartGateway hosted-checkout flow.

   1. Admin (or parent-portal) calls POST /api/fees/student/:sr/checkout
      → API creates an HDFC session, returns { orderId, checkoutUrl,
      expiresAt }. orderId is stored in fee_payment_attempts.
   2. Parent visits checkoutUrl → completes payment on HDFC.
   3. HDFC redirects parent to GET /api/pay/return?order_id=…&status=…
      → API verifies signature, marks the attempt success/failure,
      creates a fee_payment row + updates studentFee.
   4. HDFC also sends a server-to-server POST /api/pay/webhook for
      reliability. Idempotent on order_id.
   ============================================================ */

export const CheckoutCreateSchema = z.object({
  /** Rupees (no paise). HDFC expects two-decimal precision so we
   *  multiply by 100 internally. */
  amount: z.number().int().positive().max(10_000_000),
  /** Parent's notes — surfaces on the receipt + WhatsApp share. */
  notes: z.string().max(255).nullable().optional(),
});
export type CheckoutCreateInput = z.infer<typeof CheckoutCreateSchema>;

export const CheckoutSessionSchema = z.object({
  orderId: z.string(),
  /** Hosted-page URL the parent opens. */
  checkoutUrl: z.string().url(),
  amount: z.number().int(),
  currency: z.string(),
  /** Short-lived: HDFC sessions expire in ~15 min. Local mirror. */
  expiresAt: z.string(),
  /** A pre-built WhatsApp deep-link the admin can tap to share. */
  whatsappShareUrl: z.string().nullable(),
});
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;

export const PaymentAttemptStatusSchema = z.enum([
  "created", "pending", "success", "failed", "cancelled", "expired",
]);
export type PaymentAttemptStatus = z.infer<typeof PaymentAttemptStatusSchema>;

export const PaymentAttemptSchema = z.object({
  orderId: z.string(),
  srNumber: z.number().int(),
  sessionCode: z.string(),
  amount: z.number().int(),
  status: PaymentAttemptStatusSchema,
  receiptNo: z.string().nullable(),
  feePaymentId: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type PaymentAttempt = z.infer<typeof PaymentAttemptSchema>;
