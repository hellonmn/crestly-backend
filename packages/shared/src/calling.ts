import { z } from "zod";

/* ============================================================
   Masked calling.

   Parent ↔ staff phone calls where NEITHER party sees the other's
   real number — the provider bridges both legs behind a virtual
   caller-id (an "ExoPhone"). Same model Uber/Blinkit use for
   rider ↔ driver calls.

   Provider: Exotel (chosen for India). Settings are tenant-scoped,
   stored in `app_settings` under "exotel.*" keys — mirrors how the
   AI assistant keeps its provider config.

   The contact page also gates the *call* button by office/duty
   hours: outside the window the client shows WhatsApp only. WhatsApp
   itself routes through the school's WhatsApp number (existing
   whatsapp module), so personal numbers are never exposed either.
   ============================================================ */

export const CALL_PROVIDERS = ["exotel"] as const;
export const CallProviderSchema = z.enum(CALL_PROVIDERS);
export type CallProvider = z.infer<typeof CallProviderSchema>;

/** Settings surface returned to the staff settings page (secrets masked). */
export const CallingSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: CallProviderSchema,
  sid: z.string().nullable(),
  /** Exotel API host — api.exotel.com (default) or api.in.exotel.com. */
  subdomain: z.string(),
  /** The ExoPhone both parties see as the caller id. */
  callerId: z.string().nullable(),
  /** Masked preview of the API key, never the full value. */
  apiKey: z.string().nullable(),
  hasApiKey: z.boolean(),
  hasApiToken: z.boolean(),
});
export type CallingSettings = z.infer<typeof CallingSettingsSchema>;

export const CallingSettingsUpdateSchema = z.object({
  enabled: z.boolean(),
  provider: CallProviderSchema.default("exotel"),
  sid: z.string().max(120).nullable().optional(),
  subdomain: z.string().max(120).default("api.exotel.com"),
  callerId: z.string().max(20).nullable().optional(),
  // Secret write-through semantics (same as AI settings):
  //   undefined / null → leave existing untouched
  //   ""               → clear
  //   any other string → overwrite
  apiKey: z.string().max(200).nullable().optional(),
  apiToken: z.string().max(200).nullable().optional(),
});
export type CallingSettingsUpdate = z.infer<typeof CallingSettingsUpdateSchema>;

/** Result of placing a masked call. Carries NO phone numbers. */
export const MaskedCallResultSchema = z.object({
  ok: z.boolean(),
  callId: z.string().nullable(),
  /** Provider status, e.g. "ringing" | "queued" | "in-progress". */
  status: z.string(),
  message: z.string().nullable(),
});
export type MaskedCallResult = z.infer<typeof MaskedCallResultSchema>;

export const MaskedCallRequestSchema = z.object({
  sr: z.number().int().positive(),
  /** users.id of the staff member to reach. */
  staffId: z.number().int().positive(),
});
export type MaskedCallRequest = z.infer<typeof MaskedCallRequestSchema>;

export const CallingTestResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});
export type CallingTestResult = z.infer<typeof CallingTestResultSchema>;
