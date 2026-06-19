import { z } from "zod";

/* ============================================================
   AI assistant — in-app chat backed by Groq (or any
   OpenAI-compatible endpoint). Settings live in app_settings
   under "ai.*" keys; per-tenant. The chat endpoint runs the
   user's message through the model with a tool-use loop so
   "today's fee collection" / "Rohit's fees" etc. resolve to
   live DB queries instead of hallucinations.
   ============================================================ */

export const AI_PROVIDERS = ["groq"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Models we offer in the picker. Curated subset of what Groq exposes;
 *  free-tier friendly (Llama 3 family). User can type a custom one too. */
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "llama3-8b-8192",
  "mixtral-8x7b-32768",
] as const;

export const AiSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().min(1).max(80),
  /** Masked when read (returns "****" + last 4 chars). Full string only on save. */
  apiKey: z.string().nullable(),
  /** True iff a key is actually configured (lets the UI hide the form behind a chip). */
  hasKey: z.boolean(),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

export const AiSettingsUpdateSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().min(1).max(80),
  /** Pass null to leave the existing key untouched; pass "" to clear it;
   *  pass a new string to overwrite. */
  apiKey: z.string().max(200).nullable().optional(),
});
export type AiSettingsUpdate = z.infer<typeof AiSettingsUpdateSchema>;

export const AiTestResultSchema = z.object({
  ok: z.boolean(),
  /** Round-trip latency in ms when ok=true. */
  latencyMs: z.number().int().optional(),
  /** Human error message when ok=false. */
  error: z.string().optional(),
  /** The model the test ran against. */
  model: z.string().optional(),
});
export type AiTestResult = z.infer<typeof AiTestResultSchema>;

/* ─────────────────── Chat ─────────────────── */

export const AiChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type AiChatMessage = z.infer<typeof AiChatMessageSchema>;

export const AiAskInputSchema = z.object({
  /** Conversation history (caller maintains it); the new user turn
   *  is the last item with role='user'. */
  messages: z.array(AiChatMessageSchema).min(1).max(40),
});
export type AiAskInput = z.infer<typeof AiAskInputSchema>;

export const AiAskResponseSchema = z.object({
  /** Plain-text assistant reply. */
  reply: z.string(),
  /** Tool calls the model made while answering — surfaced so the UI
   *  can show "I checked: fee_collection, student_lookup" chips. */
  toolsUsed: z.array(z.object({
    name: z.string(),
    args: z.unknown(),
    /** Short one-line summary of what the tool returned; useful for
     *  debugging. Not shown to the user by default. */
    resultSummary: z.string().optional(),
  })),
  /** Round-trip latency for the whole exchange (incl. tool dispatch). */
  latencyMs: z.number().int(),
});
export type AiAskResponse = z.infer<typeof AiAskResponseSchema>;
