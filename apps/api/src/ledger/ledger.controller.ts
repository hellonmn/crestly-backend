import { Controller, Get, Query } from "@nestjs/common";
import { LedgerService } from "./ledger.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { LedgerQuerySchema, StaffSalaryQuerySchema } from "@crestly/shared";
import type { LedgerQuery, StaffSalaryQuery } from "@crestly/shared";

@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get()
  @RequirePerm("ledger.view")
  overview(@Query(new ZodPipe(LedgerQuerySchema)) query: LedgerQuery) {
    return this.ledger.overview(query.from, query.to);
  }

  @Get("staff")
  @RequirePerm("ledger.view")
  staff(@Query(new ZodPipe(StaffSalaryQuerySchema)) query: StaffSalaryQuery) {
    return this.ledger.staffSalary(query);
  }
}
