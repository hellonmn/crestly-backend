import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards, UsePipes } from "@nestjs/common";
import { Request } from "express";
import { SuperAdminsService } from "./super-admins.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { SuperAdminUpsertSchema } from "@crestly/shared";
import type { SuperAdminUpsert } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/admins")
export class SuperAdminsController {
  constructor(private readonly admins: SuperAdminsService) {}

  @Get()
  list() { return this.admins.list(); }

  @Post()
  @UsePipes(new ZodPipe(SuperAdminUpsertSchema))
  create(@Body() body: SuperAdminUpsert) { return this.admins.create(body); }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(SuperAdminUpsertSchema)) body: SuperAdminUpsert) {
    return this.admins.update(id, body);
  }

  @Post(":id/reset-password")
  resetPassword(@Param("id", ParseIntPipe) id: number) { return this.admins.resetPassword(id); }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number, @Req() req: Request) {
    const callerId = (req as Request & { admin: { id: number } }).admin.id;
    return this.admins.delete(id, callerId);
  }
}
