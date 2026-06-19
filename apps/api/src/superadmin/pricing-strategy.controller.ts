import { Body, Controller, Get, Put, Req, UseGuards, UsePipes } from "@nestjs/common";
import { Request } from "express";
import { PricingStrategyService } from "./pricing-strategy.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PricingStrategySchema } from "@crestly/shared";
import type { PricingStrategy } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/pricing-strategy")
export class PricingStrategyController {
  constructor(private readonly pricing: PricingStrategyService) {}

  @Get()
  get() { return this.pricing.get(); }

  @Put()
  @UsePipes(new ZodPipe(PricingStrategySchema))
  save(@Body() body: PricingStrategy, @Req() req: Request) {
    const adminId = (req as Request & { admin: { id: number } }).admin.id;
    return this.pricing.save(body, adminId);
  }
}
