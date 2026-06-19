import { Controller, Get } from "@nestjs/common";
import { HrService } from "./hr.service";
import { RequirePerm } from "../auth/require-perm.decorator";

@Controller("hr")
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get("dashboard")
  @RequirePerm("hr.dashboard")
  dashboard() { return this.hr.dashboard(); }
}
