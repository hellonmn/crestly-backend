import type { PrismaClient } from "@prisma/client";
import type { MaskedCallResult } from "@crestly/shared";

/* ============================================================
   Exotel masked-calling helpers.

   Free functions (not a service) so two callers can use them
   against DIFFERENT Prisma clients:
     • staff CallingService → request tenant client
     • parent portal        → TenantService.platform

   Config lives in `app_settings` under these keys:
     exotel.enabled    "1" | "0"
     exotel.provider   "exotel"
     exotel.sid        Exotel account SID
     exotel.subdomain  api.exotel.com | api.in.exotel.com
     exotel.caller_id  the ExoPhone shown to both parties
     exotel.api_key    Exotel API key   (stored plain — tenant-scoped)
     exotel.api_token  Exotel API token (stored plain — tenant-scoped)
   ============================================================ */

export const CALLING_KEYS = {
  enabled: "exotel.enabled",
  provider: "exotel.provider",
  sid: "exotel.sid",
  subdomain: "exotel.subdomain",
  callerId: "exotel.caller_id",
  apiKey: "exotel.api_key",
  apiToken: "exotel.api_token",
} as const;

export interface CallingConfig {
  enabled: boolean;
  provider: "exotel";
  sid: string;
  subdomain: string;
  callerId: string;
  apiKey: string;
  apiToken: string;
}

/** Read the raw (unmasked) calling config from a tenant's app_settings. */
export async function readCallingConfig(db: PrismaClient): Promise<CallingConfig> {
  const rows = await db.app_settings.findMany({
    where: { setting_key: { startsWith: "exotel." } },
  });
  const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? ""]));
  return {
    enabled: (map.get(CALLING_KEYS.enabled) ?? "0") === "1",
    provider: "exotel",
    sid: map.get(CALLING_KEYS.sid) ?? "",
    subdomain: map.get(CALLING_KEYS.subdomain) || "api.exotel.com",
    callerId: map.get(CALLING_KEYS.callerId) ?? "",
    apiKey: map.get(CALLING_KEYS.apiKey) ?? "",
    apiToken: map.get(CALLING_KEYS.apiToken) ?? "",
  };
}

/** True when the integration is enabled AND has the creds it needs to dial. */
export function isCallingUsable(cfg: CallingConfig): boolean {
  return (
    cfg.enabled &&
    !!cfg.sid &&
    !!cfg.apiKey &&
    !!cfg.apiToken &&
    !!cfg.callerId
  );
}

/**
 * Bridge a parent ↔ staff call through Exotel's "connect two numbers"
 * API. Exotel rings `from` first, then dials `to`; both parties see
 * `callerId` (the ExoPhone), so neither learns the other's number.
 *
 * https://developer.exotel.com/api/make-a-call-api#call-connect-two-numbers
 */
export async function placeMaskedCall(
  cfg: CallingConfig,
  fromPhone: string,
  toPhone: string,
): Promise<MaskedCallResult> {
  const url = `https://${cfg.subdomain}/v1/Accounts/${cfg.sid}/Calls/connect.json`;
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiToken}`).toString("base64");
  const form = new URLSearchParams({
    From: fromPhone,
    To: toPhone,
    CallerId: cfg.callerId,
    CallType: "trans",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: form.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        callId: null,
        status: "failed",
        message: `Exotel HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    // Exotel returns { Call: { Sid, Status, ... } }
    let callId: string | null = null;
    let status = "queued";
    try {
      const json = JSON.parse(text) as { Call?: { Sid?: string; Status?: string } };
      callId = json.Call?.Sid ?? null;
      status = json.Call?.Status ?? "queued";
    } catch {
      /* non-JSON success body — keep defaults */
    }
    return { ok: true, callId, status, message: null };
  } catch (e) {
    return { ok: false, callId: null, status: "failed", message: errMsg(e) };
  }
}

/** Lightweight credential check — fetches the Exotel account record. */
export async function pingExotel(cfg: CallingConfig): Promise<{ ok: boolean; error?: string }> {
  const url = `https://${cfg.subdomain}/v1/Accounts/${cfg.sid}.json`;
  const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiToken}`).toString("base64");
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
