import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards, UsePipes } from "@nestjs/common";
import { SchoolsAdminService } from "./schools-admin.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { SchoolFeatureToggleSchema, SchoolUpsertSchema } from "@crestly/shared";
import type { SchoolFeatureToggle, SchoolUpsert } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/schools")
export class SchoolsAdminController {
  constructor(private readonly schools: SchoolsAdminService) {}

  @Get()
  list() { return this.schools.list(); }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) { return this.schools.findOne(id); }

  @Post()
  @UsePipes(new ZodPipe(SchoolUpsertSchema))
  create(@Body() body: SchoolUpsert) { return this.schools.create(body); }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(SchoolUpsertSchema)) body: SchoolUpsert) {
    return this.schools.update(id, body);
  }

  @Post(":id/status")
  changeStatus(@Param("id", ParseIntPipe) id: number, @Body() body: { status: "onboarding" | "active" | "suspended" }) {
    return this.schools.changeStatus(id, body.status);
  }

  @Post(":id/test-connection")
  testConnection(@Param("id", ParseIntPipe) id: number) {
    return this.schools.testConnection(id);
  }

  @Post(":id/reset-admin-password")
  resetAdminPassword(@Param("id", ParseIntPipe) id: number) {
    return this.schools.resetAdminPassword(id);
  }

  @Get(":id/features")
  features(@Param("id", ParseIntPipe) id: number) { return this.schools.features(id); }

  @Post(":id/features/toggle")
  toggleFeature(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(SchoolFeatureToggleSchema)) body: SchoolFeatureToggle) {
    return this.schools.toggleFeature(id, body);
  }
}
