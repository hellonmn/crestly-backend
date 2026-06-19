import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UsePipes } from "@nestjs/common";
import { ClassesService } from "./classes.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { SchoolClassUpsertSchema, SectionUpsertSchema } from "@crestly/shared";
import type { SchoolClassUpsert, SectionUpsert } from "@crestly/shared";

@Controller()
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  // --- classes ---
  @Get("classes")
  @RequirePerm("classes.view")
  list() {
    return this.classes.list();
  }

  @Get("classes/:id")
  @RequirePerm("classes.view")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.classes.findOne(id);
  }

  @Post("classes")
  @RequirePerm("classes.manage")
  @UsePipes(new ZodPipe(SchoolClassUpsertSchema))
  create(@Body() body: SchoolClassUpsert) {
    return this.classes.create(body);
  }

  @Put("classes/:id")
  @RequirePerm("classes.manage")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(SchoolClassUpsertSchema)) body: SchoolClassUpsert,
  ) {
    return this.classes.update(id, body);
  }

  @Delete("classes/:id")
  @RequirePerm("classes.manage")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.classes.delete(id);
  }

  // --- sections ---
  @Post("sections")
  @RequirePerm("classes.manage")
  @UsePipes(new ZodPipe(SectionUpsertSchema))
  createSection(@Body() body: SectionUpsert) {
    return this.classes.createSection(body);
  }

  @Put("sections/:id")
  @RequirePerm("classes.manage")
  updateSection(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(SectionUpsertSchema)) body: SectionUpsert,
  ) {
    return this.classes.updateSection(id, body);
  }

  @Delete("sections/:id")
  @RequirePerm("classes.manage")
  deleteSection(@Param("id", ParseIntPipe) id: number) {
    return this.classes.deleteSection(id);
  }
}
