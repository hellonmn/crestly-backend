import { Body, Controller, Get, Post, Put, Req, UsePipes } from "@nestjs/common";
import { CallingService } from "./calling.service";
import { ZodPipe } from "../common/zod.pipe";
import { CallingSettingsUpdateSchema } from "@crestly/shared";
import type { CallingSettingsUpdate, CurrentUser } from "@crestly/shared";

@Controller("calling")
export class CallingController {
  constructor(private readonly calling: CallingService) {}

  @Get("settings")
  getSettings() {
    return this.calling.getSettings();
  }

  @Put("settings")
  @UsePipes(new ZodPipe(CallingSettingsUpdateSchema))
  updateSettings(@Body() body: CallingSettingsUpdate, @Req() req: { user?: CurrentUser }) {
    return this.calling.updateSettings(body, req.user?.id ?? 0);
  }

  /** Verify the Exotel credentials by fetching the account record. */
  @Post("settings/test")
  test() {
    return this.calling.testConnection();
  }
}
