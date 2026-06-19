import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { TenantService } from "../tenant/tenant.service";
import type { CurrentUser } from "@crestly/shared";

interface JwtPayload {
  sub: number;        // user id within that school's DB
  schoolId: number;   // partner_schools.id
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Mirror of erp/lib/auth.php :: login_user().
   *
   * Iterates every active partner school, tries the (normalised) phone +
   * password against that school's `users` table. The first verifying hit wins.
   * On success returns a signed JWT plus the user's profile and permissions.
   */
  async login(phoneRaw: string, password: string) {
    const phone = phoneDigits(phoneRaw);
    if (!phone || !password) {
      throw new UnauthorizedException("Phone and password are required");
    }

    const schools = await this.tenants.findAllActiveSchools();
    for (const school of schools) {
      try {
        const prisma = this.tenants.clientForSchool(school);
        const user = await prisma.user.findFirst({
          where: { phone, status: "active" },
          select: { id: true, passwordHash: true },
        });
        if (!user?.passwordHash) continue;
        const ok = await bcrypt.compare(password, normalisePhpBcrypt(user.passwordHash));
        if (!ok) continue;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        const me = await this.loadCurrentUser(prisma, user.id, school);
        const token = await this.jwt.signAsync({ sub: user.id, schoolId: school.id } satisfies JwtPayload);
        return { accessToken: token, user: me };
      } catch (err) {
        // School DB unreachable / misconfigured — log and try the next.
        this.logger.warn(`Login probe failed for school ${school.id}: ${(err as Error).message}`);
        continue;
      }
    }
    throw new UnauthorizedException("Invalid phone or password");
  }

  /** Used by JwtStrategy.validate() to hydrate req.user on every request. */
  async resolveJwtSubject(payload: JwtPayload) {
    const tenant = await this.tenants.getContextBySchoolId(payload.schoolId);
    const user = await this.loadCurrentUser(tenant.prisma, payload.sub, {
      id: tenant.schoolId,
      name: tenant.schoolName,
    });
    return { ...user, _tenant: tenant };
  }

  private async loadCurrentUser(
    db: PrismaClient,
    userId: number,
    school: { id: number; name: string },
  ): Promise<CurrentUser> {
    const row = await db.user.findFirst({
      where: { id: userId, status: "active" },
      include: { role: true },
    });
    if (!row) throw new UnauthorizedException("User no longer active");

    let permissions: string[] = [];
    if (row.roleId) {
      const perms = await db.rolePermission.findMany({
        where: { roleId: row.roleId },
        include: { permission: { select: { permKey: true } } },
      });
      permissions = perms.map((p) => p.permission.permKey);
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone ?? "",
      roleSlug: row.role?.slug ?? null,
      roleName: row.role?.name ?? null,
      schoolId: school.id,
      schoolName: school.name,
      permissions,
    };
  }
}

/** Mirror of erp/lib/helpers.php :: phone_digits() — strip everything but digits. */
function phoneDigits(raw: string): string {
  return (raw ?? "").replace(/\D+/g, "");
}

/**
 * PHP's password_hash() emits hashes starting with $2y$. bcryptjs only
 * verifies $2a$ / $2b$. The algorithms are identical; swap the prefix
 * so PHP-issued hashes verify against bcryptjs.
 */
function normalisePhpBcrypt(hash: string): string {
  return hash.startsWith("$2y$") ? "$2a$" + hash.slice(4) : hash;
}
