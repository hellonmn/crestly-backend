import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UploadedFile, UseInterceptors, UsePipes } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { LeavesService } from "./leaves.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { LeaveApplySchema, LeaveDecisionSchema, LeaveListQuerySchema } from "@crestly/shared";
import type { LeaveApplyInput, LeaveDecisionInput, LeaveListQuery, CurrentUser as User } from "@crestly/shared";

@Controller("leaves")
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Get()
  list(@Query(new ZodPipe(LeaveListQuerySchema)) query: LeaveListQuery, @CurrentUser() user: User) {
    return this.leaves.list(query, user);
  }

  @Get("types")
  types() { return this.leaves.types(); }

  @Post()
  @RequirePerm("leaves.apply")
  apply(@Body(new ZodPipe(LeaveApplySchema)) body: LeaveApplyInput, @CurrentUser() user: User) {
    return this.leaves.apply(body, user);
  }

  @Post(":id/decide")
  decide(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(LeaveDecisionSchema)) body: LeaveDecisionInput, @CurrentUser() user: User) {
    return this.leaves.decide(id, body, user);
  }

  @Post(":id/cancel")
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.leaves.cancel(id, user);
  }

  @Post(":id/attachment")
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.leaves.uploadAttachment(
      id,
      { originalname: file.originalname, buffer: file.buffer, mimetype: file.mimetype },
      user,
    );
  }
}
