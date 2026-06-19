import { Body, Controller, Get, Post, Query, UsePipes } from "@nestjs/common";
import { ShiftsService } from "./shifts.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  HoursBulkUpdateSchema, SalaryBulkUpdateSchema, ShiftListQuerySchema, ShiftUpsertSchema,
} from "@crestly/shared";
import type {
  HoursBulkUpdate, SalaryBulkUpdate, ShiftListQuery, ShiftUpsertInput, CurrentUser as User,
} from "@crestly/shared";

@Controller("shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @Get()
  @RequirePerm("shifts.manage")
  list(@Query(new ZodPipe(ShiftListQuerySchema)) query: ShiftListQuery) {
    return this.shifts.list(query);
  }

  @Post()
  @RequirePerm("shifts.manage")
  @UsePipes(new ZodPipe(ShiftUpsertSchema))
  upsert(@Body() body: ShiftUpsertInput, @CurrentUser() user: User) {
    return this.shifts.upsertSchedule(body, user);
  }

  @Post("bulk/hours")
  @RequirePerm("shifts.manage")
  @UsePipes(new ZodPipe(HoursBulkUpdateSchema))
  bulkHours(@Body() body: HoursBulkUpdate, @CurrentUser() user: User) {
    return this.shifts.bulkHours(body, user);
  }

  @Post("bulk/salary")
  @RequirePerm("shifts.manage")
  @UsePipes(new ZodPipe(SalaryBulkUpdateSchema))
  bulkSalary(@Body() body: SalaryBulkUpdate) {
    return this.shifts.bulkSalary(body);
  }
}
