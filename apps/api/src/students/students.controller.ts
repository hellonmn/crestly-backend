import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { z } from "zod";
import { StudentsService } from "./students.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { StudentListQuerySchema, StudentUpsertSchema } from "@crestly/shared";
import type { StudentListQuery, StudentUpsert } from "@crestly/shared";

const StudentBulkSchema = z.object({
  op: z.enum(["activate", "deactivate", "delete"]),
  srs: z.array(z.number().int().positive()).min(1),
});
type StudentBulkInput = z.infer<typeof StudentBulkSchema>;

@Controller("students")
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @RequirePerm("students.view")
  list(@Query(new ZodPipe(StudentListQuerySchema)) query: StudentListQuery) {
    return this.students.list(query);
  }

  @Get(":srNumber")
  @RequirePerm("students.view")
  findOne(@Param("srNumber", ParseIntPipe) srNumber: number) {
    return this.students.findOne(srNumber);
  }

  @Get(":srNumber/detail")
  @RequirePerm("students.view")
  detail(@Param("srNumber", ParseIntPipe) srNumber: number) {
    return this.students.detail(srNumber);
  }

  @Post()
  @RequirePerm("students.manage")
  @UsePipes(new ZodPipe(StudentUpsertSchema))
  create(@Body() body: StudentUpsert) {
    return this.students.create(body);
  }

  @Put(":srNumber")
  @RequirePerm("students.manage")
  update(
    @Param("srNumber", ParseIntPipe) srNumber: number,
    @Body(new ZodPipe(StudentUpsertSchema)) body: StudentUpsert,
  ) {
    return this.students.update(srNumber, body);
  }

  @Delete(":srNumber")
  @RequirePerm("students.manage")
  deactivate(@Param("srNumber", ParseIntPipe) srNumber: number) {
    return this.students.deactivate(srNumber);
  }

  @Post("bulk")
  @RequirePerm("students.manage")
  bulk(@Body(new ZodPipe(StudentBulkSchema)) body: StudentBulkInput) {
    return this.students.bulk(body.op, body.srs);
  }
}
