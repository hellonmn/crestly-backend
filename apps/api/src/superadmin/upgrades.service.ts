import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { ApplyUpgradeInput, ApplyUpgradeResponse, UpgradePlan } from "@crestly/shared";

/**
 * Tenant DB migration applier — admin can roll out the latest schema changes
 * to every active school. Reuses the same migrations dir as the legacy PHP
 * `superadmin/upgrades.php`.
 *
 * For v1 we ship a single in-process "migrations" list — DB schema is the
 * same as `prisma db pull` produced, so the list below is the canonical set
 * the API expects. Add new SQL/PHP migrations here as the platform evolves.
 */
const REGISTRY: { name: string; sql: string[] }[] = [
  // Example placeholder: schema migrations are managed via Prisma in the
  // current setup. This service exists for parity with the PHP control plane;
  // populate REGISTRY as out-of-band ALTERs accumulate.
];

@Injectable()
export class UpgradesService {
  constructor(private readonly tenants: TenantService) {}

  async plan(): Promise<UpgradePlan> {
    const schools = await this.tenants.platform.partnerSchool.findMany({
      where: { status: { in: ["active", "onboarding"] } },
      orderBy: { id: "asc" },
    });
    const out: UpgradePlan = {
      availableMigrations: REGISTRY.map((m) => m.name),
      schools: [],
    };
    for (const s of schools) {
      const prisma = this.tenants.clientForSchool(s);
      const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM schema_migrations`.catch(
        () => [] as { name: string }[],
      );
      const applied = rows.map((r) => r.name);
      const pending = REGISTRY.filter((m) => !applied.includes(m.name)).map((m) => m.name);
      out.schools.push({ id: s.id, name: s.name, slug: s.slug, applied, pending });
    }
    return out;
  }

  async apply(input: ApplyUpgradeInput): Promise<ApplyUpgradeResponse> {
    const school = await this.tenants.platform.partnerSchool.findUnique({ where: { id: input.schoolId } });
    if (!school) throw new NotFoundException();
    const prisma = this.tenants.clientForSchool(school);

    // Ensure the bookkeeping table exists.
    await prisma.$executeRawUnsafe(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(120) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );

    const applied: string[] = [];
    const skipped: string[] = [];
    const errors: ApplyUpgradeResponse["errors"] = [];
    const candidates = input.migrationName
      ? REGISTRY.filter((m) => m.name === input.migrationName)
      : REGISTRY;

    const existing = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM schema_migrations`;
    const set = new Set(existing.map((r) => r.name));

    for (const m of candidates) {
      if (set.has(m.name)) { skipped.push(m.name); continue; }
      try {
        for (const stmt of m.sql) await prisma.$executeRawUnsafe(stmt);
        await prisma.$executeRawUnsafe(
          "INSERT INTO schema_migrations (name) VALUES (?)", m.name,
        );
        applied.push(m.name);
      } catch (e) {
        errors.push({ migration: m.name, message: (e as Error).message.slice(0, 240) });
      }
    }

    return { schoolId: input.schoolId, applied, skipped, errors };
  }
}
