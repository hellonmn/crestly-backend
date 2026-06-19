import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  PickupPoint, PickupPointDetail, PickupPointListResponse, PickupPointUpsertInput,
} from "@crestly/shared";

/**
 * Pickup-point CRUD + revenue summary. Slab is matched by `distance_km` against
 * `transport_slabs.min_km..max_km`. Revenue = sum of `transport_fee` across the
 * students assigned to this pickup point.
 */
@Injectable()
export class TransportService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: { q?: string }): Promise<PickupPointListResponse> {
    const points = await this.prisma.db.pickupPoint.findMany({
      where: query.q ? { name: { contains: query.q } } : undefined,
      orderBy: { name: "asc" },
    });
    const slabs = await this.prisma.db.transport_slabs.findMany({ orderBy: { min_km: "asc" } });
    const studentsByPickup = await this.prisma.db.student.groupBy({
      by: ["pickupPointId"],
      where: { status: "active", pickupPointId: { not: null } },
      _count: { _all: true },
    });
    const revenueAgg = await this.prisma.db.studentFee.groupBy({
      by: ["srNumber"] as const,
      where: { transportFee: { gt: 0 } },
      _sum: { transportFee: true },
    });
    const feeBySr = new Map(revenueAgg.map((r) => [r.srNumber, r._sum.transportFee ?? 0]));
    const studentToPickup = new Map(
      (await this.prisma.db.student.findMany({
        select: { srNumber: true, pickupPointId: true },
      })).map((s) => [s.srNumber, s.pickupPointId]),
    );

    const countMap = new Map<number, number>(
      studentsByPickup
        .filter((s): s is { pickupPointId: number; _count: { _all: number } } => s.pickupPointId != null)
        .map((s) => [s.pickupPointId, s._count._all]),
    );
    const revenueByPickup = new Map<number, number>();
    for (const [sr, fee] of feeBySr) {
      const pid = studentToPickup.get(sr);
      if (pid == null) continue;
      revenueByPickup.set(pid, (revenueByPickup.get(pid) ?? 0) + fee);
    }

    const items: PickupPoint[] = points.map((p) => {
      const km = p.distanceKm ? Number(p.distanceKm) : null;
      const slab = km != null ? slabs.find((s) => km >= Number(s.min_km) && km <= Number(s.max_km)) : null;
      return {
        id: p.id,
        name: p.name,
        latitude: p.latitude ? Number(p.latitude) : null,
        longitude: p.longitude ? Number(p.longitude) : null,
        distanceKm: km,
        googleMapsLink: p.googleMapsLink,
        slab: slab?.slab ?? null,
        studentCount: countMap.get(p.id) ?? 0,
        revenue: revenueByPickup.get(p.id) ?? 0,
      };
    });

    // Totals across the full system (independent of the `q` filter on `items`).
    const [totalPickups, activePickupsAgg] = await Promise.all([
      this.prisma.db.pickupPoint.count(),
      this.prisma.db.student.groupBy({
        by: ["pickupPointId"],
        where: { status: "active", pickupPointId: { not: null } },
        _count: { _all: true },
      }),
    ]);
    const activePickups = activePickupsAgg
      .filter((s) => s.pickupPointId !== null && s._count._all > 0).length;

    return {
      items,
      totalPickups,
      activePickups,
      totalStudents: items.reduce((s, i) => s + i.studentCount, 0),
      totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
      totalSlabs: slabs.length,
    };
  }

  async findOne(id: number): Promise<PickupPointDetail> {
    const point = await this.prisma.db.pickupPoint.findUnique({ where: { id } });
    if (!point) throw new NotFoundException();

    const slabs = await this.prisma.db.transport_slabs.findMany();
    const km = point.distanceKm ? Number(point.distanceKm) : null;
    const slab = km != null ? slabs.find((s) => km >= Number(s.min_km) && km <= Number(s.max_km)) : null;

    const students = await this.prisma.db.student.findMany({
      where: { pickupPointId: id, status: "active" },
      orderBy: { studentName: "asc" },
      include: {
        fees: { select: { paymentStatus: true, sessionCode: true }, orderBy: { sessionCode: "desc" }, take: 1 },
      },
    });

    const fees = await this.prisma.db.studentFee.findMany({
      where: { srNumber: { in: students.map((s) => s.srNumber) } },
      select: { srNumber: true, transportFee: true },
    });
    const revenue = fees.reduce((s, f) => s + f.transportFee, 0);

    return {
      id: point.id,
      name: point.name,
      latitude: point.latitude ? Number(point.latitude) : null,
      longitude: point.longitude ? Number(point.longitude) : null,
      distanceKm: km,
      googleMapsLink: point.googleMapsLink,
      slab: slab?.slab ?? null,
      studentCount: students.length,
      revenue,
      yearlyFee: slab?.yearly_fee ?? null,
      quarterlyFee: slab?.quarterly_fee ?? null,
      monthlyFee: slab?.monthly_fee ?? null,
      students: students.map((st) => ({
        srNumber: st.srNumber,
        studentName: st.studentName,
        class: st.class,
        section: st.section,
        feeStatus: st.fees[0]?.paymentStatus ?? null,
      })),
    };
  }

  async create(input: PickupPointUpsertInput): Promise<PickupPointDetail> {
    const clash = await this.prisma.db.pickupPoint.findUnique({ where: { name: input.name } });
    if (clash) throw new ConflictException(`Pickup point "${input.name}" already exists`);
    const created = await this.prisma.db.pickupPoint.create({
      data: {
        name: input.name,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        distanceKm: input.distanceKm ?? null,
        googleMapsLink: input.googleMapsLink ?? null,
      },
    });
    return this.findOne(created.id);
  }

  async update(id: number, input: PickupPointUpsertInput): Promise<PickupPointDetail> {
    const existing = await this.prisma.db.pickupPoint.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (input.name !== existing.name) {
      const clash = await this.prisma.db.pickupPoint.findUnique({ where: { name: input.name } });
      if (clash) throw new ConflictException(`Pickup point "${input.name}" already exists`);
    }
    await this.prisma.db.pickupPoint.update({
      where: { id },
      data: {
        name: input.name,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        distanceKm: input.distanceKm ?? null,
        googleMapsLink: input.googleMapsLink ?? null,
      },
    });
    return this.findOne(id);
  }

  async delete(id: number): Promise<{ ok: true }> {
    const count = await this.prisma.db.student.count({ where: { pickupPointId: id } });
    if (count > 0) {
      throw new BadRequestException(`${count} student(s) are still assigned to this pickup point.`);
    }
    await this.prisma.db.pickupPoint.delete({ where: { id } });
    return { ok: true };
  }
}
