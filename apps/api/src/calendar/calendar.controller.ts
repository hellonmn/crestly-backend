import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes,
} from "@nestjs/common";
import { CalendarService } from "./calendar.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { CalendarEventUpsertSchema, CalendarFeedQuerySchema } from "@crestly/shared";
import type {
  CalendarEventUpsert,
  CalendarFeedQuery,
  CurrentUser as User,
} from "@crestly/shared";

@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** Merged feed: events + holidays + exam datesheets for a range/month. */
  @Get("feed")
  feed(@Query(new ZodPipe(CalendarFeedQuerySchema)) query: CalendarFeedQuery) {
    return this.calendar.feed(query);
  }

  /** Raw editable events (manage view). */
  @Get("events")
  listEvents(@Query("session") sessionCode?: string) {
    return this.calendar.listEvents(sessionCode);
  }

  @Get("events/:id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.calendar.findEvent(id);
  }

  @Post("events")
  @UsePipes(new ZodPipe(CalendarEventUpsertSchema))
  create(@Body() body: CalendarEventUpsert, @CurrentUser() user: User) {
    return this.calendar.createEvent(body, user.id);
  }

  @Put("events/:id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(CalendarEventUpsertSchema)) body: CalendarEventUpsert,
  ) {
    return this.calendar.updateEvent(id, body);
  }

  @Delete("events/:id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.calendar.deleteEvent(id);
  }
}
