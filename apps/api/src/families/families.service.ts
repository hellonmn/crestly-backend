import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type {
  Family,
  FamilyListItem,
  FamilyListQuery,
  FamilyListResponse,
  FamilyUpsert,
} from "@crestly/shared";

/**
 * Sibling families. The sibling-discount engine lives in
 * `lib/fees.php`'s recompute step; here we just surface family-level data
 * the families/* screens need: list with KPIs, detail with members and the
 * total yearly tuition_discount the family is receiving this session.
 */
@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async list(query: FamilyListQuery): Promise<FamilyListResponse> {
    const where: Prisma.SiblingFamilyWhereInput = query.q
      ? {
          OR: [
            { fatherName: { contains: query.q } },
            { motherName: { contains: query.q } },
          ],
        }
      : {};

    const [total, rows, allFamilies] = await Promise.all([
      this.prisma.db.siblingFamily.count({ where }),
      this.prisma.db.siblingFamily.findMany({
        where,
        orderBy: { familyId: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.siblingFamily.count(),
    ]);

    const familyIds = rows.map((r) => r.familyId);
    const enrolledCounts = familyIds.length
      ? await this.prisma.db.student.groupBy({
          by: ["familyId"],
          where: { familyId: { in: familyIds }, status: "active" },
          _count: { _all: true },
        })
      : [];
    const enrolledMap = new Map<number, number>(
      enrolledCounts
        .filter((c): c is { familyId: number; _count: { _all: number } } => c.familyId !== null)
        .map((c) => [c.familyId, c._count._all]),
    );

    // Yearly discount = SUM(tuition_discount) across all student_fees rows
    // in the current session for students in this family.
    const session = await this.sessions.current().catch(() => null);
    const discounts = session && familyIds.length
      ? await this.prisma.db.studentFee.findMany({
          where: { sessionCode: session.code, student: { familyId: { in: familyIds } } },
          select: { tuitionDiscount: true, student: { select: { familyId: true } } },
        })
      : [];
    const discountMap = new Map<number, number>();
    for (const d of discounts) {
      const fid = d.student.familyId;
      if (fid == null) continue;
      discountMap.set(fid, (discountMap.get(fid) ?? 0) + d.tuitionDiscount);
    }

    const items: FamilyListItem[] = rows.map((r) => ({
      familyId: r.familyId,
      fatherName: r.fatherName,
      motherName: r.motherName,
      siblingCount: r.siblingCount,
      enrolledCount: enrolledMap.get(r.familyId) ?? 0,
      yearlyDiscountTotal: discountMap.get(r.familyId) ?? 0,
    }));

    // Aggregate KPIs (across ALL families, not just the page).
    const [totalEnrolled, allDiscount, withDiscount] = await Promise.all([
      this.prisma.db.student.count({ where: { status: "active", familyId: { not: null } } }),
      session
        ? this.prisma.db.studentFee.aggregate({
            _sum: { tuitionDiscount: true },
            where: {
              sessionCode: session.code,
              student: { familyId: { not: null } },
            },
          })
        : Promise.resolve({ _sum: { tuitionDiscount: 0 } } as { _sum: { tuitionDiscount: number | null } }),
      session
        ? this.prisma.db.studentFee.findMany({
            where: {
              sessionCode: session.code,
              tuitionDiscount: { gt: 0 },
              student: { familyId: { not: null } },
            },
            select: { student: { select: { familyId: true } } },
            distinct: ["srNumber"],
          })
        : Promise.resolve([]),
    ]);
    const uniqFamiliesWithDiscount = new Set<number>();
    for (const d of withDiscount as Array<{ student: { familyId: number | null } }>) {
      if (d.student.familyId != null) uniqFamiliesWithDiscount.add(d.student.familyId);
    }

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalFamilies: allFamilies,
      totalEnrolled,
      totalReceivingDiscount: uniqFamiliesWithDiscount.size,
      totalDiscountGiven: (allDiscount._sum.tuitionDiscount as number | null) ?? 0,
    };
  }

  async findOne(familyId: number): Promise<Family> {
    const row = await this.prisma.db.siblingFamily.findUnique({ where: { familyId } });
    if (!row) throw new NotFoundException(`Family #${familyId} not found`);

    const session = await this.sessions.current().catch(() => null);
    // Pull every enrolled member (any status) so the page can render dropped /
    // transferred siblings with greyed-out pills.
    const members = await this.prisma.db.student.findMany({
      where: { familyId },
      select: {
        srNumber: true,
        studentName: true,
        class: true,
        section: true,
        status: true,
        dob: true,
      },
      orderBy: { dob: "asc" }, // eldest first — drives "1st / 2nd / 3rd child" labels
    });

    const memberSrs = members.map((m) => m.srNumber);
    const feeRows = session && memberSrs.length
      ? await this.prisma.db.studentFee.findMany({
          where: { sessionCode: session.code, srNumber: { in: memberSrs } },
          select: {
            srNumber: true,
            siblingDiscountPct: true,
            tuitionDiscount: true,
            totalThisYear: true,
            dueAmount: true,
            paymentStatus: true,
          },
        })
      : [];
    const feeBySr = new Map<number, typeof feeRows[number]>();
    for (const f of feeRows) feeBySr.set(f.srNumber, f);

    const yearlyDiscountTotal = feeRows.reduce((s, f) => s + f.tuitionDiscount, 0);
    const totalYearlyFee = feeRows.reduce((s, f) => s + f.totalThisYear, 0);
    const activeCount = members.filter((m) => m.status === "active").length;

    return {
      familyId: row.familyId,
      fatherName: row.fatherName,
      motherName: row.motherName,
      siblingCount: row.siblingCount,
      membersText: row.membersText,
      enrolledCount: members.length,
      activeCount,
      members: members.map((m) => {
        const f = feeBySr.get(m.srNumber);
        return {
          srNumber: m.srNumber,
          studentName: m.studentName,
          class: m.class,
          section: m.section,
          status: m.status,
          dob: m.dob ? m.dob.toISOString().slice(0, 10) : null,
          siblingDiscountPct: f ? Number(f.siblingDiscountPct) : 0,
          paymentStatus: f?.paymentStatus ?? null,
          dueAmount: f?.dueAmount ?? 0,
        };
      }),
      yearlyDiscountTotal,
      totalYearlyFee,
    };
  }

  async create(input: FamilyUpsert): Promise<Family> {
    const familyId = input.familyId ?? (await this.nextFamilyId());
    const clash = await this.prisma.db.siblingFamily.findUnique({ where: { familyId } });
    if (clash) throw new ConflictException(`Family #${familyId} already exists`);
    await this.prisma.db.siblingFamily.create({
      data: {
        familyId,
        fatherName: input.fatherName,
        motherName: input.motherName,
        siblingCount: input.siblingCount,
        membersText: input.membersText,
      },
    });
    return this.findOne(familyId);
  }

  async update(familyId: number, input: FamilyUpsert): Promise<Family> {
    await this.findOne(familyId);
    await this.prisma.db.siblingFamily.update({
      where: { familyId },
      data: {
        fatherName: input.fatherName,
        motherName: input.motherName,
        siblingCount: input.siblingCount,
        membersText: input.membersText,
      },
    });
    return this.findOne(familyId);
  }

  async delete(familyId: number): Promise<{ ok: true }> {
    const enrolled = await this.prisma.db.student.count({
      where: { familyId, status: "active" },
    });
    if (enrolled > 0) {
      throw new BadRequestException(
        `${enrolled} student(s) are still linked to this family. Move them to another family first.`,
      );
    }
    await this.prisma.db.siblingFamily.delete({ where: { familyId } });
    return { ok: true };
  }

  private async nextFamilyId(): Promise<number> {
    const max = await this.prisma.db.siblingFamily.aggregate({ _max: { familyId: true } });
    return (max._max.familyId ?? 0) + 1;
  }
}
