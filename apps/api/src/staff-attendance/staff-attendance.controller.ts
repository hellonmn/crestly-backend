import { Body, Controller, Get, Logger, Param, ParseIntPipe, Post, Query, Req } from "@nestjs/common";
import { StaffAttendanceService } from "./staff-attendance.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PunchCreateSchema, StaffPunchListQuerySchema } from "@crestly/shared";
import type { PunchCreateInput, StaffPunchListQuery, CurrentUser as User } from "@crestly/shared";
import type { Request } from "express";

@Controller()
export class StaffAttendanceController {
  private readonly log = new Logger("PunchController");
  constructor(private readonly sa: StaffAttendanceService) {
    // Suppress unused-field error in strict TS configs.
    this.log.debug?.bind(this.log);
  }

  @Get("staff-attendance")
  @RequirePerm("staff.view_team")
  list(@Query(new ZodPipe(StaffPunchListQuerySchema)) query: StaffPunchListQuery) {
    return this.sa.list(query);
  }

  @Get("staff-attendance/:id")
  @RequirePerm("staff.view_team")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.sa.findOne(id);
  }

  /**
   * Note: we apply the ZodPipe directly to the @Body() parameter (rather than
   * via @UsePipes on the handler) so the global ValidationPipe's whitelist /
   * transform pass never sees the body — it would otherwise strip every
   * property when the metatype is a plain TS type alias, leaving the Zod
   * pipe to see `{}` and complain about every required field being missing.
   */
  @Post("punch")
  @RequirePerm("staff.punch")
  punch(
    @Body(new ZodPipe(PunchCreateSchema)) body: PunchCreateInput,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? req.socket.remoteAddress ?? null;
    const ua = req.headers["user-agent"] ?? null;
    this.log.log(
      `punch ok user=${user.id} type=${body.punchType} ` +
      `coords=${body.latitude.toFixed(5)},${body.longitude.toFixed(5)} ` +
      `selfie=${body.selfieBase64 ? Math.round(body.selfieBase64.length / 1024) + "KB" : "none"}`,
    );
    return this.sa.punch(body, user, ip, ua);
  }

  /** Raw-body inspector — temporary. Call POST /api/punch/echo with the same
   *  payload to see exactly what arrived at the API after body parsing.
   *  Helps catch silent truncation / wrong-content-type issues. */
  @Post("punch/echo")
  @RequirePerm("staff.punch")
  echo(@Body() body: unknown, @Req() req: Request) {
    const len = req.headers["content-length"] ?? "?";
    const ct  = req.headers["content-type"]   ?? "?";
    const keys = body && typeof body === "object" ? Object.keys(body as object) : [];
    this.log.log(`punch/echo content-length=${len} content-type=${ct} keys=[${keys.join(",")}]`);
    return { ok: true, contentLength: len, contentType: ct, keys, body };
  }

  @Get("punch/today")
  @RequirePerm("staff.punch")
  today(@CurrentUser() user: User) {
    return this.sa.today(user);
  }
}
