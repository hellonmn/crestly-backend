import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  AdmissionEnquiry, AdmissionFollowup, EnquiryListQuery, EnquiryListResponse,
  EnquiryUpsertInput, FollowupAddInput,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class AdmissionsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: EnquiryListQuery): Promise<EnquiryListResponse> {
    const today = new Date().toISOString().slice(0, 10);
    const where: Prisma.admission_enquiriesWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.source && { source: query.source }),
      ...(query.followupsDue && { follow_up_date: { lte: new Date(today) } }),
      ...(query.q && {
        OR: [
          { child_name: { contains: query.q } },
          { parent_name: { contains: query.q } },
          { phone: { contains: query.q } },
        ],
      }),
    };

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [total, rows, all, admitted, lost, followupsDue, thisMonth] = await Promise.all([
      this.prisma.db.admission_enquiries.count({ where }),
      this.prisma.db.admission_enquiries.findMany({
        where,
        include: {
          users_admission_enquiries_assigned_toTousers: { select: { id: true, name: true } },
          users_admission_enquiries_created_byTousers: { select: { id: true, name: true } },
        },
        orderBy: { id: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.db.admission_enquiries.count(),
      this.prisma.db.admission_enquiries.count({ where: { status: "admitted" } }),
      this.prisma.db.admission_enquiries.count({ where: { status: "lost" } }),
      this.prisma.db.admission_enquiries.count({ where: { follow_up_date: { lte: new Date(today) }, status: { notIn: ["admitted", "lost"] } } }),
      this.prisma.db.admission_enquiries.count({ where: { created_at: { gte: monthStart } } }),
    ]);

    const open = all - admitted - lost;
    const conversion = all > 0 ? Math.round((admitted / all) * 100) : 0;

    return {
      items: rows.map(toDto),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totals: { all, open, admitted, lost, followupsDue, thisMonth, conversion },
    };
  }

  async findOne(id: number): Promise<AdmissionEnquiry & { followups: AdmissionFollowup[] }> {
    const row = await this.prisma.db.admission_enquiries.findUnique({
      where: { id },
      include: {
        users_admission_enquiries_assigned_toTousers: { select: { id: true, name: true } },
        users_admission_enquiries_created_byTousers: { select: { id: true, name: true } },
        admission_followups: {
          include: { users: { select: { id: true, name: true } } },
          orderBy: { id: "desc" },
        },
      },
    });
    if (!row) throw new NotFoundException(`Enquiry #${id} not found`);
    return {
      ...toDto(row),
      followups: row.admission_followups.map(followupDto),
    };
  }

  async create(input: EnquiryUpsertInput, user: CurrentUser): Promise<AdmissionEnquiry> {
    const row = await this.prisma.db.admission_enquiries.create({
      data: {
        child_name: input.childName,
        parent_name: input.parentName ?? null,
        phone: input.phone,
        email: input.email ?? null,
        class_seeking: input.classSeeking ?? null,
        source: input.source,
        source_detail: input.sourceDetail ?? null,
        status: input.status,
        follow_up_date: input.followUpDate ? new Date(input.followUpDate) : null,
        assigned_to: input.assignedTo ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      },
      include: {
        users_admission_enquiries_assigned_toTousers: { select: { id: true, name: true } },
        users_admission_enquiries_created_byTousers: { select: { id: true, name: true } },
      },
    });
    return toDto(row);
  }

  async update(id: number, input: EnquiryUpsertInput): Promise<AdmissionEnquiry> {
    const row = await this.prisma.db.admission_enquiries.update({
      where: { id },
      data: {
        child_name: input.childName,
        parent_name: input.parentName ?? null,
        phone: input.phone,
        email: input.email ?? null,
        class_seeking: input.classSeeking ?? null,
        source: input.source,
        source_detail: input.sourceDetail ?? null,
        status: input.status,
        follow_up_date: input.followUpDate ? new Date(input.followUpDate) : null,
        assigned_to: input.assignedTo ?? null,
        city: input.city ?? null,
        notes: input.notes ?? null,
      },
      include: {
        users_admission_enquiries_assigned_toTousers: { select: { id: true, name: true } },
        users_admission_enquiries_created_byTousers: { select: { id: true, name: true } },
      },
    });
    return toDto(row);
  }

  async addFollowup(id: number, input: FollowupAddInput, user: CurrentUser) {
    const enquiry = await this.prisma.db.admission_enquiries.findUnique({ where: { id } });
    if (!enquiry) throw new NotFoundException();

    await this.prisma.db.$transaction([
      this.prisma.db.admission_followups.create({
        data: {
          enquiry_id: id,
          note: input.note ?? null,
          status_to: input.statusTo ?? null,
          next_follow_up: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
          created_by: user.id,
        },
      }),
      ...(input.statusTo
        ? [this.prisma.db.admission_enquiries.update({
            where: { id },
            data: {
              status: input.statusTo,
              ...(input.nextFollowUp && { follow_up_date: new Date(input.nextFollowUp) }),
              ...(input.lostReason && input.statusTo === "lost" && { lost_reason: input.lostReason }),
            },
          })]
        : []),
    ]);

    return this.findOne(id);
  }
}

function toDto(r: {
  id: number; child_name: string; parent_name: string | null; phone: string;
  email: string | null; class_seeking: string | null;
  source: string; source_detail: string | null;
  status: string; follow_up_date: Date | null;
  assigned_to: number | null; city: string | null;
  notes: string | null; lost_reason: string | null;
  converted_sr_number: number | null;
  created_by: number | null;
  created_at: Date | null; updated_at: Date | null;
  users_admission_enquiries_assigned_toTousers?: { id: number; name: string } | null;
  users_admission_enquiries_created_byTousers?: { id: number; name: string } | null;
}): AdmissionEnquiry {
  return {
    id: r.id,
    childName: r.child_name,
    parentName: r.parent_name,
    phone: r.phone,
    email: r.email,
    classSeeking: r.class_seeking,
    source: r.source as AdmissionEnquiry["source"],
    sourceDetail: r.source_detail,
    status: r.status as AdmissionEnquiry["status"],
    followUpDate: r.follow_up_date ? r.follow_up_date.toISOString().slice(0, 10) : null,
    assignedTo: r.assigned_to,
    assignedToName: r.users_admission_enquiries_assigned_toTousers?.name ?? null,
    city: r.city,
    notes: r.notes,
    lostReason: r.lost_reason,
    convertedSrNumber: r.converted_sr_number,
    createdBy: r.created_by,
    createdByName: r.users_admission_enquiries_created_byTousers?.name ?? null,
    createdAt: r.created_at ? r.created_at.toISOString() : new Date(0).toISOString(),
    updatedAt: r.updated_at ? r.updated_at.toISOString() : new Date(0).toISOString(),
  };
}

function followupDto(r: {
  id: number; enquiry_id: number; note: string | null; status_to: string | null;
  next_follow_up: Date | null; created_by: number | null; created_at: Date | null;
  users?: { id: number; name: string } | null;
}): AdmissionFollowup {
  return {
    id: r.id,
    enquiryId: r.enquiry_id,
    note: r.note,
    statusTo: r.status_to,
    nextFollowUp: r.next_follow_up ? r.next_follow_up.toISOString().slice(0, 10) : null,
    createdBy: r.created_by,
    createdByName: r.users?.name ?? null,
    createdAt: r.created_at ? r.created_at.toISOString() : new Date(0).toISOString(),
  };
}
