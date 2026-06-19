import { Body, Controller, Get, Param, Post, Put, UsePipes } from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { AcademicSessionUpsertSchema } from "@crestly/shared";
import type { AcademicSessionUpsert } from "@crestly/shared";

@Controller("sessions")
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list() {
    return this.sessions.list();
  }

  @Get("current")
  current() {
    return this.sessions.current();
  }

  @Get(":code")
  findOne(@Param("code") code: string) {
    return this.sessions.findOne(code);
  }

  @Post()
  @UsePipes(new ZodPipe(AcademicSessionUpsertSchema))
  create(@Body() body: AcademicSessionUpsert) {
    return this.sessions.create(body);
  }

  @Put(":code")
  update(
    @Param("code") code: string,
    @Body(new ZodPipe(AcademicSessionUpsertSchema)) body: AcademicSessionUpsert,
  ) {
    return this.sessions.update(code, body);
  }

  @Post(":code/set-current")
  setCurrent(@Param("code") code: string) {
    return this.sessions.setCurrent(code);
  }
}
