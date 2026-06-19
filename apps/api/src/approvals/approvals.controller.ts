import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UsePipes } from "@nestjs/common";
import { ApprovalsService } from "./approvals.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { EditRequestListQuerySchema, ReviewDecisionSchema } from "@crestly/shared";
import type { EditRequestListQuery, ReviewDecisionInput, CurrentUser as User } from "@crestly/shared";

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  list(@Query(new ZodPipe(EditRequestListQuerySchema)) query: EditRequestListQuery, @CurrentUser() user: User) {
    return this.approvals.list(query, user);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.approvals.findOne(id, user);
  }

  @Post(":id/review")
  @UsePipes(new ZodPipe(ReviewDecisionSchema))
  review(@Param("id", ParseIntPipe) id: number, @Body() body: ReviewDecisionInput, @CurrentUser() user: User) {
    return this.approvals.review(id, body, user);
  }
}
