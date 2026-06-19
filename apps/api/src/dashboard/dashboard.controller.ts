import { Body, Controller, Get, Post } from "@nestjs/common";
import { z } from "zod";
import { DashboardService } from "./dashboard.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import type { CurrentUser as User } from "@crestly/shared";

const ReviewCheckSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().max(120).nullable().optional(),
});
type ReviewCheckInput = z.infer<typeof ReviewCheckSchema>;

const ReviewUncheckSchema = z.object({
  key: z.string().min(1).max(60),
});
type ReviewUncheckInput = z.infer<typeof ReviewUncheckSchema>;

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** Home-page summary; visible to every signed-in user. */
  @Get()
  summary(@CurrentUser() user: User) { return this.dashboard.summary(user); }

  /** Mark one dashboard tile as reviewed for today. */
  @Post("review/check")
  reviewCheck(@Body(new ZodPipe(ReviewCheckSchema)) body: ReviewCheckInput, @CurrentUser() user: User) {
    return this.dashboard.reviewCheck(user, body.key, body.label);
  }

  /** Un-tick a previously-reviewed tile. */
  @Post("review/uncheck")
  reviewUncheck(@Body(new ZodPipe(ReviewUncheckSchema)) body: ReviewUncheckInput, @CurrentUser() user: User) {
    return this.dashboard.reviewUncheck(user, body.key);
  }

  /** Wipe today's review state for the calling user. */
  @Post("review/reset")
  reviewReset(@CurrentUser() user: User) { return this.dashboard.reviewResetToday(user); }
}
