import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { PromotionService } from "./promotion.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PromoteSectionBulkSchema, PromotionSectionQuerySchema } from "@crestly/shared";
import type { PromoteSectionBulk, PromotionSectionQuery, CurrentUser as User } from "@crestly/shared";

@Controller("promotion")
export class PromotionController {
  constructor(private readonly promotion: PromotionService) {}

  @Get()
  @RequirePerm("students.promote")
  overview() { return this.promotion.overview(); }

  @Get("section")
  @RequirePerm("students.promote")
  section(@Query(new ZodPipe(PromotionSectionQuerySchema)) query: PromotionSectionQuery) {
    return this.promotion.section(query);
  }

  @Post("section")
  @RequirePerm("students.promote")
  @UsePipes(new ZodPipe(PromoteSectionBulkSchema))
  promoteSection(@Body() body: PromoteSectionBulk, @CurrentUser() user: User) {
    return this.promotion.promoteSection(body, user);
  }

  @Post("finalize")
  @RequirePerm("students.promote")
  finalize(@CurrentUser() user: User) {
    return this.promotion.finalize(user);
  }
}
