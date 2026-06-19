import { Body, Controller, Get, Param, Put, UsePipes } from "@nestjs/common";
import { FeeStructureService } from "./fee-structure.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { FeeStructureUpsertSchema } from "@crestly/shared";
import type { FeeStructureUpsert } from "@crestly/shared";

@Controller()
export class FeeStructureController {
  constructor(private readonly feeStructure: FeeStructureService) {}

  @Get("fee-structure")
  @RequirePerm("fee_structure.view")
  list() {
    return this.feeStructure.list();
  }

  @Get("fee-structure/transport-slabs")
  @RequirePerm("fee_structure.view")
  slabs() {
    return this.feeStructure.slabs();
  }

  @Get("fee-structure/:class")
  @RequirePerm("fee_structure.view")
  findOne(@Param("class") classSlug: string) {
    return this.feeStructure.findOne(classSlug);
  }

  @Put("fee-structure/:class")
  @RequirePerm("fee_structure.manage")
  update(
    @Param("class") classSlug: string,
    @Body(new ZodPipe(FeeStructureUpsertSchema)) body: FeeStructureUpsert,
  ) {
    return this.feeStructure.update(classSlug, body);
  }
}
