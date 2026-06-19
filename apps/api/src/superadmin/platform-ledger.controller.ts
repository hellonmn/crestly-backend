import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { PlatformLedgerService } from "./platform-ledger.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/ledger")
export class PlatformLedgerController {
  constructor(private readonly ledger: PlatformLedgerService) {}

  @Get()
  overview() { return this.ledger.overview(); }

  @Get("school/:schoolId")
  school(@Param("schoolId", ParseIntPipe) schoolId: number) {
    return this.ledger.school(schoolId);
  }

  @Get("invoice/:id")
  invoice(@Param("id", ParseIntPipe) id: number) {
    return this.ledger.invoice(id);
  }
}
