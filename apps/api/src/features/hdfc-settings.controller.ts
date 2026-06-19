import { Body, Controller, Get, Post, Put, UsePipes } from "@nestjs/common";
import { HdfcSettingsService } from "./hdfc-settings.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { HdfcSettingsUpdateSchema } from "@crestly/shared";
import type { HdfcSettingsUpdate, CurrentUser as User } from "@crestly/shared";

@Controller("settings/payment-gateway")
export class HdfcSettingsController {
  constructor(private readonly hdfc: HdfcSettingsService) {}

  @Get()
  get() { return this.hdfc.get(); }

  @Put()
  @UsePipes(new ZodPipe(HdfcSettingsUpdateSchema))
  update(@Body() body: HdfcSettingsUpdate, @CurrentUser() user: User) {
    return this.hdfc.update(body, user.id);
  }

  @Post("clear-key")
  clearKey(@CurrentUser() user: User) {
    return this.hdfc.clearKey(user.id);
  }
}
