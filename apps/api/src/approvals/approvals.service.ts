import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  EditRequest, EditRequestListQuery, EditRequestStatus, ReviewDecisionInput,
} from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: EditRequestListQuery, user: CurrentUser): Promise<EditRequest[]> {
    const where: Prisma.student_edit_requestsWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.mine && { requested_by: user.id }),
    };

    const rows = await this.prisma.db.student_edit_requests.findMany({
      where,
      include: {
        students: { select: { studentName: true, class: true, section: true } },
        student_edit_request_fields: true,
        users_student_edit_requests_reviewed_byTousers: { select: { id: true, name: true } },
      },
      orderBy: { id: "desc" },
      take: 200,
    });

    // Also need requested-by user names.
    const requesterIds = Array.from(new Set(rows.map((r) => r.requested_by)));
    const requesters = await this.prisma.db.user.findMany({
      where: { id: { in: requesterIds } },
      select: { id: true, name: true },
    });
    const requesterMap = new Map(requesters.map((u) => [u.id, u.name]));

    return rows.map((r) => ({
      id: r.id,
      srNumber: r.sr_number,
      studentName: r.students.studentName,
      studentClass: r.students.class,
      studentSection: r.students.section,
      requestedBy: r.requested_by,
      requestedByName: requesterMap.get(r.requested_by) ?? null,
      requestedAt: r.requested_at.toISOString(),
      status: r.status,
      reviewedBy: r.reviewed_by,
      reviewedByName: r.users_student_edit_requests_reviewed_byTousers?.name ?? null,
      reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null,
      note: r.note,
      reviewNote: r.review_note,
      fields: r.student_edit_request_fields.map((f) => ({
        id: f.id,
        fieldName: f.field_name,
        oldValue: f.old_value,
        newValue: f.new_value,
        fieldStatus: f.field_status,
        rejectionReason: f.rejection_reason,
        reviewedAt: f.reviewed_at ? f.reviewed_at.toISOString() : null,
      })),
    }));
  }

  async findOne(id: number, user: CurrentUser): Promise<EditRequest> {
    const all = await this.list({}, user);
    const one = all.find((r) => r.id === id);
    if (!one) throw new NotFoundException();
    if (user.roleSlug !== "admin" && one.requestedBy !== user.id) {
      throw new ForbiddenException("You can only view your own requests.");
    }
    return one;
  }

  /**
   * Apply per-field approve/reject decisions. Admin-only. Approved values get
   * written to the student row immediately.
   */
  async review(id: number, input: ReviewDecisionInput, user: CurrentUser): Promise<EditRequest> {
    if (user.roleSlug !== "admin") {
      throw new ForbiddenException("Only admins can review edit requests.");
    }
    const req = await this.prisma.db.student_edit_requests.findUnique({
      where: { id },
      include: { student_edit_request_fields: true },
    });
    if (!req) throw new NotFoundException();
    if (req.status !== "pending" && req.status !== "partial") {
      throw new BadRequestException("Request is already fully resolved.");
    }

    const studentUpdates: Record<string, string | null> = {};
    let anyApproved = false;
    let anyRejected = false;

    for (const decision of input.decisions) {
      const field = req.student_edit_request_fields.find((f) => f.id === decision.fieldId);
      if (!field) continue;
      const status = decision.decision === "approve" ? "approved" : "rejected";
      await this.prisma.db.student_edit_request_fields.update({
        where: { id: field.id },
        data: {
          field_status: status,
          rejection_reason: decision.decision === "reject" ? (decision.rejectionReason ?? null) : null,
          reviewed_at: new Date(),
        },
      });
      if (status === "approved") {
        anyApproved = true;
        studentUpdates[field.field_name] = field.new_value;
      } else {
        anyRejected = true;
      }
    }

    // Apply approved field values to the student row. Note: not all fields here
    // are safe to write blindly — limit to the allow-list the teacher form exposes.
    const ALLOWED_FIELDS = new Set([
      "studentName", "fatherName", "motherName", "dob", "age", "gender", "address",
      "board", "schoolName", "fatherContact", "motherContact",
      "callingNumber", "whatsappNumber",
    ]);
    const safeUpdate = Object.fromEntries(
      Object.entries(studentUpdates).filter(([k]) => ALLOWED_FIELDS.has(k)),
    );
    if (Object.keys(safeUpdate).length > 0) {
      await this.prisma.db.student.update({
        where: { srNumber: req.sr_number },
        data: safeUpdate,
      });
    }

    const overall: EditRequestStatus = anyApproved && anyRejected
      ? "partial"
      : anyApproved ? "approved" : "rejected";

    await this.prisma.db.student_edit_requests.update({
      where: { id },
      data: {
        status: overall,
        reviewed_by: user.id,
        reviewed_at: new Date(),
        review_note: input.reviewNote ?? null,
      },
    });

    return this.findOne(id, user);
  }
}
