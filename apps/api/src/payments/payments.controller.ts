import {
  Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Query, Req, Res, UsePipes,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { PaymentsService } from "./payments.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { Public } from "../auth/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { CheckoutCreateSchema } from "@crestly/shared";
import type { CheckoutCreateInput, CurrentUser as User } from "@crestly/shared";
import { ConfigService } from "@nestjs/config";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { TenantService } from "../tenant/tenant.service";

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
    private readonly prisma: RequestPrismaService,
    private readonly tenants: TenantService,
  ) {}

  /**
   * Admin generates a checkout link for a student. Runs against the
   * request tenant DB. The parent portal hits its own
   * POST /parent/fees/checkout, which reuses PaymentsService on the
   * platform DB.
   */
  @Post("fees/student/:sr/checkout")
  @RequirePerm("fees.manage")
  @UsePipes(new ZodPipe(CheckoutCreateSchema))
  async create(
    @Param("sr", ParseIntPipe) sr: number,
    @Body() body: CheckoutCreateInput,
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.socket.remoteAddress ?? null)?.trim() ?? null;
    return this.payments.createCheckout(this.prisma.db, sr, body, user.name ?? `user-${user.id}`, ip);
  }

  /**
   * HDFC redirects the parent here after they complete (or cancel)
   * the hosted-page flow. We verify, credit if successful, then
   * 302 to the web app's parent-facing landing page.
   *
   * GET is required by HDFC — query params carry the result.
   */
  @Get("pay/return")
  @Public()
  async handleReturn(@Query() query: Record<string, string>, @Res() res: Response) {
    // Public route — no request tenant. Reconcile against the platform DB
    // (which, single-tenant, holds the attempt created at checkout).
    const out = await this.payments.handleReturn(this.tenants.platform, query);
    const base = this.config.get<string>("PUBLIC_WEB_BASE_URL") ?? "";
    return res.redirect(302, `${base}${out.redirectTo}`);
  }

  /**
   * Server-to-server webhook from HDFC. Authenticated by HMAC
   * header (x-signature). Returns 200 even on bad signature so HDFC
   * doesn't keep retrying on a misconfiguration — we log and inspect
   * via the admin attempts list.
   */
  @Post("pay/webhook")
  @Public()
  async handleWebhook(
    @Body() body: Record<string, unknown>,
    @Headers("x-signature") signature: string | null,
    @Res() res: Response,
  ) {
    const out = await this.payments.handleWebhook(this.tenants.platform, body, signature);
    return res.status(out.ok ? 200 : 200).json(out);  // always 200, body carries ok
  }

  /** Admin list of payment attempts for a student (or globally). */
  @Get("fees/payment-attempts")
  @RequirePerm("fees.view")
  list(@Query("sr") sr?: string) {
    return this.payments.listAttempts(this.prisma.db, sr ? Number(sr) : undefined);
  }
}
