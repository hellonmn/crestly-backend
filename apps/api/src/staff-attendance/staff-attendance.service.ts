import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { UploadsService } from "../uploads/uploads.service";
import type {
  PunchCreateInput,
  PunchTodayResponse,
  StaffPunch,
  StaffPunchListQuery,
  StaffPunchListResponse,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/** Match PHP PUNCH_OUT_COOLDOWN_SECS default — 15 min. */
const DEFAULT_COOLDOWN_SECS = 15 * 60;
const DEFAULT_RADIUS_M = 100;

/** Haversine distance in metres between two lat/lng pairs. */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

@Injectable()
export class StaffAttendanceService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async list(query: StaffPunchListQuery): Promise<StaffPunchListResponse> {
    const where: Prisma.staff_attendanceWhereInput = {
      ...(query.userId && { user_id: query.userId }),
      ...(query.punchType && { punch_type: query.punchType }),
      ...(query.zone === "outside" && { is_outside: true }),
      ...(query.zone === "in" && { is_outside: false }),
      ...((query.from || query.to) && {
        punched_at: {
          ...(query.from && { gte: new Date(`${query.from}T00:00:00`) }),
          ...(query.to && { lte: new Date(`${query.to}T23:59:59`) }),
        },
      }),
    };

    const [total, rows, ins, outs, outside] = await Promise.all([
      this.prisma.db.staff_attendance.count({ where }),
      this.prisma.db.staff_attendance.findMany({
        where,
        include: { users: { select: { id: true, name: true, designation: true, department: true } } },
        orderBy: { punched_at: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.staff_attendance.count({ where: { ...where, punch_type: "in" } }),
      this.prisma.db.staff_attendance.count({ where: { ...where, punch_type: "out" } }),
      this.prisma.db.staff_attendance.count({ where: { ...where, is_outside: true } }),
    ]);

    return {
      items: rows.map((r) => toDto(r)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      punchIns: ins,
      punchOuts: outs,
      outsideCount: outside,
    };
  }

  async findOne(id: number): Promise<StaffPunch> {
    const row = await this.prisma.db.staff_attendance.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true, name: true, designation: true, department: true,
            phone: true, roleId: true, reporting_user_id: true,
            role: { select: { name: true } },
            users: { select: { name: true } },   // self-relation = reports-to
          },
        },
        pickup_points: { select: { name: true, latitude: true, longitude: true } },
      },
    });
    if (!row) throw new NotFoundException(`Punch #${id} not found`);

    // Resolve geofence centre — pickup row if this was a pickup punch, else
    // the school coords from school_info. Drives the Compare-maps link.
    let centreLat: number | null = null;
    let centreLng: number | null = null;
    let centreLabel = "School";
    if (row.geofence_type === "pickup" && row.pickup_points) {
      centreLat = row.pickup_points.latitude != null ? Number(row.pickup_points.latitude) : null;
      centreLng = row.pickup_points.longitude != null ? Number(row.pickup_points.longitude) : null;
      centreLabel = row.pickup_points.name ?? "Pickup point";
    } else {
      const target = await this.geofenceTarget();
      centreLat = target?.latitude ?? null;
      centreLng = target?.longitude ?? null;
      centreLabel = target?.label ?? "School";
    }
    return toDto(row, { centreLat, centreLng, centreLabel });
  }

  /**
   * Save a punch event. Selfie is accepted as a base64 string and written to
   * uploads/punch_selfies/. Computes distance against the configured school
   * geofence so `distance_m` and `is_outside` are populated correctly.
   */
  async punch(input: PunchCreateInput, user: CurrentUser, ipAddress: string | null, userAgent: string | null): Promise<StaffPunch> {
    let selfiePath: string | null = null;
    if (input.selfieBase64) {
      const saved = await this.uploads.saveBase64("punch", `${Date.now()}.jpg`, input.selfieBase64);
      selfiePath = saved.filePath;
    }

    const target = await this.geofenceTarget();
    let distance: number | null = null;
    let isOutside = false;
    if (target && target.latitude != null && target.longitude != null) {
      distance = distanceMeters(input.latitude, input.longitude, target.latitude, target.longitude);
      isOutside = distance > target.radiusM;
    }

    const row = await this.prisma.db.staff_attendance.create({
      data: {
        user_id: user.id,
        punch_type: input.punchType,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_m: input.accuracyM ?? null,
        distance_m: distance,
        geofence_type: "school",
        is_outside: isOutside,
        notes: input.notes ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        selfie_path: selfiePath,
      },
      include: { users: { select: { id: true, name: true, designation: true, department: true } } },
    });
    return toDto(row);
  }

  /**
   * Self-service today snapshot. Mirrors the data block at the top of
   * `erp/punch/index.php` so the React page can render Status / First in /
   * Last out tiles + cooldown card + today's events without extra calls.
   */
  async today(user: CurrentUser): Promise<PunchTodayResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today.getTime() + 86400000 - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [punches, target, cooldownSecsSetting] = await Promise.all([
      this.prisma.db.staff_attendance.findMany({
        where: { user_id: user.id, punched_at: { gte: today, lte: todayEnd } },
        include: { users: { select: { id: true, name: true, designation: true, department: true } } },
        orderBy: { punched_at: "asc" },
      }),
      this.geofenceTarget(),
      // Key mirrors erp/settings/index.php — keep in sync via SCHOOL_INFO_KEYS.
      this.prisma.db.schoolInfo.findUnique({ where: { k: "Punch Out Cooldown Min" } }).catch(() => null),
    ]);

    const cooldownSecs = Math.max(0, Number(cooldownSecsSetting?.v ?? "")) * 60 || DEFAULT_COOLDOWN_SECS;

    // Determine current state.
    let isIn = false;
    let lastInTs: number | null = null;
    let firstIn: typeof punches[number] | null = null;
    let lastOut: typeof punches[number] | null = null;
    for (const p of punches) {
      if (p.punch_type === "in") {
        if (firstIn === null) firstIn = p;
        lastInTs = p.punched_at.getTime();
        isIn = true;
      } else {
        lastOut = p;
        isIn = false;
      }
    }

    const cooldownReadyAt = lastInTs ? lastInTs + cooldownSecs * 1000 : null;
    const cooldownRemaining = cooldownReadyAt ? Math.max(0, Math.floor((cooldownReadyAt - Date.now()) / 1000)) : 0;
    const doneForDay = !isIn && punches.some((p) => p.punch_type === "out");

    return {
      isIn,
      nextType: isIn ? "out" : "in",
      cooldownSeconds: cooldownRemaining,
      cooldownReadyAt: cooldownReadyAt ? new Date(cooldownReadyAt).toISOString() : null,
      doneForDay,
      tomorrowAt: tomorrow.toISOString(),
      target,
      punches: punches.map((p) => toDto(p)),
      firstIn: firstIn ? toDto(firstIn) : null,
      lastOut: lastOut ? toDto(lastOut) : null,
    };
  }

  /**
   * Resolve the geofence target — name + lat/lng + radius. School-info is the
   * canonical source. Returns null when nothing is configured.
   */
  private async geofenceTarget(): Promise<PunchTodayResponse["target"]> {
    const info = await this.prisma.db.schoolInfo.findMany().catch(() => []);
    const get = (k: string) => info.find((r) => r.k === k)?.v ?? null;
    // Key names mirror erp/settings/index.php verbatim. See SCHOOL_INFO_KEYS.
    const lat = parseFloat(get("Latitude") ?? "");
    const lng = parseFloat(get("Longitude") ?? "");
    const radius = parseInt(get("Geofence Radius School M") ?? "", 10);
    const label = get("School Name") ?? "school";
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      // No coords configured — return a stub so the UI can still render the
      // toolbar/lede sentence without blowing up.
      return {
        type: "school",
        label,
        radiusM: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_M,
        latitude: null,
        longitude: null,
      };
    }
    return {
      type: "school",
      label,
      radiusM: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_M,
      latitude: lat,
      longitude: lng,
    };
  }
}

/** Optional joined users.* shape that `findOne` requests. */
interface RichUser {
  id: number; name: string;
  designation: string | null; department: string | null;
  phone?: string | null;
  roles?: { name: string } | null;
  users?: { name: string } | null;   // self-relation: reports-to
}

function toDto(
  r: {
    id: number; user_id: number; punch_type: "in" | "out"; punched_at: Date;
    latitude: { toString: () => string }; longitude: { toString: () => string };
    accuracy_m: number | null; distance_m: number | null;
    geofence_type: "school" | "pickup"; geofence_pickup_id: number | null;
    is_outside: boolean; selfie_path: string | null; notes: string | null;
    users?: RichUser;
    pickup_points?: { name: string | null } | null;
  },
  centre?: { centreLat: number | null; centreLng: number | null; centreLabel: string },
): StaffPunch {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.users?.name ?? `User #${r.user_id}`,
    designation: r.users?.designation ?? null,
    department: r.users?.department ?? null,
    roleName: r.users?.roles?.name ?? null,
    phone: r.users?.phone ?? null,
    reportsToName: r.users?.users?.name ?? null,
    pickupName: r.pickup_points?.name ?? null,
    centreLatitude: centre?.centreLat ?? null,
    centreLongitude: centre?.centreLng ?? null,
    centreLabel: centre?.centreLabel ?? null,
    punchType: r.punch_type,
    punchedAt: r.punched_at.toISOString(),
    latitude: Number(r.latitude),
    longitude: Number(r.longitude),
    accuracyM: r.accuracy_m,
    distanceM: r.distance_m,
    geofenceType: r.geofence_type,
    geofencePickupId: r.geofence_pickup_id,
    isOutside: r.is_outside,
    selfiePath: r.selfie_path,
    notes: r.notes,
  };
}
