import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { HolidaysService } from "./holidays.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { HolidayUpsertSchema, HolidayCalendarQuerySchema } from "@crestly/shared";
import type { HolidayUpsert, HolidayCalendarQuery, CurrentUser as User } from "@crestly/shared";

@Controller("holidays")
export class HolidaysController {
  constructor(private readonly holidays: HolidaysService) {}

  @Get()
  calendar(@Query(new ZodPipe(HolidayCalendarQuerySchema)) query: HolidayCalendarQuery) {
    return this.holidays.calendar(query.academicYear);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.holidays.findOne(id);
  }

  @Post()
  @UsePipes(new ZodPipe(HolidayUpsertSchema))
  create(@Body() body: HolidayUpsert, @CurrentUser() user: User) {
    return this.holidays.create(body, user);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(HolidayUpsertSchema)) body: HolidayUpsert,
  ) {
    return this.holidays.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.holidays.delete(id);
  }
}
