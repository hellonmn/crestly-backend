import { Injectable, Inject, Scope, BadRequestException, NotFoundException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { createHmac } from "node:crypto";
import { TenantService } from "../tenant/tenant.service";
import { FeaturesService } from "./features.service";
import type { RazorpayOrderResponse, RazorpayVerifyInput } from "@crestly/shared";

/**
 * Razorpay platform feature store. Mirrors lib/feature_store.php.
 *  - createOrder() hits Razorpay /v1/orders and writes a feature_purchases row.
 *  - verify()       checks HMAC, flips status=paid, enables the feature for
 *                   the active school.
 *
 * Razorpay creds live in the PLATFORM `app_settings` under razorpay.key_id /
 * razorpay.key_secret. Configure them on the super-admin Billing page (Batch G).
 */
@Injectable({ scope: Scope.REQUEST })
export class RazorpayService {
  constructor(
    @Inject(REQUEST) private readonly req: Record<string, unknown>,
    private readonly tenants: TenantService,
    private readonly features: FeaturesService,
  ) {}

  private get schoolId(): number {
    const t = (this.req as { tenant?: { schoolId: number } }).tenant;
    if (!t) throw new Error("No tenant context");
    return t.schoolId;
  }

  private async creds() {
    // Razorpay settings live in the *platform* app_settings store. The platform
    // DB doubles as the founding-school tenant DB, so we go through `platform`.
    const rows = await this.tenants.platform.app_settings.findMany({
      where: { setting_key: { startsWith: "razorpay." } },
    });
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value]));
    return {
      enabled: map.get("razorpay.enabled") === "1",
      keyId: map.get("razorpay.key_id") ?? null,
      keySecret: map.get("razorpay.key_secret") ?? null,
    };
  }

  async createOrder(featureKey: string): Promise<RazorpayOrderResponse> {
    const feature = await this.tenants.platform.platform_features.findUnique({
      where: { feature_key: featureKey },
    });
    if (!feature) throw new NotFoundException(`Feature '${featureKey}' not found`);
    if (feature.is_core) throw new BadRequestException("Core features are always on; cannot be purchased.");
    if (feature.monthly_price <= 0) {
      throw new BadRequestException("This feature has no price set. Contact support.");
    }

    const creds = await this.creds();
    if (!creds.enabled || !creds.keyId || !creds.keySecret) {
      throw new BadRequestException("Razorpay is not configured on this platform.");
    }

    // 1 / Razorpay charges in paise.
    const amountPaise = feature.monthly_price * 100;
    const receipt = `f-${this.schoolId}-${featureKey}-${Date.now()}`.slice(0, 40);

    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.keyId}:${creds.keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt,
        notes: { school_id: this.schoolId, feature_key: featureKey },
      }),
    });
    if (!r.ok) {
      throw new BadRequestException(`Razorpay returned ${r.status}: ${(await r.text()).slice(0, 200)}`);
    }
    const order = (await r.json()) as { id: string; amount: number; currency: string };

    await this.tenants.platform.feature_purchases.create({
      data: {
        school_id: this.schoolId,
        feature_key: featureKey,
        amount: feature.monthly_price,
        currency: "INR",
        gateway: "razorpay",
        order_id: order.id,
        status: "created",
      },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: creds.keyId,
      featureLabel: feature.label,
    };
  }

  async verify(input: RazorpayVerifyInput): Promise<{ ok: true; featureKey: string }> {
    const creds = await this.creds();
    if (!creds.keySecret) throw new BadRequestException("Razorpay not configured.");

    const expected = createHmac("sha256", creds.keySecret)
      .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
      .digest("hex");
    if (expected !== input.razorpaySignature) {
      throw new BadRequestException("Signature verification failed.");
    }

    const purchase = await this.tenants.platform.feature_purchases.findFirst({
      where: { order_id: input.razorpayOrderId, school_id: this.schoolId },
    });
    if (!purchase) throw new NotFoundException("Order not found for this school.");

    await this.tenants.platform.feature_purchases.update({
      where: { id: purchase.id },
      data: {
        status: "paid",
        payment_id: input.razorpayPaymentId,
        paid_at: new Date(),
      },
    });

    // Activate the feature for this school.
    await this.features.enable(purchase.feature_key);

    return { ok: true, featureKey: purchase.feature_key };
  }
}
