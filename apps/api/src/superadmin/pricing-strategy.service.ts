import { Injectable } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { PricingStrategy } from "@crestly/shared";

const KEY = "pricing.tiers_json";

const DEFAULT_TIERS: PricingStrategy = {
  tiers: [
    {
      key: "starter", label: "Starter", monthly: 4999,
      description: "Single school, up to 500 students.",
      features: ["dashboard", "students", "fees", "attendance"],
      highlighted: false,
    },
    {
      key: "growth", label: "Growth", monthly: 9999,
      description: "Everything in Starter + exams, timetable, hostel, transport.",
      features: ["dashboard", "students", "fees", "attendance", "exams", "timetable", "hostel", "transport"],
      highlighted: true,
    },
    {
      key: "scale", label: "Scale", monthly: 19999,
      description: "All modules + WhatsApp + online payments + parent portal.",
      features: ["*"],
      highlighted: false,
    },
  ],
};

@Injectable()
export class PricingStrategyService {
  constructor(private readonly tenants: TenantService) {}

  async get(): Promise<PricingStrategy> {
    const row = await this.tenants.platform.app_settings.findUnique({ where: { setting_key: KEY } });
    if (!row?.setting_value) return DEFAULT_TIERS;
    try {
      const parsed = JSON.parse(row.setting_value) as PricingStrategy;
      return parsed;
    } catch {
      return DEFAULT_TIERS;
    }
  }

  async save(strategy: PricingStrategy, userId: number): Promise<PricingStrategy> {
    const v = JSON.stringify(strategy);
    await this.tenants.platform.app_settings.upsert({
      where: { setting_key: KEY },
      update: { setting_value: v, updated_by: userId, updated_at: new Date() },
      create: { setting_key: KEY, setting_value: v, updated_by: userId },
    });
    return strategy;
  }
}
