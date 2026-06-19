import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type {
  PromotionOverview, PromotionSectionQuery, PromotionStudent,
  PromoteSectionBulk, PromotionStatus,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/**
 * Year-end student promotion. Mirrors erp/promotion/index.php — section-by-section
 * decisions, then a one-shot "finalise + switch session" at the end.
 */
@Injectable()
export class PromotionService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  /** Pick "from" + "to" session pair for this promotion cycle. */
  private async sessionPair() {
    const sessions = await this.prisma.db.session.findMany({ orderBy: { code: "asc" } });
    const currentIdx = sessions.findIndex((s) => s.isCurrent);
    if (currentIdx < 0 || currentIdx + 1 >= sessions.length) {
      throw new BadRequestException("No future session row defined. Create the next session first.");
    }
    return { from: sessions[currentIdx]!, to: sessions[currentIdx + 1]! };
  }

  async overview(): Promise<PromotionOverview> {
    const { from, to } = await this.sessionPair();

    const students = await this.prisma.db.student.findMany({
      where: { status: "active" },
      select: { srNumber: true, class: true, section: true },
    });

    const promos = await this.prisma.db.student_promotions.findMany({
      where: { from_session: from.code, to_session: to.code },
    });
    const promoMap = new Map(promos.map((p) => [p.sr_number, p]));

    const fees = await this.prisma.db.studentFee.findMany({
      where: { sessionCode: from.code },
      select: { srNumber: true, dueAmount: true },
    });
    const feeMap = new Map(fees.map((f) => [f.srNumber, f.dueAmount]));

    const sectionMap = new Map<string, { pending: number; promoted: number; heldBack: number; graduated: number }>();
    let duesCarried = 0;

    for (const s of students) {
      const key = `${s.class}|${s.section}`;
      const slot = sectionMap.get(key) ?? { pending: 0, promoted: 0, heldBack: 0, graduated: 0 };
      const p = promoMap.get(s.srNumber);
      if (!p) slot.pending++;
      else if (p.action === "promoted") slot.promoted++;
      else if (p.action === "held_back") slot.heldBack++;
      else if (p.action === "graduated") slot.graduated++;
      sectionMap.set(key, slot);
      duesCarried += feeMap.get(s.srNumber) ?? 0;
    }

    const decided = promos.length;
    return {
      fromSession: from.code,
      toSession: to.code,
      totals: {
        active: students.length,
        decided,
        pending: students.length - decided,
        duesCarried,
      },
      sections: Array.from(sectionMap.entries()).map(([key, v]) => {
        const [classSlug, sectionCode] = key.split("|");
        return { classSlug: classSlug ?? "", sectionCode: sectionCode ?? "", ...v };
      }).sort((a, b) => (a.classSlug + a.sectionCode).localeCompare(b.classSlug + b.sectionCode)),
    };
  }

  async section(query: PromotionSectionQuery): Promise<PromotionStudent[]> {
    const { from, to } = await this.sessionPair();
    const students = await this.prisma.db.student.findMany({
      where: { class: query.class, section: query.section, status: "active" },
      select: { srNumber: true, studentName: true, class: true, section: true },
      orderBy: { studentName: "asc" },
    });
    const promos = await this.prisma.db.student_promotions.findMany({
      where: { from_session: from.code, to_session: to.code, sr_number: { in: students.map((s) => s.srNumber) } },
    });
    const promoMap = new Map(promos.map((p) => [p.sr_number, p]));
    const fees = await this.prisma.db.studentFee.findMany({
      where: { sessionCode: from.code, srNumber: { in: students.map((s) => s.srNumber) } },
      select: { srNumber: true, dueAmount: true },
    });
    const feeMap = new Map(fees.map((f) => [f.srNumber, f.dueAmount]));

    return students.map((s) => {
      const p = promoMap.get(s.srNumber);
      const status: PromotionStatus = !p
        ? "pending"
        : p.action === "promoted" ? "promoted"
          : p.action === "held_back" ? "held_back"
            : "graduated";
      return {
        srNumber: s.srNumber,
        studentName: s.studentName,
        fromClass: s.class,
        fromSection: s.section,
        toClass: p?.to_class ?? null,
        toSection: p?.to_section ?? null,
        status,
        outstandingDue: feeMap.get(s.srNumber) ?? 0,
      };
    });
  }

  async promoteSection(input: PromoteSectionBulk, user: CurrentUser): Promise<{ ok: true; count: number }> {
    const { from, to } = await this.sessionPair();
    let count = 0;
    for (const d of input.decisions) {
      const action: "promoted" | "held_back" | "graduated" =
        d.action === "promote" ? "promoted"
          : d.action === "graduate" ? "graduated"
            : "held_back";

      const toClass = action === "promoted" ? (d.toClass ?? input.defaultToClass ?? null) : null;
      const toSection = action === "promoted" ? (d.toSection ?? input.defaultToSection ?? null) : null;

      const existing = await this.prisma.db.student_promotions.findFirst({
        where: { from_session: from.code, to_session: to.code, sr_number: d.srNumber },
      });
      if (existing) {
        await this.prisma.db.student_promotions.update({
          where: { id: existing.id },
          data: {
            action, to_class: toClass, to_section: toSection,
            promoted_by: user.id, promoted_at: new Date(),
          },
        });
      } else {
        const due = await this.prisma.db.studentFee.findUnique({
          where: { srNumber_sessionCode: { srNumber: d.srNumber, sessionCode: from.code } },
        });
        await this.prisma.db.student_promotions.create({
          data: {
            from_session: from.code, to_session: to.code,
            sr_number: d.srNumber, from_class: input.class, from_section: input.section,
            to_class: toClass, to_section: toSection, action,
            outstanding_at_promo: due?.dueAmount ?? 0,
            promoted_by: user.id,
          },
        });
      }
      count++;
    }
    return { ok: true, count };
  }

  async finalize(user: CurrentUser): Promise<{ ok: true; promoted: number; graduated: number; heldBack: number }> {
    const { from, to } = await this.sessionPair();

    const promos = await this.prisma.db.student_promotions.findMany({
      where: { from_session: from.code, to_session: to.code },
    });
    if (promos.length === 0) throw new BadRequestException("No decisions recorded yet.");

    const pending = await this.prisma.db.student.count({
      where: { status: "active", NOT: { srNumber: { in: promos.map((p) => p.sr_number) } } },
    });
    if (pending > 0) {
      throw new BadRequestException(`${pending} active student(s) still need a decision.`);
    }

    // Apply: promoted → update class/section; graduated → set status='inactive';
    // held-back → leave as-is.
    const counters = { promoted: 0, graduated: 0, heldBack: 0 };
    for (const p of promos) {
      if (p.action === "promoted" && p.to_class && p.to_section) {
        await this.prisma.db.student.update({
          where: { srNumber: p.sr_number },
          data: { class: p.to_class, section: p.to_section },
        });
        counters.promoted++;
      } else if (p.action === "graduated") {
        await this.prisma.db.student.update({
          where: { srNumber: p.sr_number },
          data: { status: "inactive" },
        });
        counters.graduated++;
      } else {
        counters.heldBack++;
      }
    }

    // Flip is_current.
    await this.prisma.db.$transaction([
      this.prisma.db.session.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
      this.prisma.db.session.update({
        where: { code: to.code },
        data: { isCurrent: true, promotedFrom: from.code, promotedAt: new Date() },
      }),
    ]);

    return { ok: true, ...counters };
  }
}
