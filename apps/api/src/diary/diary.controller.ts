import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { DiaryService } from "./diary.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { DiaryDayQuerySchema, DiarySaveSchema } from "@crestly/shared";
import type { DiaryDayQuery, DiarySaveInput, CurrentUser as User } from "@crestly/shared";

@Controller("diary")
export class DiaryController {
  constructor(private readonly diary: DiaryService) {}

  @Get()
  @RequirePerm("diary.log")
  day(@Query(new ZodPipe(DiaryDayQuerySchema)) query: DiaryDayQuery) {
    return this.diary.day(query);
  }

  @Post()
  @RequirePerm("diary.log")
  save(@Body(new ZodPipe(DiarySaveSchema)) body: DiarySaveInput, @CurrentUser() user: User) {
    return this.diary.save(body, user);
  }
}
