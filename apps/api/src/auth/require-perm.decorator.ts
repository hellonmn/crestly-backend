import {
  SetMetadata,
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  applyDecorators,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CurrentUser } from "@crestly/shared";

const PERM_KEY = "requiredPerm";

/** Guard that checks the JWT-resolved user holds the required permission key. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(PERM_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: CurrentUser }>().user;
    if (!user) throw new ForbiddenException();
    if (!user.permissions.includes(required)) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}

/** Equivalent of erp/lib/auth.php :: require_perm('x.y'). */
export const RequirePerm = (key: string) =>
  applyDecorators(SetMetadata(PERM_KEY, key), UseGuards(PermissionsGuard));
