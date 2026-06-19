import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

/** Shape of the JWT payload signed in ParentService.login(). */
export interface ParentJwtPayload {
  kind: "parent";
  phone: string;
  familyId: number | null;
  srs: number[];
  iat?: number;
  exp?: number;
}

/** Convenience type for handlers that read req.parent. */
export type RequestWithParent = Request & { parent?: ParentJwtPayload };

/**
 * Guards parent-portal routes. Verifies the Bearer token and ensures the
 * payload was issued by the parent flow (kind:"parent") — not a staff
 * JWT that happens to share the same secret. Attaches the decoded
 * payload to req.parent so handlers can read which kids are in scope.
 */
@Injectable()
export class ParentJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithParent>();
    const authz = (req.headers["authorization"] ?? "") as string;
    const token = authz.replace(/^Bearer\s+/i, "");
    if (!token) throw new UnauthorizedException("Parent session missing.");

    let payload: ParentJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<ParentJwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Parent session invalid or expired.");
    }
    if (payload.kind !== "parent" || !Array.isArray(payload.srs) || payload.srs.length === 0) {
      throw new UnauthorizedException("Not a parent token.");
    }
    req.parent = payload;
    return true;
  }
}
