import { Injectable, OnModuleDestroy, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { ppDecrypt } from "./crypto";

export interface SchoolCreds {
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPass: string;
}

export interface TenantContext {
  schoolId: number;
  schoolName: string;
  schoolSlug: string;
  /** Prisma client bound to the tenant's database. */
  prisma: PrismaClient;
}

/**
 * Resolves the tenant for a given request and hands out a PrismaClient
 * bound to that school's database.
 *
 * Mirrors erp/config/db.php + erp/lib/tenant.php:
 *   - `activate_tenant($id)` → `getContextBySchoolId(id)`
 *   - `use_tenant($creds)`   → an internal cached PrismaClient per host|db|user
 *
 * Multiple tenant rows in the registry that resolve to the same physical
 * database (e.g. the "founding" partner row pointing at the platform DB)
 * share a single pooled PrismaClient, just like the PHP PDO pool.
 *
 * Dev-environment host override
 * ------------------------------
 * partner_schools.db_host is written from inside Hostinger as 'localhost',
 * which is correct for the production runtime but useless from a developer's
 * laptop. When the platform DATABASE_URL points at a remote host (i.e. dev
 * is using a remote Hostinger DB), we override 'localhost' / '127.0.0.1'
 * with that same remote host. Production deploys see DATABASE_URL pointing
 * at localhost too, so the override is a no-op there.
 */
@Injectable()
export class TenantService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantService.name);
  private readonly platformPrisma: PrismaClient;
  private readonly tenantPool = new Map<string, PrismaClient>();
  private readonly platformKey: string;
  private readonly platformHost: string;
  private readonly platformPort: number;

  constructor(private readonly config: ConfigService) {
    const dbUrl = this.requireEnv("DATABASE_URL");
    this.platformKey = this.requireEnv("PLATFORM_KEY");

    const parsed = new URL(dbUrl);
    this.platformHost = parsed.hostname;
    this.platformPort = parsed.port ? Number(parsed.port) : 3306;

    this.platformPrisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });

    if (this.platformHost !== "localhost" && this.platformHost !== "127.0.0.1") {
      this.logger.log(
        `Dev override active: tenant db_host='localhost' will be rewritten to '${this.platformHost}:${this.platformPort}'.`,
      );
    }
  }

  /** Platform DB — partner_schools registry + founding school's own data. */
  get platform(): PrismaClient {
    return this.platformPrisma;
  }

  async findAllActiveSchools() {
    return this.platformPrisma.partnerSchool.findMany({
      where: { status: "active" },
      orderBy: { id: "asc" },
    });
  }

  async getContextBySchoolId(schoolId: number): Promise<TenantContext> {
    const school = await this.platformPrisma.partnerSchool.findUnique({
      where: { id: schoolId },
    });
    if (!school || school.status === "suspended") {
      throw new InternalServerErrorException(`Tenant ${schoolId} not available`);
    }
    return {
      schoolId: school.id,
      schoolName: school.name,
      schoolSlug: school.slug,
      prisma: this.clientFor(this.credsFor(school)),
    };
  }

  /** Open (or reuse) a PrismaClient for the given school row. */
  clientForSchool(school: {
    dbHost: string;
    dbName: string;
    dbUser: string;
    dbPassEnc: string | null;
  }): PrismaClient {
    return this.clientFor(this.credsFor(school));
  }

  credsFor(school: {
    dbHost: string;
    dbName: string;
    dbUser: string;
    dbPassEnc: string | null;
  }): SchoolCreds {
    const rawHost = school.dbHost || "localhost";
    const isLocal = rawHost === "localhost" || rawHost === "127.0.0.1";
    return {
      // If the registry says localhost but our platform connection is remote,
      // override to the same remote host. See class-level docblock.
      dbHost: isLocal ? this.platformHost : rawHost,
      dbPort: isLocal ? this.platformPort : 3306,
      dbName: school.dbName,
      dbUser: school.dbUser,
      dbPass: ppDecrypt(school.dbPassEnc, this.platformKey) ?? "",
    };
  }

  private clientFor(creds: SchoolCreds): PrismaClient {
    const key = `${creds.dbHost}:${creds.dbPort}|${creds.dbName}|${creds.dbUser}`;
    const existing = this.tenantPool.get(key);
    if (existing) return existing;

    const url = `mysql://${encodeURIComponent(creds.dbUser)}:${encodeURIComponent(creds.dbPass)}@${creds.dbHost}:${creds.dbPort}/${creds.dbName}`;
    const client = new PrismaClient({ datasources: { db: { url } } });
    this.tenantPool.set(key, client);
    return client;
  }

  private requireEnv(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) throw new Error(`Missing env: ${key}`);
    return v;
  }

  async onModuleDestroy() {
    await this.platformPrisma.$disconnect();
    await Promise.all([...this.tenantPool.values()].map((c) => c.$disconnect()));
  }
}
