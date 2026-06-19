import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards, UsePipes,
} from "@nestjs/common";
import type { Request } from "express";
import { ParentService } from "./parent.service";
import { ZodPipe } from "../common/zod.pipe";
import { Public } from "../auth/public.decorator";
import { ParentJwtGuard, type RequestWithParent } from "./parent-jwt.guard";
import { ParentLoginInputSchema, CheckoutCreateSchema } from "@crestly/shared";
import type { ParentLoginInput, CheckoutCreateInput } from "@crestly/shared";

@Controller("parent")
export class ParentController {
  constructor(private readonly parent: ParentService) {}

  /* ───────── Public ───────── */

  @Public()
  @Get("school-info")
  schoolInfo() {
    return this.parent.schoolInfo();
  }

  @Public()
  @Post("login")
  @UsePipes(new ZodPipe(ParentLoginInputSchema))
  login(@Body() body: ParentLoginInput) {
    return this.parent.login(body);
  }

  /* ───────── Authenticated parent endpoints ───────── */

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("me")
  me(@Req() req: RequestWithParent) {
    const p = req.parent!;
    return this.parent.kidsForSession(p.srs, p.phone, p.familyId);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("home")
  home(@Req() req: RequestWithParent) {
    // For now /home returns the same as /me — the kids list with light
    // metadata. The frontend home page composes the per-kid widgets
    // from the more-specific endpoints (attendance, fees, exams).
    const p = req.parent!;
    return this.parent.kidsForSession(p.srs, p.phone, p.familyId);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("attendance")
  attendance(
    @Req() req: RequestWithParent,
    @Query("sr") srRaw: string,
    @Query("m")  monthRaw?: string,
  ) {
    const sr = Number(srRaw);
    const month = (monthRaw ?? "").match(/^\d{4}-\d{2}$/) ? monthRaw! : new Date().toISOString().slice(0, 7);
    return this.parent.attendance(sr, month, req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("exams")
  exams(@Req() req: RequestWithParent, @Query("sr") srRaw: string) {
    return this.parent.exams(Number(srRaw), req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("fees")
  fees(@Req() req: RequestWithParent, @Query("sr") srRaw: string) {
    return this.parent.fees(Number(srRaw), req.parent!.srs);
  }

  /** Start an HDFC hosted-checkout for one of the parent's kids. */
  @Public()
  @UseGuards(ParentJwtGuard)
  @Post("fees/checkout")
  checkout(
    @Req() req: Request & RequestWithParent,
    @Query("sr") srRaw: string,
    @Body(new ZodPipe(CheckoutCreateSchema)) body: CheckoutCreateInput,
  ) {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.socket.remoteAddress ?? null)?.trim() ?? null;
    return this.parent.checkout(Number(srRaw), body, req.parent!.srs, req.parent!.phone, ip);
  }

  /** Single printable receipt for a payment belonging to the parent. */
  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("fees/receipt/:id")
  receipt(@Req() req: RequestWithParent, @Param("id", ParseIntPipe) id: number) {
    return this.parent.receipt(id, req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("transport")
  transport(@Req() req: RequestWithParent, @Query("sr") srRaw: string) {
    return this.parent.transport(Number(srRaw), req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("diary")
  diary(
    @Req() req: RequestWithParent,
    @Query("sr") srRaw: string,
    @Query("d")  dateRaw?: string,
  ) {
    const sr = Number(srRaw);
    const date = (dateRaw ?? "").match(/^\d{4}-\d{2}-\d{2}$/) ? dateRaw! : new Date().toISOString().slice(0, 10);
    return this.parent.diary(sr, date, req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("timetable")
  timetable(@Req() req: RequestWithParent, @Query("sr") srRaw: string) {
    return this.parent.timetable(Number(srRaw), req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("contact")
  contact(@Req() req: RequestWithParent, @Query("sr") srRaw: string) {
    return this.parent.contact(Number(srRaw), req.parent!.srs);
  }

  @Public()
  @UseGuards(ParentJwtGuard)
  @Get("more")
  more() {
    return this.parent.moreInfo();
  }
}
