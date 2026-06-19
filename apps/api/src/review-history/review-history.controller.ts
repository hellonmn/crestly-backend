import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { ReviewHistoryService } from "./review-history.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { ReviewCheckSchema, ReviewHistoryQuerySchema } from "@crestly/shared";
import type { ReviewCheckInput, ReviewHistoryQuery, CurrentUser as User } from "@crestly/shared";

@Controller("review-history")
export class ReviewHistoryController {
  constructor(private readonly rh: ReviewHistoryService) {}

  @Get()
  history(@Query(new ZodPipe(ReviewHistoryQuerySchema)) query: ReviewHistoryQuery, @CurrentUser() user: User) {
    return this.rh.history(user.id, query.window);
  }

  @Post("check")
  @UsePipes(new ZodPipe(ReviewCheckSchema))
  check(@Body() body: ReviewCheckInput, @CurrentUser() user: User) {
    return this.rh.check(user.id, body, user);
  }
}
