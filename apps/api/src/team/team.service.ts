import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { TeamMember, TeamListQuery, TeamListResponse, TeamUpsert } from "@crestly/shared";

@Injectable()
export class TeamService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: TeamListQuery): Promise<TeamListResponse> {
    const where: Prisma.UserWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.department && { department: query.department }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q } },
          { phone: { contains: query.q } },
          { email: { contains: query.q } },
          { designation: { contains: query.q } },
          { employee_id: { contains: query.q } },
        ],
      }),
      ...(query.roleSlug && { role: { slug: query.roleSlug } }),
    };

    const [total, rows, totalActive, totalInactive, deptCounts, rolesCount] = await Promise.all([
      this.prisma.db.user.count({ where }),
      this.prisma.db.user.findMany({
        where,
        include: { role: true },
        orderBy: [{ status: "asc" }, { name: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.user.count({ where: { status: "active" } }),
      this.prisma.db.user.count({ where: { status: "inactive" } }),
      this.prisma.db.user.groupBy({
        by: ["department"],
        where: { status: "active", department: { not: null } },
        _count: { _all: true },
        orderBy: { department: "asc" },
      }),
      this.prisma.db.role.count(),
    ]);

    const departments = deptCounts
      .filter((d): d is { department: string; _count: { _all: number } } => d.department !== null)
      .map((d) => ({ department: d.department, count: d._count._all }));

    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalActive,
      totalInactive,
      departments,
      rolesCount,
    };
  }

  async findOne(id: number): Promise<TeamMember> {
    const row = await this.prisma.db.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!row) throw new NotFoundException(`Team member #${id} not found`);
    return toDto(row);
  }

  /**
   * Lightweight team list — only the fields a picker needs.
   * Returns ALL active users; the caller filters / ranks.
   * Open to any logged-in user (see controller).
   */
  async pickable(): Promise<TeamListResponse> {
    const rows = await this.prisma.db.user.findMany({
      where: { status: "active" },
      include: { role: true },
      orderBy: [{ name: "asc" }],
    });
    return {
      items: rows.map(toDto),
      total: rows.length,
      page: 1,
      pageSize: rows.length,
      totalActive: rows.length,
      totalInactive: 0,
      departments: [],
      rolesCount: 0,
    };
  }

  async create(input: TeamUpsert): Promise<TeamMember> {
    if (input.phone) {
      const existing = await this.prisma.db.user.findFirst({
        where: { phone: input.phone },
        select: { id: true },
      });
      if (existing) throw new ConflictException(`A user with phone ${input.phone} already exists`);
    }
    const created = await this.prisma.db.user.create({
      data: fromDto(input),
      include: { role: true },
    });
    return toDto(created);
  }

  async update(id: number, input: TeamUpsert): Promise<TeamMember> {
    await this.findOne(id);
    if (input.phone) {
      const clash = await this.prisma.db.user.findFirst({
        where: { phone: input.phone, NOT: { id } },
        select: { id: true },
      });
      if (clash) throw new ConflictException(`Phone ${input.phone} is already in use`);
    }
    const updated = await this.prisma.db.user.update({
      where: { id },
      data: fromDto(input),
      include: { role: true },
    });
    return toDto(updated);
  }

  /** Soft-deactivate. PHP equivalent: status = 'inactive'. Login is blocked. */
  async deactivate(id: number): Promise<TeamMember> {
    const updated = await this.prisma.db.user.update({
      where: { id },
      data: { status: "inactive" },
      include: { role: true },
    });
    return toDto(updated);
  }

  async setPassword(id: number, password: string): Promise<{ ok: true }> {
    if (!password || password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }
    const hash = await bcrypt.hash(password, 10);
    await this.prisma.db.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
    return { ok: true };
  }
}

type UserRow = Prisma.UserGetPayload<{ include: { role: true } }>;

function toDto(r: UserRow): TeamMember {
  return {
    id: r.id,
    employeeId: r.employee_id,
    name: r.name,
    designation: r.designation,
    department: r.department,
    gender: r.gender,
    dob: r.dob ? r.dob.toISOString().slice(0, 10) : null,
    dateOfJoining: r.date_of_joining ? r.date_of_joining.toISOString().slice(0, 10) : null,
    experienceYears: r.experience_years,
    qualification: r.qualification,
    employmentType: r.employment_type,
    classTeacherOf: r.class_teacher_of,
    reportsTo: r.reports_to,
    reportingUserId: r.reporting_user_id,
    geofencePickupId: r.geofence_pickup_id,
    whatsapp: r.whatsapp,
    emergencyContact: r.emergency_contact,
    address: r.address,
    bloodGroup: r.blood_group,
    monthlySalary: r.monthly_salary,
    email: r.email,
    phone: r.phone,
    roleId: r.roleId,
    roleSlug: r.role?.slug ?? null,
    roleName: r.role?.name ?? null,
    status: r.status,
    lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
    createdAt: r.createdAt ? r.createdAt.toISOString() : new Date(0).toISOString(),
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date(0).toISOString(),
  };
}

function fromDto(input: TeamUpsert): Prisma.UserUncheckedCreateInput {
  return {
    employee_id: input.employeeId,
    name: input.name,
    designation: input.designation,
    department: input.department,
    gender: input.gender,
    dob: input.dob ? new Date(input.dob) : null,
    date_of_joining: input.dateOfJoining ? new Date(input.dateOfJoining) : null,
    experience_years: input.experienceYears,
    qualification: input.qualification,
    employment_type: input.employmentType,
    class_teacher_of: input.classTeacherOf,
    reports_to: input.reportsTo,
    reporting_user_id: input.reportingUserId,
    geofence_pickup_id: input.geofencePickupId,
    whatsapp: input.whatsapp,
    emergency_contact: input.emergencyContact,
    address: input.address,
    blood_group: input.bloodGroup,
    monthly_salary: input.monthlySalary,
    email: input.email,
    phone: input.phone,
    roleId: input.roleId,
    status: input.status,
  };
}
