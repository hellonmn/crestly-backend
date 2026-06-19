import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes,
} from "@nestjs/common";
import { TimetableService } from "./timetable.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  EligibleTeachersQuerySchema,
  SmartAllotInputSchema,
  TimetableCellUpsertSchema,
  TimetableGridQuerySchema,
  TimetablePeriodUpsertSchema,
} from "@crestly/shared";
import type {
  EligibleTeachersQuery,
  SmartAllotInput,
  TimetableCellUpsert,
  TimetableGridQuery,
  TimetablePeriodUpsert,
} from "@crestly/shared";

@Controller()
export class TimetableController {
  constructor(private readonly tt: TimetableService) {}

  /* ───────── Grid (by section OR by teacher) ───────── */

  @Get("timetable")
  @RequirePerm("timetable.view")
  grid(@Query(new ZodPipe(TimetableGridQuerySchema)) query: TimetableGridQuery) {
    return this.tt.grid(query);
  }

  /* ───────── Periods (CRUD) ───────── */

  @Get("timetable/periods")
  @RequirePerm("timetable.view")
  periods() {
    return this.tt.periods();
  }

  @Post("timetable/periods")
  @RequirePerm("timetable.manage")
  @UsePipes(new ZodPipe(TimetablePeriodUpsertSchema))
  createPeriod(@Body() body: TimetablePeriodUpsert) {
    return this.tt.upsertPeriod(body);
  }

  @Put("timetable/periods/:id")
  @RequirePerm("timetable.manage")
  updatePeriod(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(TimetablePeriodUpsertSchema)) body: TimetablePeriodUpsert,
  ) {
    return this.tt.upsertPeriod(body, id);
  }

  @Delete("timetable/periods/:id")
  @RequirePerm("timetable.manage")
  deletePeriod(@Param("id", ParseIntPipe) id: number) {
    return this.tt.deletePeriod(id);
  }

  /* ───────── Cell save / clear ───────── */

  @Post("timetable/cells")
  @RequirePerm("timetable.manage")
  @UsePipes(new ZodPipe(TimetableCellUpsertSchema))
  upsertCell(@Body() body: TimetableCellUpsert) {
    return this.tt.upsertCell(body);
  }

  @Delete("timetable/cells/:id")
  @RequirePerm("timetable.manage")
  deleteCell(@Param("id", ParseIntPipe) id: number) {
    return this.tt.deleteCell(id);
  }

  /** Clear-by-coords variant (mirrors PHP's `_ajax=clear_cell`).
   *  Lets the UI clear a cell without needing its row id. */
  @Post("timetable/cells/clear")
  @RequirePerm("timetable.manage")
  clearCellByCoords(
    @Body() body: { classSlug: string; sectionCode: string; dayOfWeek: number; periodId: number },
  ) {
    return this.tt.clearCell(body.classSlug, body.sectionCode, body.dayOfWeek, body.periodId);
  }

  /* ───────── Eligible teachers (per subject, band-aware) ───────── */

  @Get("timetable/eligible-teachers")
  @RequirePerm("timetable.view")
  eligibleTeachers(@Query(new ZodPipe(EligibleTeachersQuerySchema)) q: EligibleTeachersQuery) {
    return this.tt.eligibleTeachersForClass(q.class);
  }

  /* ───────── Smart allot ───────── */

  @Post("timetable/smart-allot")
  @RequirePerm("timetable.manage")
  @UsePipes(new ZodPipe(SmartAllotInputSchema))
  smartAllot(@Body() body: SmartAllotInput) {
    return this.tt.smartAllot(body);
  }

  /* ───────── Workload report ───────── */

  @Get("timetable/workload")
  @RequirePerm("timetable.view")
  workload() {
    return this.tt.workload();
  }
}
