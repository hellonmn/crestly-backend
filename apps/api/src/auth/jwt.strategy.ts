import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy, ExtractJwt } from "passport-jwt";
import type { Request } from "express";
import { AuthService } from "./auth.service";

interface JwtPayload {
  sub: number;
  schoolId: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    try {
      const user = await this.authService.resolveJwtSubject(payload);
      // Stash the tenant on the request so RequestPrismaService can grab it.
      (req as Request & { tenant?: unknown }).tenant = user._tenant;
      const { _tenant, ...publicUser } = user;
      return publicUser;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
