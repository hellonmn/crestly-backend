import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { CatalogUpsertInput, PlatformFeature } from "@crestly/shared";

@Injectable()
export class CatalogAdminService {
  constructor(private readonly tenants: TenantService) {}

  async list(): Promise<PlatformFeature[]> {
    const rows = await this.tenants.platform.platform_features.findMany({
      orderBy: [{ category: "asc" }, { sort_order: "asc" }],
    });
    return rows.map((f) => ({
      featureKey: f.feature_key,
      label: f.label,
      description: f.description,
      benefit: f.benefit ?? null,
      category: f.category,
      monthlyPrice: f.monthly_price,
      isCore: f.is_core,
      sortOrder: f.sort_order,
    }));
  }

  async create(input: CatalogUpsertInput): Promise<PlatformFeature> {
    const clash = await this.tenants.platform.platform_features.findUnique({ where: { feature_key: input.featureKey } });
    if (clash) throw new ConflictException(`Feature key '${input.featureKey}' is already in use`);
    return this.upsert(input);
  }

  async update(featureKey: string, input: CatalogUpsertInput): Promise<PlatformFeature> {
    const existing = await this.tenants.platform.platform_features.findUnique({ where: { feature_key: featureKey } });
    if (!existing) throw new NotFoundException();
    return this.upsert({ ...input, featureKey });
  }

  async delete(featureKey: string): Promise<{ ok: true }> {
    await this.tenants.platform.platform_features.delete({ where: { feature_key: featureKey } });
    return { ok: true };
  }

  private async upsert(input: CatalogUpsertInput): Promise<PlatformFeature> {
    const row = await this.tenants.platform.platform_features.upsert({
      where: { feature_key: input.featureKey },
      update: {
        label: input.label,
        description: input.description ?? null,
        benefit: input.benefit ?? null,
        category: input.category,
        monthly_price: input.monthlyPrice,
        is_core: input.isCore,
        sort_order: input.sortOrder,
      },
      create: {
        feature_key: input.featureKey,
        label: input.label,
        description: input.description ?? null,
        benefit: input.benefit ?? null,
        category: input.category,
        monthly_price: input.monthlyPrice,
        is_core: input.isCore,
        sort_order: input.sortOrder,
      },
    });
    return {
      featureKey: row.feature_key, label: row.label,
      description: row.description, benefit: row.benefit ?? null,
      category: row.category, monthlyPrice: row.monthly_price,
      isCore: row.is_core, sortOrder: row.sort_order,
    };
  }
}
