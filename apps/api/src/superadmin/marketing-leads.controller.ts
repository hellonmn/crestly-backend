import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from "@nestjs/common";
import { MarketingLeadsService } from "./marketing-leads.service";
import { SuperAdminGuard } from "./super-admin.guard";
import { Public } from "../auth/public.decorator";

@Public()
@UseGuards(SuperAdminGuard)
@Controller("superadmin/enquiries")
export class MarketingLeadsController {
  constructor(private readonly leads: MarketingLeadsService) {}

  @Get()
  list() { return this.leads.list(); }

  @Post(":id/status")
  updateStatus(@Param("id", ParseIntPipe) id: number, @Body() body: { status: string }) {
    return this.leads.updateStatus(id, body.status);
  }
}
