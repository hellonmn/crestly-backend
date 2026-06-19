import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import type {
  Leave, LeaveApplyInput, LeaveBalance, LeaveDecisionInput, LeaveListQuery, LeaveListResponse, LeaveType,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class LeavesService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async uploadAttachment(
    leaveId: number,
    file: { originalname: string; buffer: Buffer; mimetype: string },
    user: CurrentUser,
  ): Promise<Leave> {
    const leave = await this.prisma.db.leaves.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException();
    if (leave.user_id !== user.id) throw new ForbiddenException("Not your leave.");
    const saved = await this.uploads.save("leave", file.originalname, file.buffer);
    const updated = await this.prisma.db.leaves.update({
      where: { id: leaveId },
      data: { attachment_path: saved.filePath },
      include: {
        users_leaves_user_idTousers: { select: { id: true, name: true } },
        leave_types: { select: { name: true, short_code: true } },
        users_leaves_decided_byTousers: { select: { name: true } },
      },
    });
    return leaveDto(updated);
  }

  async list(query: LeaveListQuery, user: CurrentUser): Promise<LeaveListResponse> {
    const isApprover = user.permissions.includes("leaves.approve");
    const where: Prisma.leavesWhereInput = {};
    if (query.scope === "mine" || !isApprover) where.user_id = user.id;
    if (query.status) where.status = query.status;
    if (query.leaveTypeId) where.leave_type_id = query.leaveTypeId;

    const [items, pendingCount, balances] = await Promise.all([
      this.prisma.db.leaves.findMany({
        where,
        include: {
          users_leaves_user_idTousers: { select: { id: true, name: true } },
          leave_types: { select: { name: true, short_code: true } },
          users_leaves_decided_byTousers: { select: { name: true } },
        },
        orderBy: { id: "desc" },
        take: 200,
      }),
      this.prisma.db.leaves.count({
        where: { ...where, status: "pending" },
      }),
      this.computeBalances(user.id),
    ]);

    return {
      items: items.map(leaveDto),
      pendingCount,
      balances,
    };
  }

  async types(): Promise<LeaveType[]> {
    const rows = await this.prisma.db.leave_types.findMany({ orderBy: { sort_order: "asc" } });
    return rows.map((r) => ({
      id: r.id, slug: r.slug, name: r.name, shortCode: r.short_code,
      annualQuota: Number(r.annual_quota), isPaid: r.is_paid,
      carryForward: r.carry_forward, isSystem: r.is_system,
      colorHex: r.color_hex, sortOrder: r.sort_order,
    }));
  }

  async apply(input: LeaveApplyInput, user: CurrentUser): Promise<Leave> {
    if (input.toDate < input.fromDate) {
      throw new BadRequestException("End date must be on or after start date.");
    }
    const days = computeDays(input.fromDate, input.toDate, input.halfDay);
    if (days <= 0) throw new BadRequestException("0-day leave not allowed.");

    const created = await this.prisma.db.leaves.create({
      data: {
        user_id: user.id,
        leave_type_id: input.leaveTypeId,
        from_date: new Date(input.fromDate),
        to_date: new Date(input.toDate),
        half_day: input.halfDay,
        days,
        reason: input.reason ?? null,
      },
      include: {
        users_leaves_user_idTousers: { select: { id: true, name: true } },
        leave_types: { select: { name: true, short_code: true } },
        users_leaves_decided_byTousers: { select: { name: true } },
      },
    });
    return leaveDto(created);
  }

  async decide(id: number, input: LeaveDecisionInput, user: CurrentUser): Promise<Leave> {
    if (!user.permissions.includes("leaves.approve")) {
      throw new ForbiddenException("Missing leaves.approve.");
    }
    const existing = await this.prisma.db.leaves.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (existing.status !== "pending") throw new BadRequestException("Leave is not pending.");

    const updated = await this.prisma.db.leaves.update({
      where: { id },
      data: {
        status: input.decision === "approve" ? "approved" : "rejected",
        decided_by: user.id,
        decided_at: new Date(),
        decision_note: input.decisionNote ?? null,
      },
      include: {
        users_leaves_user_idTousers: { select: { id: true, name: true } },
        leave_types: { select: { name: true, short_code: true } },
        users_leaves_decided_byTousers: { select: { name: true } },
      },
    });
    return leaveDto(updated);
  }

  async cancel(id: number, user: CurrentUser): Promise<Leave> {
    const existing = await this.prisma.db.leaves.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (existing.user_id !== user.id) throw new ForbiddenException("Not your leave.");
    if (existing.status !== "pending") {
      throw new BadRequestException("Only pending leaves can be cancelled.");
    }
    const updated = await this.prisma.db.leaves.update({
      where: { id },
      data: { status: "cancelled" },
      include: {
        users_leaves_user_idTousers: { select: { id: true, name: true } },
        leave_types: { select: { name: true, short_code: true } },
        users_leaves_decided_byTousers: { select: { name: true } },
      },
    });
    return leaveDto(updated);
  }

  private async computeBalances(userId: number): Promise<LeaveBalance[]> {
    const year = new Date().getFullYear();
    const types = await this.prisma.db.leave_types.findMany({ orderBy: { sort_order: "asc" } });
    const approvedAgg = await this.prisma.db.leaves.groupBy({
      by: ["leave_type_id"],
      where: { user_id: userId, status: "approved", from_date: { gte: new Date(Date.UTC(year, 0, 1)) } },
      _sum: { days: true },
    });
    const pendingAgg = await this.prisma.db.leaves.groupBy({
      by: ["leave_type_id"],
      where: { user_id: userId, status: "pending" },
      _sum: { days: true },
    });
    const overrides = await this.prisma.db.leave_balance_overrides.groupBy({
      by: ["leave_type_id"],
      where: { user_id: userId, year },
      _sum: { delta_days: true },
    });
    const takenMap = new Map(approvedAgg.map((a) => [a.leave_type_id, Number(a._sum.days ?? 0)]));
    const pendingMap = new Map(pendingAgg.map((a) => [a.leave_type_id, Number(a._sum.days ?? 0)]));
    const overrideMap = new Map(overrides.map((a) => [a.leave_type_id, Number(a._sum.delta_days ?? 0)]));

    return types.map((t) => {
      const quota = Number(t.annual_quota) + (overrideMap.get(t.id) ?? 0);
      const taken = takenMap.get(t.id) ?? 0;
      const pending = pendingMap.get(t.id) ?? 0;
      return {
        leaveTypeId: t.id,
        leaveType: t.name,
        shortCode: t.short_code,
        quota,
        taken,
        pending,
        left: Math.max(0, quota - taken - pending),
      };
    });
  }
}

function leaveDto(r: any): Leave {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.users_leaves_user_idTousers?.name ?? null,
    leaveTypeId: r.leave_type_id,
    leaveType: r.leave_types?.name ?? "",
    leaveShortCode: r.leave_types?.short_code ?? "",
    fromDate: r.from_date.toISOString().slice(0, 10),
    toDate: r.to_date.toISOString().slice(0, 10),
    halfDay: r.half_day,
    days: Number(r.days),
    reason: r.reason,
    attachmentPath: r.attachment_path,
    status: r.status,
    appliedAt: r.applied_at ? r.applied_at.toISOString() : null,
    decidedByName: r.users_leaves_decided_byTousers?.name ?? null,
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null,
    decisionNote: r.decision_note,
  };
}

function computeDays(fromIso: string, toIso: string, halfDay: "none" | "first_half" | "second_half"): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  const span = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (span === 1 && halfDay !== "none") return 0.5;
  // Skip Sundays in the count — mirrors PHP's day calc.
  let n = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    if (cursor.getUTCDay() !== 0) n++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return n;
}
