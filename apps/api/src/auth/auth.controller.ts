import { Body, Controller, Get, HttpCode, Post, UsePipes } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { CurrentUser } from "./current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { LoginInputSchema } from "@crestly/shared";
import type { LoginInput, CurrentUser as User } from "@crestly/shared";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @UsePipes(new ZodPipe(LoginInputSchema))
  async login(@Body() body: LoginInput) {
    return this.auth.login(body.phone, body.password);
  }

  @Get("me")
  me(@CurrentUser() user: User) {
    return user;
  }
}
