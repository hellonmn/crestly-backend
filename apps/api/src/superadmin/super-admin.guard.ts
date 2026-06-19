import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { TenantService } from "../tenant/tenant.service";

export interface SuperJwtPayload {
  sub: number;
  kind: "super";
  email: string;
}

export const SUPER_ADMIN_KEY = "isSuperAdmin";
export const SuperAdminOnly = () => Reflect.metadata(SUPER_ADMIN_KEY, true);

/**
 * Independent guard for /api/superadmin/*. Validates the JWT against the
 * `platform_admins` table — totally separate from tenant auth. The global
 * tenant JwtAuthGuard recognises this guard via the @Public() decorator on
 * the super-admin login controller; everywhere else we explicitly mark the
 * route as @Public() too and rely on this guard to do its own check.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenants: TenantService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    void this.reflector;
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token");
    const token = auth.slice(7);

    let payload: SuperJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<SuperJwtPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
    if (payload.kind !== "super") throw new UnauthorizedException("Not a super-admin token");

    const admin = await this.tenants.platform.platformAdmin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || admin.status !== "active") throw new UnauthorizedException("Inactive admin");

    (req as Request & { admin?: typeof admin }).admin = admin;
    return true;
  }
}
