import { Injectable } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { PlatformBilling, PlatformBillingUpdate } from "@crestly/shared";

const KEYS = {
  enabled: "razorpay.enabled",
  keyId: "razorpay.key_id",
  keySecret: "razorpay.key_secret",
  gstRate: "billing.gst_rate",
  invoicePrefix: "billing.invoice_prefix",
  invoiceSeq: "billing.invoice_seq",
} as const;

@Injectable()
export class PlatformBillingService {
  constructor(private readonly tenants: TenantService) {}

  async get(reveal = false): Promise<PlatformBilling> {
    const rows = await this.tenants.platform.app_settings.findMany({
      where: { setting_key: { in: Object.values(KEYS) as string[] } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
    const secret = map.get(KEYS.keySecret);
    return {
      enabled: map.get(KEYS.enabled) === "1",
      keyId: map.get(KEYS.keyId) ?? null,
      keySecret: secret ? (reveal ? secret : maskSecret(secret)) : null,
      gstRate: Number(map.get(KEYS.gstRate) ?? 18),
      invoicePrefix: map.get(KEYS.invoicePrefix) ?? "CR",
      invoiceSeq: Number(map.get(KEYS.invoiceSeq) ?? 1),
    };
  }

  async update(input: PlatformBillingUpdate, userId: number): Promise<PlatformBilling> {
    const updates: [string, string | null][] = [];
    if (input.enabled !== undefined) updates.push([KEYS.enabled, input.enabled ? "1" : "0"]);
    if (input.keyId !== undefined) updates.push([KEYS.keyId, input.keyId]);
    if (input.keySecret !== undefined && input.keySecret && !input.keySecret.startsWith("****")) {
      updates.push([KEYS.keySecret, input.keySecret]);
    }
    if (input.gstRate !== undefined) updates.push([KEYS.gstRate, String(input.gstRate)]);
    if (input.invoicePrefix !== undefined) updates.push([KEYS.invoicePrefix, input.invoicePrefix]);

    for (const [k, v] of updates) {
      await this.tenants.platform.app_settings.upsert({
        where: { setting_key: k },
        update: { setting_value: v, updated_by: userId, updated_at: new Date() },
        create: { setting_key: k, setting_value: v, updated_by: userId },
      });
    }
    return this.get();
  }
}

function maskSecret(s: string): string {
  if (s.length <= 8) return "****";
  return `****${s.slice(-4)}`;
}
