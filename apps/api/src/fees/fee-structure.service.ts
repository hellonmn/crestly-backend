import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { FeeStructureRow, FeeStructureUpsert, TransportSlabRow } from "@crestly/shared";

@Injectable()
export class FeeStructureService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(): Promise<FeeStructureRow[]> {
    const [recurring, oneTime, counts] = await Promise.all([
      this.prisma.db.fee_structure.findMany(),
      this.prisma.db.one_time_fees.findMany(),
      this.prisma.db.student.groupBy({
        by: ["class"],
        where: { status: "active" },
        _count: { _all: true },
      }),
    ]);

    const oneTimeMap = new Map(oneTime.map((r) => [r.class, r]));
    const countMap = new Map(counts.map((r) => [r.class, r._count._all]));

    return recurring.map((r) => {
      const ot = oneTimeMap.get(r.class);
      const recurringTotal = r.tuition_yearly + r.annual_charges + r.activity_fee + r.exam_fee;
      const oneTimeTotal = (ot?.registration_fee ?? 0) + (ot?.admission_fee ?? 0) + (ot?.caution_money ?? 0);
      return {
        class: r.class,
        tuitionYearly: r.tuition_yearly,
        annualCharges: r.annual_charges,
        activityFee: r.activity_fee,
        examFee: r.exam_fee,
        recurringTotal,
        registrationFee: ot?.registration_fee ?? 0,
        admissionFee: ot?.admission_fee ?? 0,
        cautionMoney: ot?.caution_money ?? 0,
        oneTimeTotal,
        studentCount: countMap.get(r.class) ?? 0,
      };
    });
  }

  async findOne(classSlug: string): Promise<FeeStructureRow> {
    const all = await this.list();
    const row = all.find((r) => r.class === classSlug);
    if (!row) throw new NotFoundException(`Fee structure for '${classSlug}' not found`);
    return row;
  }

  async update(classSlug: string, input: FeeStructureUpsert): Promise<FeeStructureRow> {
    await this.prisma.db.$transaction([
      this.prisma.db.fee_structure.upsert({
        where: { class: classSlug },
        update: {
          tuition_yearly: input.tuitionYearly,
          annual_charges: input.annualCharges,
          activity_fee: input.activityFee,
          exam_fee: input.examFee,
        },
        create: {
          class: classSlug,
          tuition_yearly: input.tuitionYearly,
          annual_charges: input.annualCharges,
          activity_fee: input.activityFee,
          exam_fee: input.examFee,
        },
      }),
      this.prisma.db.one_time_fees.upsert({
        where: { class: classSlug },
        update: {
          registration_fee: input.registrationFee,
          admission_fee: input.admissionFee,
          caution_money: input.cautionMoney,
        },
        create: {
          class: classSlug,
          registration_fee: input.registrationFee,
          admission_fee: input.admissionFee,
          caution_money: input.cautionMoney,
        },
      }),
    ]);
    return this.findOne(classSlug);
  }

  async slabs(): Promise<TransportSlabRow[]> {
    const rows = await this.prisma.db.transport_slabs.findMany({
      orderBy: { min_km: "asc" },
    });
    return rows.map((r) => ({
      slab: r.slab,
      distanceRange: r.distance_range,
      minKm: Number(r.min_km),
      maxKm: Number(r.max_km),
      yearlyFee: r.yearly_fee,
      quarterlyFee: r.quarterly_fee,
      monthlyFee: r.monthly_fee,
    }));
  }
}
