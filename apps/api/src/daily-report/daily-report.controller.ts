import { Controller, Get, Query } from "@nestjs/common";
import { DailyReportService } from "./daily-report.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { DailyReportQuerySchema } from "@crestly/shared";
import type { DailyReportQuery } from "@crestly/shared";

@Controller("daily-report")
export class DailyReportController {
  constructor(private readonly dailyReport: DailyReportService) {}

  @Get()
  @RequirePerm("ledger.view")
  report(@Query(new ZodPipe(DailyReportQuerySchema)) query: DailyReportQuery) {
    return this.dailyReport.report(query.date);
  }
}
