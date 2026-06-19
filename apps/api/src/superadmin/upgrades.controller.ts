import { Body, Controller, Get, Post, UseGuards, UsePipes } from "@nestjs/common";
import { UpgradesService } from "./upgrades.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { ApplyUpgradeSchema } from "@crestly/shared";
import type { ApplyUpgradeInput } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/upgrades")
export class UpgradesController {
  constructor(private readonly upgrades: UpgradesService) {}

  @Get()
  plan() { return this.upgrades.plan(); }

  @Post("apply")
  @UsePipes(new ZodPipe(ApplyUpgradeSchema))
  apply(@Body() body: ApplyUpgradeInput) { return this.upgrades.apply(body); }
}
