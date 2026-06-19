import { Body, Controller, Get, Put, Req, UseGuards, UsePipes } from "@nestjs/common";
import { Request } from "express";
import { PlatformBillingService } from "./platform-billing.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformBillingUpdateSchema } from "@crestly/shared";
import type { PlatformBillingUpdate } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/billing")
export class PlatformBillingController {
  constructor(private readonly billing: PlatformBillingService) {}

  @Get()
  get() { return this.billing.get(); }

  @Put()
  @UsePipes(new ZodPipe(PlatformBillingUpdateSchema))
  update(@Req() req: Request, @Body() body: PlatformBillingUpdate) {
    const adminId = (req as Request & { admin: { id: number } }).admin.id;
    return this.billing.update(body, adminId);
  }
}
