import {
  Injectable, NotFoundException, BadRequestException, Logger, InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { HdfcSettingsService } from "../features/hdfc-settings.service";
import type {
  CheckoutCreateInput, CheckoutSession, PaymentAttempt, PaymentAttemptStatus,
} from "@crestly/shared";

/**
 * HDFC SmartGateway hosted-checkout flow.
 *
 * Why fee_payment_attempts (and not fee_payments) holds the in-flight
 * order: payments aren't a payment until HDFC confirms — keeping the
 * attempt table separate makes idempotency trivial (one INSERT per
 * checkout, multiple webhook callbacks become updates) and gives us
 * an audit trail of dropped / cancelled attempts.
 *
 * On success the service creates a fee_payment row and updates the
 * studentFee balance.
 *
 * Every method takes an explicit `db: PrismaClient` so the same flow
 * serves both the admin (request-scoped tenant DB) and the parent
 * portal / public return+webhook (platform DB — no tenant context).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly hdfc: HdfcSettingsService,
    private readonly config: ConfigService,
  ) {}

  // ────────────────────────────────────────────────────────────
  // 1. CHECKOUT — admin (or parent portal) initiates a session
  // ────────────────────────────────────────────────────────────

  async createCheckout(
    db: PrismaClient,
    srNumber: number,
    input: CheckoutCreateInput,
    initiatedBy: string,
    ipAddress: string | null,
  ): Promise<CheckoutSession> {
    const cfg = await this.hdfc.get(true, db);
    if (!cfg.enabled || !cfg.merchantId || !cfg.apiKey) {
      throw new BadRequestException("HDFC SmartGateway isn't configured. Open Settings → Payment gateway.");
    }

    const sessionCode = await this.currentSessionCode(db);
    const fee = await db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber, sessionCode } },
    });
    if (!fee) throw new NotFoundException(`No fee allotment for student #${srNumber}`);
    if (input.amount > fee.dueAmount) {
      throw new BadRequestException(
        `Amount ₹${input.amount} is more than the outstanding ₹${fee.dueAmount}`,
      );
    }

    // Pull a few student fields for the HDFC payload — phone/email
    // is required by some HDFC payment methods.
    const student = await db.student.findUnique({
      where: { srNumber },
      select: { studentName: true, fatherName: true, motherName: true, fatherContact: true, motherContact: true, whatsappNumber: true },
    });
    if (!student) throw new NotFoundException();

    const orderId = `CR-${sessionCode.replace(/[^A-Z0-9]/gi, "")}-${srNumber}-${Date.now()}-${randomBytes(2).toString("hex")}`.toUpperCase();
    const endpoint = cfg.environment === "production" ? cfg.endpointProd : cfg.endpointSandbox;
    const publicBase = this.publicBaseUrl();
    const returnUrl = `${publicBase}/api/pay/return`;

    // Insert the attempt FIRST so a network blip after HDFC accepts
    // the session still leaves us with a row to reconcile from the
    // webhook.
    await db.fee_payment_attempts.create({
      data: {
        order_id: orderId,
        sr_number: srNumber,
        session_code: sessionCode,
        amount: input.amount,
        currency: "INR",
        provider: "hdfc_smartgateway",
        environment: cfg.environment,
        status: "created",
        initiated_by: initiatedBy,
        ip: ipAddress,
      },
    });

    const sessionPayload = {
      order_id: orderId,
      amount: (input.amount).toFixed(2),
      currency: "INR",
      customer_id: `SR-${srNumber}`,
      customer_email: undefined,
      customer_phone: digitsOnly(student.whatsappNumber ?? student.fatherContact ?? student.motherContact ?? ""),
      first_name: student.studentName,
      last_name: student.fatherName ?? "",
      payment_page_client_id: cfg.merchantId,
      action: "paymentPage",
      return_url: returnUrl,
      description: input.notes ?? `Fee payment for ${student.studentName}`,
    };

    let checkoutUrl: string;
    try {
      const r = await fetch(`${endpoint}/session`, {
        method: "POST",
        headers: {
          "Content-Type":   "application/json",
          "Authorization":  `Basic ${Buffer.from(cfg.apiKey + ":").toString("base64")}`,
          "x-merchantid":   cfg.merchantId,
          "x-customerid":   `SR-${srNumber}`,
        },
        body: JSON.stringify(sessionPayload),
      });
      const body = await r.json().catch(() => ({})) as {
        id?: string;
        payment_links?: { web?: string; mobile?: string };
        error_message?: string;
      };
      if (!r.ok || !body.payment_links?.web) {
        const msg = body.error_message ?? `HDFC returned ${r.status}`;
        await this.markAttempt(db, orderId, "failed", { errorMessage: msg.slice(0, 240) });
        throw new InternalServerErrorException(`HDFC: ${msg}`);
      }
      checkoutUrl = body.payment_links.web;
      await db.fee_payment_attempts.update({
        where: { order_id: orderId },
        data: { raw_request: JSON.stringify(sessionPayload), raw_response: JSON.stringify(body), status: "pending" },
      });
    } catch (e) {
      this.logger.error(`HDFC session create failed for ${orderId}: ${(e as Error).message}`);
      await this.markAttempt(db, orderId, "failed", { errorMessage: (e as Error).message.slice(0, 240) });
      throw e;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Build a one-tap WhatsApp share URL for the admin
    const parentPhone = digitsOnly(
      student.whatsappNumber ?? student.fatherContact ?? student.motherContact ?? "",
    );
    const waMsg = `Hi! Your fee payment link for *${student.studentName}* (₹${input.amount.toLocaleString("en-IN")}) is ready:\n\n${checkoutUrl}\n\nLink expires in 15 minutes.`;
    const whatsappShareUrl = parentPhone
      ? `https://wa.me/91${parentPhone}?text=${encodeURIComponent(waMsg)}`
      : null;

    return {
      orderId,
      checkoutUrl,
      amount: input.amount,
      currency: "INR",
      expiresAt,
      whatsappShareUrl,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 2. RETURN-URL — HDFC redirects the parent here
  // ────────────────────────────────────────────────────────────

  async handleReturn(db: PrismaClient, params: Record<string, string>): Promise<{ ok: boolean; orderId: string | null; redirectTo: string }> {
    const orderId = params.order_id ?? params.orderId ?? null;
    if (!orderId) {
      return { ok: false, orderId: null, redirectTo: "/pay/failure?reason=missing-order" };
    }
    const attempt = await db.fee_payment_attempts.findUnique({
      where: { order_id: orderId },
    });
    if (!attempt) {
      return { ok: false, orderId, redirectTo: `/pay/failure?orderId=${encodeURIComponent(orderId)}&reason=unknown-order` };
    }

    // Verify signature (HDFC sends a 'signature' query param signed
    // with HMAC-SHA256 over the alphabetically-sorted form data).
    if (params.signature) {
      const cfg = await this.hdfc.get(true, db);
      if (cfg.apiKey) {
        const ok = verifyHdfcSignature(params, cfg.apiKey);
        if (!ok) {
          await this.markAttempt(db, orderId, "failed", { errorMessage: "Bad signature on return URL" });
          return { ok: false, orderId, redirectTo: `/pay/failure?orderId=${encodeURIComponent(orderId)}&reason=bad-signature` };
        }
      }
    }

    const upstreamStatus = (params.status ?? "").toUpperCase();
    const isSuccess = upstreamStatus === "CHARGED" || upstreamStatus === "SUCCESS";

    if (!isSuccess) {
      await this.markAttempt(db, orderId, "failed", {
        gatewayTxnId: params.txn_id ?? null,
        errorMessage: `Upstream ${upstreamStatus || "unknown"}`,
      });
      return { ok: false, orderId, redirectTo: `/pay/failure?orderId=${encodeURIComponent(orderId)}&status=${upstreamStatus}` };
    }

    await this.creditPayment(db, orderId, params.txn_id ?? null);
    return { ok: true, orderId, redirectTo: `/pay/success?orderId=${encodeURIComponent(orderId)}` };
  }

  // ────────────────────────────────────────────────────────────
  // 3. WEBHOOK — server-to-server confirmation from HDFC
  // ────────────────────────────────────────────────────────────

  async handleWebhook(db: PrismaClient, body: Record<string, unknown>, signatureHeader: string | null): Promise<{ ok: boolean }> {
    const orderId =
      (typeof body.order_id === "string" ? body.order_id : null) ??
      (typeof body.orderId  === "string" ? body.orderId  : null);
    if (!orderId) return { ok: false };

    const attempt = await db.fee_payment_attempts.findUnique({
      where: { order_id: orderId },
    });
    if (!attempt) return { ok: false };

    // Verify HMAC header (HDFC signs the raw JSON body).
    if (signatureHeader) {
      const cfg = await this.hdfc.get(true, db);
      if (cfg.apiKey) {
        const expected = createHmac("sha256", cfg.apiKey).update(JSON.stringify(body)).digest("hex");
        if (signatureHeader !== expected) {
          this.logger.warn(`HDFC webhook signature mismatch for ${orderId}`);
          return { ok: false };
        }
      }
    }

    const status = String(body.status ?? "").toUpperCase();
    if (status === "CHARGED" || status === "SUCCESS") {
      await this.creditPayment(db, orderId, typeof body.txn_id === "string" ? body.txn_id : null);
    } else if (status === "FAILED" || status === "PENDING_VBV" || status === "AUTHORIZATION_FAILED") {
      await this.markAttempt(db, orderId, "failed", {
        gatewayTxnId: typeof body.txn_id === "string" ? body.txn_id : null,
        errorMessage: String(body.error_message ?? status).slice(0, 240),
      });
    }
    return { ok: true };
  }

  // ────────────────────────────────────────────────────────────
  // 4. Inspection — for the admin payment-attempts log
  // ────────────────────────────────────────────────────────────

  async listAttempts(db: PrismaClient, srNumber?: number): Promise<PaymentAttempt[]> {
    const rows = await db.fee_payment_attempts.findMany({
      where: srNumber ? { sr_number: srNumber } : undefined,
      orderBy: { id: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      orderId: r.order_id,
      srNumber: r.sr_number,
      sessionCode: r.session_code,
      amount: r.amount,
      status: r.status as PaymentAttemptStatus,
      receiptNo: r.receipt_no,
      feePaymentId: r.fee_payment_id,
      errorMessage: r.error_message,
      createdAt: r.created_at.toISOString(),
      completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    }));
  }

  // ────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────

  /** Current academic session code for the given DB. */
  private async currentSessionCode(db: PrismaClient): Promise<string> {
    const row = await db.session.findFirst({
      where: { isCurrent: true },
      select: { code: true },
    });
    if (!row) throw new NotFoundException("No current academic session is set");
    return row.code;
  }

  /** Idempotent payment credit. Re-callable from return URL + webhook
   *  — the unique constraint on fee_payment_attempts.fee_payment_id
   *  guards against double-credit. */
  private async creditPayment(db: PrismaClient, orderId: string, gatewayTxnId: string | null): Promise<void> {
    const attempt = await db.fee_payment_attempts.findUnique({
      where: { order_id: orderId },
    });
    if (!attempt) return;
    if (attempt.status === "success" && attempt.fee_payment_id) {
      // Already credited — webhook is just retrying.
      return;
    }

    const receiptNo = await this.nextReceiptNo();
    await db.$transaction(async (tx) => {
      const payment = await tx.fee_payments.create({
        data: {
          sr_number: attempt.sr_number,
          session_code: attempt.session_code,
          receipt_no: receiptNo,
          amount: attempt.amount,
          paid_on: new Date(),
          method: "card",
          reference: `HDFC-${orderId}${gatewayTxnId ? `/${gatewayTxnId}` : ""}`.slice(0, 64),
          notes: `Paid via HDFC SmartGateway · order ${orderId}`,
          recorded_by: "hdfc.smartgateway",
        },
      });
      await tx.studentFee.update({
        where: { srNumber_sessionCode: { srNumber: attempt.sr_number, sessionCode: attempt.session_code } },
        data: {
          paidAmount: { increment: attempt.amount },
          dueAmount: { decrement: attempt.amount },
        },
      });
      await tx.fee_payment_attempts.update({
        where: { order_id: orderId },
        data: {
          status: "success",
          gateway_txn_id: gatewayTxnId,
          receipt_no: receiptNo,
          fee_payment_id: payment.id,
          completed_at: new Date(),
        },
      });
    });

    // Re-compute payment_status (paid/partial/pending) after the credit.
    const refreshed = await db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber: attempt.sr_number, sessionCode: attempt.session_code } },
    });
    if (refreshed) {
      const nextStatus = refreshed.dueAmount === 0 ? "paid" : refreshed.paidAmount > 0 ? "partial" : "pending";
      if (refreshed.paymentStatus !== nextStatus) {
        await db.studentFee.update({
          where: { srNumber_sessionCode: { srNumber: attempt.sr_number, sessionCode: attempt.session_code } },
          data: { paymentStatus: nextStatus },
        });
      }
    }
  }

  private async markAttempt(db: PrismaClient, orderId: string, status: PaymentAttemptStatus, patch: {
    gatewayTxnId?: string | null;
    errorMessage?: string | null;
  } = {}): Promise<void> {
    await db.fee_payment_attempts.update({
      where: { order_id: orderId },
      data: {
        status,
        gateway_txn_id: patch.gatewayTxnId ?? undefined,
        error_message: patch.errorMessage ?? undefined,
        completed_at: status === "success" || status === "failed" || status === "cancelled" || status === "expired"
          ? new Date()
          : undefined,
      },
    }).catch(() => undefined);
  }

  private async nextReceiptNo(): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = randomBytes(3).toString("hex").toUpperCase();
    return `R-${stamp}-${rand}`;
  }

  private publicBaseUrl(): string {
    return this.config.get<string>("PUBLIC_BASE_URL")
      ?? `http://localhost:${this.config.get<string>("PORT") ?? "4000"}`;
  }
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D+/g, "").replace(/^91/, "").slice(-10);
}

/**
 * HDFC's return-URL signature: HMAC-SHA256 over the alphabetically
 * sorted query params (excluding 'signature' itself), joined as
 * `key1=value1&key2=value2`. Some versions use base64-encoded HMAC;
 * we try hex and base64 and accept either.
 */
function verifyHdfcSignature(params: Record<string, string>, apiKey: string): boolean {
  const sig = params.signature;
  if (!sig) return false;
  const filtered = Object.entries(params)
    .filter(([k]) => k !== "signature" && params[k] !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  const canonical = filtered.map(([k, v]) => `${k}=${v}`).join("&");
  const hmac = createHmac("sha256", apiKey).update(canonical);
  const hex = hmac.digest("hex");
  const b64 = createHmac("sha256", apiKey).update(canonical).digest("base64");
  return sig === hex || sig === b64;
}
