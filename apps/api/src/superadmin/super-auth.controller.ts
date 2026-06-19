import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards, UsePipes } from "@nestjs/common";
import { Request } from "express";
import { SuperAuthService } from "./super-auth.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  SuperAccountUpdateSchema, SuperChangePasswordSchema, SuperLoginInputSchema,
} from "@crestly/shared";
import type {
  SuperAccountUpdate, SuperChangePassword, SuperLoginInput,
} from "@crestly/shared";

@Controller("superadmin/auth")
export class SuperAuthController {
  constructor(private readonly auth: SuperAuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  @UsePipes(new ZodPipe(SuperLoginInputSchema))
  login(@Body() body: SuperLoginInput) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Get("me")
  me(@Req() req: Request) {
    return this.auth.me((req as Request & { admin: { id: number } }).admin.id);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Put("account")
  updateAccount(@Req() req: Request, @Body(new ZodPipe(SuperAccountUpdateSchema)) body: SuperAccountUpdate) {
    return this.auth.updateAccount((req as Request & { admin: { id: number } }).admin.id, body);
  }

  @Public()
  @UseGuards(SuperAdminGuard)
  @Post("change-password")
  changePassword(@Req() req: Request, @Body(new ZodPipe(SuperChangePasswordSchema)) body: SuperChangePassword) {
    return this.auth.changePassword((req as Request & { admin: { id: number } }).admin.id, body);
  }
}
