import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import { WhatsappEvents } from "../whatsapp/events.service";
import type {
  Voucher, VoucherApproveInput, VoucherCreateInput,
  VoucherListQuery, VoucherListResponse, VoucherMarkPaidInput,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class VouchersService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly uploads: UploadsService,
    private readonly wa: WhatsappEvents,
  ) {}

  async attach(
    voucherId: number,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    user: CurrentUser,
  ): Promise<Voucher> {
    const voucher = await this.prisma.db.vouchers.findUnique({ where: { id: voucherId } });
    if (!voucher) throw new NotFoundException();
    if (voucher.created_by !== user.id && !user.permissions.includes("vouchers.approve")) {
      throw new ForbiddenException("Only the creator (or approver) can attach files.");
    }
    const saved = await this.uploads.save("voucher", file.originalname, file.buffer);
    await this.prisma.db.voucher_attachments.create({
      data: {
        voucher_id: voucherId,
        file_path: saved.filePath,
        original_name: file.originalname,
        mime_type: file.mimetype ?? saved.mimeType,
        size_bytes: saved.sizeBytes,
        uploaded_by: user.id,
      },
    });
    return this.findOne(voucherId, user);
  }

  async removeAttachment(
    voucherId: number,
    attachmentId: number,
    user: CurrentUser,
  ): Promise<Voucher> {
    const voucher = await this.prisma.db.vouchers.findUnique({ where: { id: voucherId } });
    if (!voucher) throw new NotFoundException();
    if (voucher.created_by !== user.id) {
      throw new ForbiddenException("Only the creator can remove an attachment.");
    }
    await this.prisma.db.voucher_attachments.delete({ where: { id: attachmentId } });
    return this.findOne(voucherId, user);
  }

  async list(query: VoucherListQuery, user: CurrentUser): Promise<VoucherListResponse> {
    const canSeeAll = user.permissions.includes("vouchers.view_all");
    const where: Prisma.vouchersWhereInput = {
      ...(!canSeeAll || query.mine ? { created_by: user.id } : {}),
      ...(query.status && { status: query.status }),
      ...(query.payment && { payment_status: query.payment }),
      ...(query.category && { category: query.category }),
      ...((query.from || query.to) && {
        voucher_date: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lte: new Date(query.to) }),
        },
      }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q } },
          { vendor_name: { contains: query.q } },
          { voucher_no: { contains: query.q } },
        ],
      }),
    };

    const [total, rows, agg, paid, credit, pending, catsRaw] = await Promise.all([
      this.prisma.db.vouchers.count({ where }),
      this.prisma.db.vouchers.findMany({
        where,
        include: this.includeFull(),
        orderBy: [{ voucher_date: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.vouchers.aggregate({ where, _sum: { amount: true } }),
      this.prisma.db.vouchers.aggregate({ where: { ...where, payment_status: "paid" }, _sum: { amount: true } }),
      this.prisma.db.vouchers.aggregate({
        where: { ...where, is_credit_bill: true, payment_status: { not: "paid" } },
        _sum: { amount: true },
      }),
      this.prisma.db.vouchers.count({ where: { ...where, status: "pending_approval" } }),
      this.prisma.db.vouchers.findMany({
        distinct: ["category"],
        select: { category: true },
        where: { category: { not: null } },
        orderBy: { category: "asc" },
      }),
    ]);

    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalAmount: agg._sum.amount ?? 0,
      paidAmount: paid._sum.amount ?? 0,
      creditUnpaid: credit._sum.amount ?? 0,
      pendingApproval: pending,
      categories: catsRaw.map((c) => c.category!).filter(Boolean),
    };
  }

  async findOne(id: number, user: CurrentUser): Promise<Voucher> {
    const row = await this.prisma.db.vouchers.findUnique({
      where: { id },
      include: this.includeFull(),
    });
    if (!row) throw new NotFoundException();
    const canSeeAll = user.permissions.includes("vouchers.view_all");
    const isMine = row.created_by === user.id;
    const isApprover = row.voucher_approvers.some((a) => a.approver_user_id === user.id);
    if (!canSeeAll && !isMine && !isApprover) {
      throw new ForbiddenException("You can't view this voucher.");
    }
    return toDto(row);
  }

  async create(input: VoucherCreateInput, user: CurrentUser): Promise<Voucher> {
    const voucherNo = await this.nextVoucherNo();
    const created = await this.prisma.db.vouchers.create({
      data: {
        voucher_no: voucherNo,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        amount: input.amount,
        vendor_name: input.vendorName ?? null,
        vendor_contact: input.vendorContact ?? null,
        salary_user_id: input.salaryUserId ?? null,
        salary_month: input.salaryMonth ?? null,
        voucher_date: new Date(input.voucherDate),
        is_credit_bill: input.isCreditBill,
        notes: input.notes ?? null,
        created_by: user.id,
        status: input.approverUserIds.length > 0 ? "pending_approval" : "draft",
        voucher_approvers: {
          create: input.approverUserIds.map((uid) => ({ approver_user_id: uid })),
        },
      },
      include: this.includeFull(),
    });

    // Notify each pending approver on WhatsApp.
    if (created.status === "pending_approval") {
      void this.wa.voucherPendingApproval(created.id);
    }

    return toDto(created);
  }

  async update(id: number, input: VoucherCreateInput, user: CurrentUser): Promise<Voucher> {
    const existing = await this.prisma.db.vouchers.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (existing.created_by !== user.id && !user.permissions.includes("vouchers.approve")) {
      throw new ForbiddenException("Only the creator (or an approver) can edit this voucher.");
    }
    if (existing.status === "approved" || existing.status === "paid_via_payment" as never) {
      // Approved/paid vouchers are locked. (Note: status enum doesn't have paid_via_payment; left as safety net.)
      throw new BadRequestException("Approved vouchers cannot be edited.");
    }

    await this.prisma.db.$transaction([
      this.prisma.db.vouchers.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description ?? null,
          category: input.category ?? null,
          amount: input.amount,
          vendor_name: input.vendorName ?? null,
          vendor_contact: input.vendorContact ?? null,
          salary_user_id: input.salaryUserId ?? null,
          salary_month: input.salaryMonth ?? null,
          voucher_date: new Date(input.voucherDate),
          is_credit_bill: input.isCreditBill,
          notes: input.notes ?? null,
        },
      }),
      this.prisma.db.voucher_approvers.deleteMany({ where: { voucher_id: id } }),
      ...input.approverUserIds.map((uid) =>
        this.prisma.db.voucher_approvers.create({
          data: { voucher_id: id, approver_user_id: uid },
        }),
      ),
    ]);
    return this.findOne(id, user);
  }

  async approve(id: number, input: VoucherApproveInput, user: CurrentUser): Promise<Voucher> {
    const voucher = await this.prisma.db.vouchers.findUnique({
      where: { id },
      include: { voucher_approvers: true },
    });
    if (!voucher) throw new NotFoundException();

    const me = voucher.voucher_approvers.find((a) => a.approver_user_id === user.id);
    if (!me) throw new ForbiddenException("You are not listed as an approver for this voucher.");
    if (me.status !== "pending") throw new BadRequestException("You already acted on this voucher.");

    await this.prisma.db.voucher_approvers.update({
      where: { id: me.id },
      data: {
        status: input.decision === "approve" ? "approved" : "rejected",
        remarks: input.remarks ?? null,
        action_at: new Date(),
      },
    });

    // Recompute overall status: any rejection → rejected; all approved → approved.
    const updated = await this.prisma.db.voucher_approvers.findMany({ where: { voucher_id: id } });
    const anyReject = updated.some((a) => a.status === "rejected");
    const allApprove = updated.every((a) => a.status === "approved");
    if (anyReject) {
      await this.prisma.db.vouchers.update({
        where: { id },
        data: {
          status: "rejected",
          rejected_by: user.id, rejected_at: new Date(),
          rejected_reason: input.remarks ?? null,
        },
      });
    } else if (allApprove) {
      await this.prisma.db.vouchers.update({
        where: { id },
        data: { status: "approved", approved_at: new Date() },
      });
    }

    return this.findOne(id, user);
  }

  async markPaid(id: number, input: VoucherMarkPaidInput, user: CurrentUser): Promise<Voucher> {
    if (!user.permissions.includes("vouchers.pay")) {
      throw new ForbiddenException("Missing vouchers.pay permission.");
    }
    const voucher = await this.prisma.db.vouchers.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException();
    if (voucher.status !== "approved") {
      throw new BadRequestException("Only approved vouchers can be marked paid.");
    }

    await this.prisma.db.vouchers.update({
      where: { id },
      data: {
        payment_status: "paid",
        payment_method: input.paymentMethod,
        payment_date: new Date(input.paymentDate),
        payment_ref: input.paymentRef ?? null,
        paid_by: user.id,
        paid_at: new Date(),
      },
    });

    // Ping the recipient (and the voucher creator if no recipient) on WhatsApp.
    void this.wa.voucherPaid(id);

    return this.findOne(id, user);
  }

  async cancel(id: number, user: CurrentUser): Promise<Voucher> {
    const voucher = await this.prisma.db.vouchers.findUnique({ where: { id } });
    if (!voucher) throw new NotFoundException();
    if (voucher.created_by !== user.id) {
      throw new ForbiddenException("Only the creator can cancel a voucher.");
    }
    if (voucher.payment_status === "paid") {
      throw new BadRequestException("Paid vouchers cannot be cancelled.");
    }
    await this.prisma.db.vouchers.update({
      where: { id },
      data: { status: "cancelled" },
    });
    return this.findOne(id, user);
  }

  private includeFull() {
    return {
      voucher_approvers: { include: { users: { select: { id: true, name: true } } } },
      voucher_attachments: { include: { users: { select: { name: true } } } },
      users_vouchers_created_byTousers: { select: { name: true } },
      users_vouchers_rejected_byTousers: { select: { name: true } },
      users_vouchers_paid_byTousers: { select: { name: true } },
      users_vouchers_salary_user_idTousers: { select: { name: true } },
    } as const;
  }

  private async nextVoucherNo(): Promise<string> {
    const yr = new Date().getFullYear();
    const prefix = `V${yr}/`;
    const last = await this.prisma.db.vouchers.findFirst({
      where: { voucher_no: { startsWith: prefix } },
      orderBy: { id: "desc" },
      select: { voucher_no: true },
    });
    const next = last
      ? Number(last.voucher_no.split("/").pop() ?? "0") + 1
      : 1;
    return `${prefix}${String(next).padStart(5, "0")}`;
  }
}

function toDto(r: any): Voucher {
  return {
    id: r.id,
    voucherNo: r.voucher_no,
    title: r.title,
    description: r.description,
    category: r.category,
    amount: r.amount,
    vendorName: r.vendor_name,
    vendorContact: r.vendor_contact,
    salaryUserId: r.salary_user_id,
    salaryUserName: r.users_vouchers_salary_user_idTousers?.name ?? null,
    salaryMonth: r.salary_month,
    voucherDate: r.voucher_date.toISOString().slice(0, 10),
    status: r.status,
    paymentStatus: r.payment_status,
    isCreditBill: r.is_credit_bill,
    paymentMethod: r.payment_method,
    paymentDate: r.payment_date ? r.payment_date.toISOString().slice(0, 10) : null,
    paymentRef: r.payment_ref,
    notes: r.notes,
    rejectedReason: r.rejected_reason,
    createdBy: r.created_by,
    createdByName: r.users_vouchers_created_byTousers?.name ?? null,
    approvedAt: r.approved_at ? r.approved_at.toISOString() : null,
    rejectedByName: r.users_vouchers_rejected_byTousers?.name ?? null,
    rejectedAt: r.rejected_at ? r.rejected_at.toISOString() : null,
    paidByName: r.users_vouchers_paid_byTousers?.name ?? null,
    paidAt: r.paid_at ? r.paid_at.toISOString() : null,
    createdAt: r.created_at ? r.created_at.toISOString() : new Date(0).toISOString(),
    updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date(0).toISOString(),
    approvers: (r.voucher_approvers ?? []).map((a: any) => ({
      id: a.id,
      approverUserId: a.approver_user_id,
      approverName: a.users?.name ?? `User #${a.approver_user_id}`,
      status: a.status,
      remarks: a.remarks,
      actionAt: a.action_at ? a.action_at.toISOString() : null,
    })),
    attachments: (r.voucher_attachments ?? []).map((a: any) => ({
      id: a.id,
      filePath: a.file_path,
      originalName: a.original_name,
      mimeType: a.mime_type,
      sizeBytes: a.size_bytes,
      uploadedByName: a.users?.name ?? null,
      uploadedAt: a.uploaded_at ? a.uploaded_at.toISOString() : null,
    })),
  };
}
