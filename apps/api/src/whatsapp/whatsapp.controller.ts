import { Body, Controller, Get, Post, Put, Query, UsePipes } from "@nestjs/common";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappDispatcher } from "./dispatcher.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  WaBindingUpsertSchema, WaSettingsUpdateSchema, WaTestInputSchema,
} from "@crestly/shared";
import type {
  WaBindingUpsertInput, WaSettingsUpdate, WaTestInput, CurrentUser as User,
} from "@crestly/shared";

@Controller("whatsapp")
export class WhatsappController {
  constructor(
    private readonly wa: WhatsappService,
    private readonly dispatcher: WhatsappDispatcher,
  ) {}

  @Get("settings")
  @RequirePerm("whatsapp.configure")
  settings() { return this.wa.getSettings(); }

  @Get("stats")
  @RequirePerm("whatsapp.configure")
  stats() { return this.wa.stats(); }

  @Put("settings")
  @RequirePerm("whatsapp.configure")
  updateSettings(@Body(new ZodPipe(WaSettingsUpdateSchema)) body: WaSettingsUpdate, @CurrentUser() user: User) {
    return this.wa.updateSettings(body, user.id);
  }

  @Post("templates/refresh")
  @RequirePerm("whatsapp.configure")
  refreshTemplates() { return this.wa.refreshFromMeta(); }

  @Get("templates")
  @RequirePerm("whatsapp.bind")
  listTemplates() { return this.wa.listTemplates(); }

  @Get("bindings")
  @RequirePerm("whatsapp.bind")
  listBindings() { return this.wa.listBindings(); }

  @Post("bindings")
  @RequirePerm("whatsapp.bind")
  @UsePipes(new ZodPipe(WaBindingUpsertSchema))
  upsertBinding(@Body() body: WaBindingUpsertInput, @CurrentUser() user: User) {
    return this.wa.upsertBinding(body, user.id);
  }

  @Get("log")
  @RequirePerm("whatsapp.logs")
  log(@Query("limit") limit?: string) {
    return this.wa.log(limit ? Number(limit) : 200);
  }

  @Post("test")
  @RequirePerm("whatsapp.configure")
  @UsePipes(new ZodPipe(WaTestInputSchema))
  test(@Body() body: WaTestInput) {
    // Use Meta's hello_world template — always available on a fresh WABA.
    return this.dispatcher.dispatch("test.hello_world", {
      phone: body.toPhone,
    });
  }
}
