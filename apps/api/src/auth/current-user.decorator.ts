import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { CurrentUser as UserShape } from "@crestly/shared";

export const CurrentUser = createParamDecorator<keyof UserShape | undefined>(
  (field, ctx: ExecutionContext): UserShape | UserShape[keyof UserShape] => {
    const req = ctx.switchToHttp().getRequest<{ user: UserShape }>();
    return field ? req.user[field] : req.user;
  },
);
