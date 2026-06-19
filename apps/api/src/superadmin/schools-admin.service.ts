import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { TenantService } from "../tenant/tenant.service";
import { ppEncrypt } from "../tenant/crypto";
import type {
  PartnerSchoolDetail, PartnerSchoolListItem, SchoolListResponse, SchoolUpsert,
  SchoolFeatureToggle,
} from "@crestly/shared";

@Injectable()
export class SchoolsAdminService {
  private readonly platformKey: string;

  constructor(
    private readonly tenants: TenantService,
    config: ConfigService,
  ) {
    this.platformKey = config.getOrThrow<string>("PLATFORM_KEY");
  }

  async list(): Promise<SchoolListResponse> {
    const rows = await this.tenants.platform.partnerSchool.findMany({ orderBy: { id: "asc" } });
    const items: PartnerSchoolListItem[] = rows.map(toListItem);
    return {
      items,
      totals: {
        all: items.length,
        active: items.filter((s) => s.status === "active").length,
        onboarding: items.filter((s) => s.status === "onboarding").length,
        suspended: items.filter((s) => s.status === "suspended").length,
      },
    };
  }

  async findOne(id: number): Promise<PartnerSchoolDetail> {
    const s = await this.tenants.platform.partnerSchool.findUnique({ where: { id } });
    if (!s) throw new NotFoundException();
    return {
      ...toListItem(s),
      dbHost: s.dbHost,
      dbName: s.dbName,
      dbUser: s.dbUser,
      address: s.address,
      board: s.board,
      latitude: s.latitude ? Number(s.latitude) : null,
      longitude: s.longitude ? Number(s.longitude) : null,
      mapsLink: s.maps_link,
      geofenceSchoolM: s.geofence_school_m,
      geofenceDriverM: s.geofence_driver_m,
      brandColor: s.brandColor,
      logoPath: s.logoPath,
      notes: s.notes,
    };
  }

  async create(input: SchoolUpsert): Promise<PartnerSchoolDetail> {
    const clash = await this.tenants.platform.partnerSchool.findUnique({ where: { slug: input.slug } });
    if (clash) throw new ConflictException(`Slug '${input.slug}' is already in use`);
    if (!input.dbPassword) throw new BadRequestException("db_password is required for new schools");
    const created = await this.tenants.platform.partnerSchool.create({
      data: this.toDbCreate(input),
    });
    return this.findOne(created.id);
  }

  async update(id: number, input: SchoolUpsert): Promise<PartnerSchoolDetail> {
    await this.findOne(id);
    await this.tenants.platform.partnerSchool.update({
      where: { id },
      data: this.toDbUpdate(input),
    });
    return this.findOne(id);
  }

  async changeStatus(id: number, status: PartnerSchoolDetail["status"]): Promise<PartnerSchoolDetail> {
    await this.tenants.platform.partnerSchool.update({ where: { id }, data: { status } });
    return this.findOne(id);
  }

  /** Open a per-tenant Prisma client and run a trivial query to verify creds. */
  async testConnection(id: number): Promise<{ ok: true; tablesSeen: number } | { ok: false; error: string }> {
    try {
      const school = await this.tenants.platform.partnerSchool.findUnique({ where: { id } });
      if (!school) throw new NotFoundException();
      const prisma = this.tenants.clientForSchool(school);
      const result = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()`;
      return { ok: true, tablesSeen: Number(result[0]?.n ?? 0) };
    } catch (e) {
      return { ok: false, error: (e as Error).message.split("\n")[0]?.slice(0, 240) ?? "Unknown error" };
    }
  }

  async resetAdminPassword(id: number): Promise<{ ok: true; tempPassword: string }> {
    const school = await this.tenants.platform.partnerSchool.findUnique({ where: { id } });
    if (!school) throw new NotFoundException();
    const prisma = this.tenants.clientForSchool(school);
    const adminUser = await prisma.user.findFirst({
      where: { role: { slug: "admin" }, status: "active" },
      orderBy: { id: "asc" },
    });
    if (!adminUser) throw new BadRequestException("This school has no active admin user");

    const tempPassword = `Crestly@${Math.floor(1000 + Math.random() * 9000)}`;
    const hash = await bcrypt.hash(tempPassword, 10);
    await prisma.user.update({ where: { id: adminUser.id }, data: { passwordHash: hash } });
    return { ok: true, tempPassword };
  }

  // --- Feature management for this school ---

  async features(id: number) {
    const rows = await this.tenants.platform.school_features.findMany({ where: { school_id: id } });
    const all = await this.tenants.platform.platform_features.findMany({
      orderBy: [{ category: "asc" }, { sort_order: "asc" }],
    });
    const map = new Map(rows.map((r) => [r.feature_key, r.enabled]));
    const managed = rows.length > 0;
    return {
      managed,
      monthlyTotal: all
        .filter((f) => !f.is_core && (managed ? (map.get(f.feature_key) ?? false) : true))
        .reduce((s, f) => s + f.monthly_price, 0),
      features: all.map((f) => ({
        featureKey: f.feature_key,
        label: f.label,
        description: f.description,
        benefit: f.benefit ?? null,
        category: f.category,
        monthlyPrice: f.monthly_price,
        isCore: f.is_core,
        sortOrder: f.sort_order,
        enabled: f.is_core ? true : (managed ? (map.get(f.feature_key) ?? false) : true),
      })),
    };
  }

  async toggleFeature(id: number, input: SchoolFeatureToggle) {
    const row = await this.tenants.platform.school_features.upsert({
      where: { school_id_feature_key: { school_id: id, feature_key: input.featureKey } },
      update: { enabled: input.enabled },
      create: { school_id: id, feature_key: input.featureKey, enabled: input.enabled },
    });
    return { featureKey: row.feature_key, enabled: row.enabled };
  }

  // --- Helpers ---

  private toDbCreate(input: SchoolUpsert) {
    return {
      name: input.name,
      slug: input.slug,
      status: input.status,
      dbHost: input.dbHost,
      dbName: input.dbName,
      dbUser: input.dbUser,
      dbPassEnc: input.dbPassword ? ppEncrypt(input.dbPassword, this.platformKey) : null,
      contactPerson: input.contactPerson ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      address: input.address ?? null,
      board: input.board ?? null,
      brandColor: input.brandColor ?? null,
      logoPath: input.logoPath ?? null,
      plan: input.plan ?? null,
      notes: input.notes ?? null,
    };
  }

  private toDbUpdate(input: SchoolUpsert) {
    const data = this.toDbCreate(input);
    if (input.dbPassword == null) {
      // Don't overwrite the stored password when the form left it blank.
      delete (data as { dbPassEnc?: unknown }).dbPassEnc;
    }
    return data;
  }
}

function toListItem(s: {
  id: number; name: string; slug: string; status: "onboarding" | "active" | "suspended";
  city: string | null; state: string | null; plan: string | null;
  contactPerson: string | null; contactPhone: string | null; contactEmail: string | null;
  onboardedAt: Date | null; createdAt: Date | null;
}): PartnerSchoolListItem {
  return {
    id: s.id, name: s.name, slug: s.slug, status: s.status,
    city: s.city, state: s.state, plan: s.plan,
    contactPerson: s.contactPerson, contactPhone: s.contactPhone, contactEmail: s.contactEmail,
    onboardedAt: s.onboardedAt ? s.onboardedAt.toISOString() : null,
    createdAt: s.createdAt ? s.createdAt.toISOString() : null,
  };
}
