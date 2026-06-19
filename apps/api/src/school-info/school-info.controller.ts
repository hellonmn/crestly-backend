import { Body, Controller, Get, Put, UsePipes } from "@nestjs/common";
import { SchoolInfoService } from "./school-info.service";
import { ZodPipe } from "../common/zod.pipe";
import { SchoolInfoUpdateSchema } from "@crestly/shared";
import type { SchoolInfoUpdate } from "@crestly/shared";

@Controller("school-info")
export class SchoolInfoController {
  constructor(private readonly schoolInfo: SchoolInfoService) {}

  @Get()
  getAll() {
    return this.schoolInfo.getAll();
  }

  @Put()
  @UsePipes(new ZodPipe(SchoolInfoUpdateSchema))
  update(@Body() body: SchoolInfoUpdate) {
    return this.schoolInfo.update(body);
  }
}
