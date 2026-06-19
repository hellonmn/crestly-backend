import { Injectable, Inject, Scope } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { TenantService } from "../tenant/tenant.service";
import type { FeaturesCatalogResponse, SchoolFeature } from "@crestly/shared";

/**
 * Platform feature flag store.
 *
 *   - `platform_features` table (in the PLATFORM DB) is the canonical catalog
 *     with monthly_price + is_core.
 *   - `school_features(school_id, feature_key, enabled)` records per-school
 *     overrides. A school with NO rows is "grandfathered" — all features on.
 *
 * Mirrors lib/feature_store.php's behaviour.
 */
@Injectable({ scope: Scope.REQUEST })
export class FeaturesService {
  constructor(
    @Inject(REQUEST) private readonly req: Record<string, unknown>,
    private readonly tenants: TenantService,
  ) {}

  /** Active tenant's school id, set by JwtStrategy at request time. */
  private get schoolId(): number {
    const t = (this.req as { tenant?: { schoolId: number } }).tenant;
    if (!t) throw new Error("No tenant context");
    return t.schoolId;
  }

  async catalog(): Promise<FeaturesCatalogResponse> {
    const all = await this.tenants.platform.platform_features.findMany({
      orderBy: [{ category: "asc" }, { sort_order: "asc" }],
    });
    const rows = await this.tenants.platform.school_features.findMany({
      where: { school_id: this.schoolId },
    });
    const managed = rows.length > 0;
    const stored = new Map(rows.map((r) => [r.feature_key, r.enabled]));

    const features: SchoolFeature[] = all.map((f) => ({
      featureKey: f.feature_key,
      label: f.label,
      description: f.description,
      benefit: f.benefit ?? null,
      category: f.category,
      monthlyPrice: f.monthly_price,
      isCore: f.is_core,
      sortOrder: f.sort_order,
      enabled: f.is_core ? true : (managed ? (stored.get(f.feature_key) ?? false) : true),
    }));

    const monthlyTotal = features
      .filter((f) => f.enabled && !f.isCore)
      .reduce((s, f) => s + f.monthlyPrice, 0);

    return { managed, monthlyTotal, features };
  }

  /** Boolean shortcut — used by FeatureGuard. */
  async isOn(key: string): Promise<boolean> {
    const catalog = await this.catalog();
    const f = catalog.features.find((x) => x.featureKey === key);
    return !!f && f.enabled;
  }

  /** Enable a feature for the active school after successful payment. */
  async enable(featureKey: string) {
    await this.tenants.platform.school_features.upsert({
      where: { school_id_feature_key: { school_id: this.schoolId, feature_key: featureKey } },
      update: { enabled: true },
      create: { school_id: this.schoolId, feature_key: featureKey, enabled: true },
    });
  }
}
