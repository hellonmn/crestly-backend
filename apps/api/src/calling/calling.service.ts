import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  CallingSettings,
  CallingSettingsUpdate,
  CallingTestResult,
} from "@crestly/shared";
import { CALLING_KEYS, readCallingConfig, pingExotel } from "./calling.exotel";

/**
 * Staff-facing settings for the masked-calling integration (Exotel).
 * Mirrors AiService's settings pattern: KV rows in `app_settings`,
 * secrets masked on read, write-through on update.
 */
@Injectable()
export class CallingService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async getSettings(): Promise<CallingSettings> {
    const cfg = await readCallingConfig(this.prisma.db);
    return {
      enabled: cfg.enabled,
      provider: "exotel",
      sid: cfg.sid || null,
      subdomain: cfg.subdomain,
      callerId: cfg.callerId || null,
      apiKey: cfg.apiKey ? maskSecret(cfg.apiKey) : null,
      hasApiKey: cfg.apiKey.length > 0,
      hasApiToken: cfg.apiToken.length > 0,
    };
  }

  async updateSettings(input: CallingSettingsUpdate, userId: number): Promise<CallingSettings> {
    const writes: { key: string; value: string }[] = [
      { key: CALLING_KEYS.enabled, value: input.enabled ? "1" : "0" },
      { key: CALLING_KEYS.provider, value: input.provider },
      { key: CALLING_KEYS.subdomain, value: input.subdomain },
    ];
    if (input.sid !== undefined && input.sid !== null) {
      writes.push({ key: CALLING_KEYS.sid, value: input.sid });
    }
    if (input.callerId !== undefined && input.callerId !== null) {
      writes.push({ key: CALLING_KEYS.callerId, value: input.callerId });
    }
    // Secrets: only written when a concrete string is provided.
    if (input.apiKey !== undefined && input.apiKey !== null) {
      writes.push({ key: CALLING_KEYS.apiKey, value: input.apiKey });
    }
    if (input.apiToken !== undefined && input.apiToken !== null) {
      writes.push({ key: CALLING_KEYS.apiToken, value: input.apiToken });
    }

    for (const w of writes) {
      await this.prisma.db.app_settings.upsert({
        where: { setting_key: w.key },
        update: { setting_value: w.value, updated_by: userId, updated_at: new Date() },
        create: { setting_key: w.key, setting_value: w.value, updated_by: userId },
      });
    }
    return this.getSettings();
  }

  async testConnection(): Promise<CallingTestResult> {
    const cfg = await readCallingConfig(this.prisma.db);
    if (!cfg.sid || !cfg.apiKey || !cfg.apiToken) {
      return { ok: false, error: "Missing Exotel SID / API key / API token." };
    }
    return pingExotel(cfg);
  }
}

/** Show only the last 4 characters of a secret. */
function maskSecret(s: string): string {
  if (s.length <= 4) return "••••";
  return `••••${s.slice(-4)}`;
}
