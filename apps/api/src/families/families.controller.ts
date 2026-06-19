import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { FamiliesService } from "./families.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { FamilyListQuerySchema, FamilyUpsertSchema } from "@crestly/shared";
import type { FamilyListQuery, FamilyUpsert } from "@crestly/shared";

@Controller("families")
export class FamiliesController {
  constructor(private readonly families: FamiliesService) {}

  @Get()
  @RequirePerm("students.view")
  list(@Query(new ZodPipe(FamilyListQuerySchema)) query: FamilyListQuery) {
    return this.families.list(query);
  }

  @Get(":familyId")
  @RequirePerm("students.view")
  findOne(@Param("familyId", ParseIntPipe) familyId: number) {
    return this.families.findOne(familyId);
  }

  @Post()
  @RequirePerm("students.manage")
  @UsePipes(new ZodPipe(FamilyUpsertSchema))
  create(@Body() body: FamilyUpsert) {
    return this.families.create(body);
  }

  @Put(":familyId")
  @RequirePerm("students.manage")
  update(
    @Param("familyId", ParseIntPipe) familyId: number,
    @Body(new ZodPipe(FamilyUpsertSchema)) body: FamilyUpsert,
  ) {
    return this.families.update(familyId, body);
  }

  @Delete(":familyId")
  @RequirePerm("students.manage")
  remove(@Param("familyId", ParseIntPipe) familyId: number) {
    return this.families.delete(familyId);
  }
}
