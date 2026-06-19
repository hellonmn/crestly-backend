import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards, UsePipes } from "@nestjs/common";
import { CatalogAdminService } from "./catalog-admin.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { CatalogUpsertSchema } from "@crestly/shared";
import type { CatalogUpsertInput } from "@crestly/shared";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/catalog")
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Get()
  list() { return this.catalog.list(); }

  @Post()
  @UsePipes(new ZodPipe(CatalogUpsertSchema))
  create(@Body() body: CatalogUpsertInput) { return this.catalog.create(body); }

  @Put(":featureKey")
  update(@Param("featureKey") key: string, @Body(new ZodPipe(CatalogUpsertSchema)) body: CatalogUpsertInput) {
    return this.catalog.update(key, body);
  }

  @Delete(":featureKey")
  remove(@Param("featureKey") key: string) { return this.catalog.delete(key); }
}
