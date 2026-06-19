import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { AttendanceService } from "./attendance.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  AttendanceBulkSchema,
  AttendanceHistoryQuerySchema,
  AttendanceMarkSchema,
  AttendanceRosterQuerySchema,
} from "@crestly/shared";
import type {
  AttendanceBulk,
  AttendanceHistoryQuery,
  AttendanceMark,
  AttendanceRosterQuery,
  CurrentUser as User,
} from "@crestly/shared";

@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get("roster")
  @RequirePerm("attendance.view")
  roster(@Query(new ZodPipe(AttendanceRosterQuerySchema)) query: AttendanceRosterQuery) {
    return this.attendance.roster(query);
  }

  @Post("mark")
  @RequirePerm("attendance.mark")
  mark(@Body(new ZodPipe(AttendanceMarkSchema)) body: AttendanceMark, @CurrentUser() user: User) {
    return this.attendance.mark(body, user);
  }

  @Post("bulk")
  @RequirePerm("attendance.mark")
  bulk(@Body(new ZodPipe(AttendanceBulkSchema)) body: AttendanceBulk, @CurrentUser() user: User) {
    return this.attendance.bulkMark(body, user);
  }

  @Get("history")
  @RequirePerm("attendance.view")
  history(@Query(new ZodPipe(AttendanceHistoryQuerySchema)) query: AttendanceHistoryQuery) {
    return this.attendance.history(query.srNumber, query.year, query.month);
  }
}
