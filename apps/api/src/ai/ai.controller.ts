import { Body, Controller, Get, Post, Put, Req, UsePipes } from "@nestjs/common";
import { AiService } from "./ai.service";
import { ZodPipe } from "../common/zod.pipe";
import { AiAskInputSchema, AiSettingsUpdateSchema } from "@crestly/shared";
import type { AiAskInput, AiSettingsUpdate, CurrentUser } from "@crestly/shared";

@Controller("ai")
export class AiController {
  constructor(private readonly ai: AiService) {}

  /** Public surface of the AI settings — used by the settings page AND
   *  by the chat panel to know whether to show the floating button. */
  @Get("settings")
  getSettings() {
    return this.ai.getSettings();
  }

  @Put("settings")
  @UsePipes(new ZodPipe(AiSettingsUpdateSchema))
  updateSettings(@Body() body: AiSettingsUpdate, @Req() req: { user?: CurrentUser }) {
    const userId = req.user?.id ?? 0;
    return this.ai.updateSettings(body, userId);
  }

  /** Sends a 1-shot "ping" through Groq to verify the API key + model. */
  @Post("settings/test")
  test() {
    return this.ai.testConnection();
  }

  /** Main chat endpoint — caller maintains the conversation locally
   *  and sends the full message list each turn. */
  @Post("ask")
  @UsePipes(new ZodPipe(AiAskInputSchema))
  ask(@Body() body: AiAskInput) {
    return this.ai.ask(body);
  }
}
