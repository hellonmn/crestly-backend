import { Controller, ForbiddenException, Get, Query } from "@nestjs/common";
import { SalaryService } from "./salary.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { SalaryQuerySchema } from "@crestly/shared";
import type { SalaryQuery, CurrentUser as User } from "@crestly/shared";

@Controller("salary")
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  @Get()
  monthly(@Query(new ZodPipe(SalaryQuerySchema)) query: SalaryQuery, @CurrentUser() user: User) {
    const targetUserId = query.userId ?? user.id;
    const isOther = targetUserId !== user.id;
    if (isOther && !user.permissions.includes("staff.view_all") && !user.permissions.includes("hr.dashboard")) {
      throw new ForbiddenException("You can only view your own salary.");
    }
    return this.salary.monthly(targetUserId, query.month);
  }
}
