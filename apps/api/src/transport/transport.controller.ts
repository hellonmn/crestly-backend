import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { TransportService } from "./transport.service";
import { ZodPipe } from "../common/zod.pipe";
import { PickupPointUpsertSchema } from "@crestly/shared";
import type { PickupPointUpsertInput } from "@crestly/shared";

@Controller("transport")
export class TransportController {
  constructor(private readonly transport: TransportService) {}

  @Get()
  list(@Query("q") q?: string) {
    return this.transport.list({ q });
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.transport.findOne(id);
  }

  @Post()
  @UsePipes(new ZodPipe(PickupPointUpsertSchema))
  create(@Body() body: PickupPointUpsertInput) {
    return this.transport.create(body);
  }

  @Put(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(PickupPointUpsertSchema)) body: PickupPointUpsertInput) {
    return this.transport.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.transport.delete(id);
  }
}
