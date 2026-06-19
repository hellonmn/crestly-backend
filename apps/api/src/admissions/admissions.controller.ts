import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { AdmissionsService } from "./admissions.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { EnquiryListQuerySchema, EnquiryUpsertSchema, FollowupAddSchema } from "@crestly/shared";
import type { EnquiryListQuery, EnquiryUpsertInput, FollowupAddInput, CurrentUser as User } from "@crestly/shared";

@Controller("admissions")
export class AdmissionsController {
  constructor(private readonly admissions: AdmissionsService) {}

  @Get()
  @RequirePerm("admissions.view")
  list(@Query(new ZodPipe(EnquiryListQuerySchema)) query: EnquiryListQuery) {
    return this.admissions.list(query);
  }

  @Get(":id")
  @RequirePerm("admissions.view")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.admissions.findOne(id);
  }

  @Post()
  @RequirePerm("admissions.manage")
  @UsePipes(new ZodPipe(EnquiryUpsertSchema))
  create(@Body() body: EnquiryUpsertInput, @CurrentUser() user: User) {
    return this.admissions.create(body, user);
  }

  @Put(":id")
  @RequirePerm("admissions.manage")
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(EnquiryUpsertSchema)) body: EnquiryUpsertInput) {
    return this.admissions.update(id, body);
  }

  @Post(":id/followup")
  @RequirePerm("admissions.manage")
  addFollowup(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(FollowupAddSchema)) body: FollowupAddInput,
    @CurrentUser() user: User,
  ) {
    return this.admissions.addFollowup(id, body, user);
  }
}
