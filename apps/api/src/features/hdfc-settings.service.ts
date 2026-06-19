import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { PrismaClient } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { HdfcSettings, HdfcSettingsUpdate } from "@crestly/shared";

const KEYS = {
  enabled: "hdfc_pg.enabled",
  environment: "hdfc_pg.environment",
  merchantId: "hdfc_pg.merchant_id",
  apiKeyEnc: "hdfc_pg.api_key_enc",
  endpointProd: "hdfc_pg.endpoint_prod",
  endpointSandbox: "hdfc_pg.endpoint_sandbox",
  returnPath: "hdfc_pg.return_path",
  webhookPath: "hdfc_pg.webhook_path",
} as const;

/**
 * HDFC SmartGateway settings. Per-tenant — credentials live in the school's
 * own app_settings table. The API key is encrypted at rest with AES-256-CBC
 * using a server-held KEK from env.PG_KEK (recommended) or PLATFORM_KEY
 * (fallback during dev).
 *
 * Parent-facing checkout is built in Batch H (parent portal).
 */
@Injectable()
export class HdfcSettingsService {
  private readonly kek: Buffer;

  constructor(
    private readonly prisma: RequestPrismaService,
    config: ConfigService,
  ) {
    const raw = config.get<string>("PG_KEK") ?? config.getOrThrow<string>("PLATFORM_KEY");
    this.kek = createHash("sha256").update(raw, "utf8").digest();
  }

  /**
   * Read the gateway settings. Pass `db` to read from a specific client
   * (e.g. the platform DB for the parent portal / public webhook, which
   * have no request-scoped tenant). Defaults to the request tenant.
   */
  async get(reveal = false, db?: PrismaClient): Promise<HdfcSettings> {
    const client = db ?? this.prisma.db;
    const rows = await client.app_settings.findMany({
      where: { setting_key: { startsWith: "hdfc_pg." } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
    const enc = map.get(KEYS.apiKeyEnc);
    return {
      enabled: map.get(KEYS.enabled) === "1",
      environment: (map.get(KEYS.environment) === "production" ? "production" : "sandbox"),
      merchantId: map.get(KEYS.merchantId) ?? null,
      apiKey: enc ? (reveal ? this.decrypt(enc) : "****set****") : null,
      endpointProd: map.get(KEYS.endpointProd) ?? "https://smartgateway.hdfcbank.com",
      endpointSandbox: map.get(KEYS.endpointSandbox) ?? "https://smartgatewayuat.hdfcbank.com",
      returnPath: map.get(KEYS.returnPath) ?? "/parent/pay-return",
      webhookPath: map.get(KEYS.webhookPath) ?? "/api/pay/webhook",
    };
  }

  async update(input: HdfcSettingsUpdate, userId: number): Promise<HdfcSettings> {
    const updates: [string, string | null][] = [];
    if (input.enabled !== undefined) updates.push([KEYS.enabled, input.enabled ? "1" : "0"]);
    if (input.environment !== undefined) updates.push([KEYS.environment, input.environment]);
    if (input.merchantId !== undefined) updates.push([KEYS.merchantId, input.merchantId]);
    if (input.apiKey !== undefined && input.apiKey && !input.apiKey.startsWith("****")) {
      updates.push([KEYS.apiKeyEnc, this.encrypt(input.apiKey)]);
    }
    if (input.endpointProd !== undefined) updates.push([KEYS.endpointProd, input.endpointProd]);
    if (input.endpointSandbox !== undefined) updates.push([KEYS.endpointSandbox, input.endpointSandbox]);
    if (input.returnPath !== undefined) updates.push([KEYS.returnPath, input.returnPath]);
    if (input.webhookPath !== undefined) updates.push([KEYS.webhookPath, input.webhookPath]);

    for (const [k, v] of updates) {
      await this.prisma.db.app_settings.upsert({
        where: { setting_key: k },
        update: { setting_value: v, updated_by: userId, updated_at: new Date() },
        create: { setting_key: k, setting_value: v, updated_by: userId },
      });
    }
    return this.get();
  }

  async clearKey(userId: number): Promise<HdfcSettings> {
    await this.prisma.db.app_settings.deleteMany({ where: { setting_key: KEYS.apiKeyEnc } });
    return this.get();
  }

  // --- AES-256-CBC at-rest crypto (random IV per value) ---

  private encrypt(plain: string): string {
    const iv = randomBytes(16);
    const c = createCipheriv("aes-256-cbc", this.kek, iv);
    const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
    return Buffer.concat([iv, ct]).toString("base64");
  }
  private decrypt(b64: string): string | null {
    try {
      const raw = Buffer.from(b64, "base64");
      const iv = raw.subarray(0, 16);
      const ct = raw.subarray(16);
      const d = createDecipheriv("aes-256-cbc", this.kek, iv);
      return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
    } catch { return null; }
  }
}
