import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes,
} from "@nestjs/common";
import { TestsService } from "./tests.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { TestUpsertSchema, TestListQuerySchema } from "@crestly/shared";
import type { TestUpsert, TestListQuery, CurrentUser as User } from "@crestly/shared";

@Controller("tests")
export class TestsController {
  constructor(private readonly tests: TestsService) {}

  @Get()
  list(@Query(new ZodPipe(TestListQuerySchema)) query: TestListQuery) {
    return this.tests.list(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tests.findOne(id);
  }

  @Get(":id/results")
  results(@Param("id", ParseIntPipe) id: number) {
    return this.tests.results(id);
  }

  @Post()
  @UsePipes(new ZodPipe(TestUpsertSchema))
  create(@Body() body: TestUpsert, @CurrentUser() user: User) {
    return this.tests.create(body, user.id);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(TestUpsertSchema)) body: TestUpsert,
  ) {
    return this.tests.update(id, body);
  }

  @Post(":id/publish")
  publish(@Param("id", ParseIntPipe) id: number) {
    return this.tests.setStatus(id, "published");
  }

  @Post(":id/close")
  close(@Param("id", ParseIntPipe) id: number) {
    return this.tests.setStatus(id, "closed");
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.tests.remove(id);
  }
}
