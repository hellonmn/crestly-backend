import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  Student, StudentListQuery, StudentListResponse, StudentUpsert,
  StudentPaymentStatus, StudentDetail, StudentFeeBreakdown,
} from "@crestly/shared";
import { SessionsService } from "../sessions/sessions.service";

/**
 * Students list. Mirrors filters from erp/students/index.php:
 *   q (name/father/contact/SR), class, section, gender, status (active|inactive|all),
 *   accom (day|hostel). Page returns the distinct classes/sections so the UI
 *   can populate filter selects without a second roundtrip.
 *
 * Hydration: when listing, we attach the most recent StudentFee row's
 * paymentStatus + dueAmount and the pickup point name so each row matches
 * the PHP table columns 1:1.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async list(query: StudentListQuery): Promise<StudentListResponse> {
    const where: Prisma.StudentWhereInput = {
      ...(query.class && { class: query.class }),
      ...(query.section && { section: query.section }),
      ...(query.gender && { gender: query.gender }),
      // "all" => no status filter at all; default in PHP is "active"
      ...(query.status && query.status !== "all" && { status: query.status }),
      ...(query.accom === "hostel" && { is_hostel: true }),
      ...(query.accom === "day" && { is_hostel: false }),
      ...(query.q && {
        OR: [
          { studentName: { contains: query.q } },
          { fatherName: { contains: query.q } },
          { motherName: { contains: query.q } },
          { fatherContact: { contains: query.q } },
          { motherContact: { contains: query.q } },
          ...(/^\d+$/.test(query.q.trim())
            ? [{ srNumber: { equals: Number(query.q) } } as Prisma.StudentWhereInput]
            : []),
        ],
      }),
    };

    const [total, rows, classes, sections] = await Promise.all([
      this.prisma.db.student.count({ where }),
      this.prisma.db.student.findMany({
        where,
        orderBy: [{ class: "asc" }, { section: "asc" }, { studentName: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { pickupPoint: { select: { name: true } } },
      }),
      // Distinct classes/sections for filter selects, sorted naturally.
      this.prisma.db.student.findMany({
        distinct: ["class"], select: { class: true }, orderBy: { class: "asc" },
      }),
      this.prisma.db.student.findMany({
        distinct: ["section"], select: { section: true }, orderBy: { section: "asc" },
      }),
    ]);

    // Fetch the most-recent fee row per student in the page so the STATUS
    // column matches PHP (which uses the row's payment_status + due_amount).
    const srs = rows.map((r) => r.srNumber);
    const feeRows = srs.length === 0 ? [] : await this.prisma.db.studentFee.findMany({
      where: { srNumber: { in: srs } },
      select: { srNumber: true, paymentStatus: true, dueAmount: true, sessionCode: true },
      orderBy: { sessionCode: "desc" },
    });
    const feeBySr = new Map<number, { paymentStatus: StudentPaymentStatus; dueAmount: number }>();
    for (const f of feeRows) {
      if (feeBySr.has(f.srNumber)) continue; // first occurrence = most recent session
      feeBySr.set(f.srNumber, {
        paymentStatus: f.paymentStatus as StudentPaymentStatus,
        dueAmount: f.dueAmount,
      });
    }

    return {
      items: rows.map((r) => toDto(r, feeBySr.get(r.srNumber))),
      total,
      page: query.page,
      pageSize: query.pageSize,
      classes: classes.map((c) => c.class),
      sections: sections.map((s) => s.section),
    };
  }

  async findOne(srNumber: number): Promise<Student> {
    const row = await this.prisma.db.student.findUnique({
      where: { srNumber },
      include: { pickupPoint: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException(`Student #${srNumber} not found`);
    return toDto(row);
  }

  /**
   * Full StudentDetail payload powering the View page. Mirrors what
   * erp/students/view.php joins together (student + pickup + fees +
   * family + siblings + hostel) so the React page can render in a
   * single roundtrip.
   */
  async detail(srNumber: number): Promise<StudentDetail> {
    const session = await this.sessions.current();

    const stu = await this.prisma.db.student.findUnique({
      where: { srNumber },
      include: {
        pickupPoint: {
          select: { name: true, distanceKm: true, latitude: true, longitude: true, googleMapsLink: true },
        },
      },
    });
    if (!stu) throw new NotFoundException(`Student #${srNumber} not found`);

    // Fees for the current session
    const feeRow = await this.prisma.db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber, sessionCode: session.code } },
    }).catch(() => null);

    // Family + siblings
    let family: StudentDetail["family"] = null;
    let siblings: StudentDetail["siblings"] = [];
    if (stu.familyId) {
      const fam = await this.prisma.db.siblingFamily.findUnique({ where: { familyId: stu.familyId } });
      if (fam) {
        family = {
          familyId: fam.familyId,
          fatherName: fam.fatherName,
          siblingCount: fam.siblingCount ?? 0,
        };
        const sibRows = await this.prisma.db.student.findMany({
          where: { familyId: stu.familyId, srNumber: { not: srNumber } },
          orderBy: [{ class: "asc" }, { section: "asc" }, { srNumber: "asc" }],
          select: { srNumber: true, studentName: true, class: true, section: true, status: true },
        });
        siblings = sibRows.map((s) => ({
          srNumber: s.srNumber,
          studentName: s.studentName,
          class: s.class,
          section: s.section,
          status: s.status,
        }));
      }
    }

    // Hostel info (boarders only)
    let hostel: StudentDetail["hostel"] = null;
    if (stu.is_hostel) {
      const alloc = await this.prisma.db.hostel_allocations.findFirst({
        where: { sr_number: srNumber, is_current: true },
        include: { hostel_rooms: true },
      });
      if (alloc) {
        // Roommates list
        const others = await this.prisma.db.hostel_allocations.findMany({
          where: { room_no: alloc.room_no, is_current: true, sr_number: { not: srNumber } },
          include: { students: { select: { studentName: true } } },
        });
        hostel = {
          block: alloc.hostel_rooms.block ?? null,
          roomNo: alloc.room_no,
          roomType: alloc.hostel_rooms.room_type ?? null,
          floor: alloc.hostel_rooms.floor ?? null,
          roommates: others.length > 0 ? others.map((o) => o.students.studentName).join(", ") : null,
          bloodGroup: stu.blood_group ?? null,
          homeCity: stu.home_city ?? null,
          homeState: stu.home_state ?? null,
          homeAddress: stu.home_address ?? null,
        };
      } else {
        // Fall back to bare hostel block from per-student fields
        hostel = {
          block: null, roomNo: null, roomType: null, floor: null, roommates: null,
          bloodGroup: stu.blood_group ?? null,
          homeCity: stu.home_city ?? null,
          homeState: stu.home_state ?? null,
          homeAddress: stu.home_address ?? null,
        };
      }
    }

    const fees: StudentFeeBreakdown | null = feeRow
      ? {
          sessionCode: feeRow.sessionCode,
          admissionStatus: feeRow.admissionStatus,
          siblingDiscountPct: Number(feeRow.siblingDiscountPct),
          siblingPosition: feeRow.siblingPosition,
          tuitionOriginal: feeRow.tuitionOriginal,
          tuitionDiscount: feeRow.tuitionDiscount,
          tuitionPayable: feeRow.tuitionPayable,
          annualCharges: feeRow.annualCharges,
          activityFee: feeRow.activityFee,
          examFee: feeRow.examFee,
          transportSlab: feeRow.transportSlab,
          transportFee: feeRow.transportFee,
          isHostel: feeRow.is_hostel,
          roomType: feeRow.room_type ?? null,
          lodgingDiscountPct: Number(feeRow.lodging_discount_pct),
          hostelLodging: feeRow.hostel_lodging,
          hostelMess: feeRow.hostel_mess,
          hostelCommon: feeRow.hostel_common,
          hostelOneTime: feeRow.hostel_one_time,
          yearlyRecurringTotal: feeRow.yearlyRecurringTotal,
          registrationFee: feeRow.registrationFee,
          admissionFee: feeRow.admissionFee,
          cautionMoney: feeRow.cautionMoney,
          firstYearExtras: feeRow.firstYearExtras,
          totalThisYear: feeRow.totalThisYear,
          quarterlyInstallment: feeRow.quarterlyInstallment,
          monthlyEmi: feeRow.monthlyEmi,
          paidAmount: feeRow.paidAmount,
          dueAmount: feeRow.dueAmount,
          paymentStatus: feeRow.paymentStatus as StudentPaymentStatus,
        }
      : null;

    return {
      srNumber: stu.srNumber,
      studentName: stu.studentName,
      fatherName: stu.fatherName,
      motherName: stu.motherName,
      dob: stu.dob ? stu.dob.toISOString().slice(0, 10) : null,
      age: stu.age,
      gender: stu.gender,
      bloodGroup: stu.blood_group ?? null,
      address: stu.address,
      class: stu.class,
      section: stu.section,
      stream: stu.stream ?? null,
      subStream: stu.sub_stream ?? null,
      schoolName: stu.schoolName,
      board: stu.board,
      status: stu.status,
      isHostel: stu.is_hostel,
      familyId: stu.familyId,

      fatherContact: stu.fatherContact,
      fatherWhatsapp: stu.father_whatsapp ?? null,
      motherContact: stu.motherContact,
      motherWhatsapp: stu.mother_whatsapp ?? null,
      callingNumber: stu.callingNumber,
      whatsappNumber: stu.whatsappNumber,

      localGuardianName: stu.local_guardian_name ?? null,
      guardianRelation: stu.guardian_relation ?? null,
      localGuardianContact: stu.local_guardian_contact ?? null,
      localGuardianWhatsapp: stu.local_guardian_whatsapp ?? null,
      localGuardianAddress: stu.local_guardian_address ?? null,

      academicContactPerson: stu.academic_contact_person ?? null,
      academicCallingNumber: stu.academic_calling_number ?? null,
      academicWhatsappNumber: stu.academic_whatsapp_number ?? null,
      feeContactPerson: stu.fee_contact_person ?? null,
      feeCallingNumber: stu.fee_calling_number ?? null,
      feeWhatsappNumber: stu.fee_whatsapp_number ?? null,

      pickupPointId: stu.pickupPointId,
      pickupName: stu.pickupPoint?.name ?? stu.pickup_point_name ?? null,
      pickupDistanceKm: stu.pickupPoint?.distanceKm
        ? Number(stu.pickupPoint.distanceKm)
        : (stu.pickup_distance_km ? Number(stu.pickup_distance_km) : null),
      pickupLatitude: stu.pickupPoint?.latitude
        ? Number(stu.pickupPoint.latitude)
        : (stu.pickup_latitude ? Number(stu.pickup_latitude) : null),
      pickupLongitude: stu.pickupPoint?.longitude
        ? Number(stu.pickupPoint.longitude)
        : (stu.pickup_longitude ? Number(stu.pickup_longitude) : null),
      pickupMapsLink: stu.pickupPoint?.googleMapsLink ?? stu.pickup_maps_link ?? null,

      hostel,
      family,
      siblings,
      fees,

      createdAt: (stu.createdAt ?? new Date()).toISOString(),
      updatedAt: (stu.updatedAt ?? new Date()).toISOString(),
    };
  }

  async create(input: StudentUpsert): Promise<Student> {
    // Auto-assign SR number when not supplied (PHP students/edit.php behaviour).
    let srNumber = input.srNumber;
    if (!srNumber) {
      const max = await this.prisma.db.student.aggregate({
        _max: { srNumber: true },
      });
      srNumber = (max._max.srNumber ?? 0) + 1;
    } else {
      const exists = await this.prisma.db.student.findUnique({
        where: { srNumber },
        select: { srNumber: true },
      });
      if (exists) throw new ConflictException(`Student #${srNumber} already exists`);
    }

    const row = await this.prisma.db.student.create({
      data: fromDto({ ...input, srNumber }),
    });
    return toDto(row);
  }

  async update(srNumber: number, input: StudentUpsert): Promise<Student> {
    await this.findOne(srNumber); // 404 if missing
    const row = await this.prisma.db.student.update({
      where: { srNumber },
      data: fromDto(input),
    });
    return toDto(row);
  }

  /** Soft-deactivate. The PHP app never hard-deletes student rows. */
  async deactivate(srNumber: number): Promise<Student> {
    const row = await this.prisma.db.student.update({
      where: { srNumber },
      data: { status: "inactive" },
    });
    return toDto(row);
  }

  /**
   * Bulk action used by the sticky bar in the PHP students/index.php page.
   *   activate / deactivate — flip `status`
   *   delete                — hard delete + cascade across child tables
   * Returns the number of affected students.
   */
  async bulk(op: "activate" | "deactivate" | "delete", srs: number[]): Promise<{ affected: number }> {
    const ids = Array.from(new Set(srs.filter((n) => Number.isInteger(n) && n > 0)));
    if (ids.length === 0) return { affected: 0 };

    if (op === "activate" || op === "deactivate") {
      const result = await this.prisma.db.student.updateMany({
        where: { srNumber: { in: ids } },
        data: { status: op === "activate" ? "active" : "inactive" },
      });
      return { affected: result.count };
    }

    // Hard delete + child cascade. Mirrors the PHP transaction.
    const db = this.prisma.db;
    await db.$transaction(async (tx) => {
      const tables: Array<() => Promise<unknown>> = [
        () => tx.attendance.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.exam_co_grades.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.exam_marks.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.fee_payments.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.hostel_allocations.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.student_edit_requests.deleteMany({ where: { sr_number: { in: ids } } }).catch(() => null),
        () => tx.studentFee.deleteMany({ where: { srNumber: { in: ids } } }).catch(() => null),
      ];
      for (const t of tables) await t();
      await tx.student.deleteMany({ where: { srNumber: { in: ids } } });
    });
    return { affected: ids.length };
  }
}

/** Loosened row type so toDto accepts rows that didn't request the include. */
type StudentRow = Prisma.StudentGetPayload<Record<string, never>> & {
  pickupPoint?: { name: string } | null;
};

function toDto(
  r: StudentRow,
  fee?: { paymentStatus: StudentPaymentStatus; dueAmount: number },
): Student {
  return {
    srNumber: r.srNumber,
    studentName: r.studentName,
    fatherName: r.fatherName,
    motherName: r.motherName,
    dob: r.dob ? r.dob.toISOString().slice(0, 10) : null,
    age: r.age,
    gender: r.gender,
    address: r.address,
    class: r.class,
    section: r.section,
    schoolName: r.schoolName,
    board: r.board,
    fatherContact: r.fatherContact,
    motherContact: r.motherContact,
    callingNumber: r.callingNumber,
    whatsappNumber: r.whatsappNumber,
    pickupPointId: r.pickupPointId,
    familyId: r.familyId,
    status: r.status,
    createdAt: (r.createdAt ?? new Date()).toISOString(),
    updatedAt: (r.updatedAt ?? new Date()).toISOString(),
    pickupName: r.pickupPoint?.name ?? r.pickup_point_name ?? null,
    isHostel: r.is_hostel,
    paymentStatus: fee?.paymentStatus ?? null,
    dueAmount: fee?.dueAmount ?? 0,
  };
}

function fromDto(input: StudentUpsert): Prisma.StudentUncheckedCreateInput {
  return {
    srNumber: input.srNumber!,
    studentName: input.studentName,
    fatherName: input.fatherName ?? null,
    motherName: input.motherName ?? null,
    dob: input.dob ? new Date(input.dob) : null,
    age: input.age ?? null,
    gender: input.gender ?? null,
    blood_group: input.bloodGroup ?? null,
    address: input.address ?? null,
    class: input.class,
    section: input.section,
    schoolName: input.schoolName ?? null,
    board: input.board ?? null,
    fatherContact: input.fatherContact ?? null,
    father_whatsapp: input.fatherWhatsapp ?? null,
    motherContact: input.motherContact ?? null,
    mother_whatsapp: input.motherWhatsapp ?? null,
    callingNumber: input.callingNumber ?? null,
    whatsappNumber: input.whatsappNumber ?? null,
    pickupPointId: input.pickupPointId ?? null,
    pickup_point_name: input.pickupPointName ?? null,
    familyId: input.familyId ?? null,
    status: input.status,
    stream: input.stream ?? null,
    sub_stream: input.subStream ?? null,
    is_hostel: input.isHostel,
    local_guardian_name: input.localGuardianName ?? null,
    guardian_relation: input.guardianRelation ?? null,
    local_guardian_contact: input.localGuardianContact ?? null,
    local_guardian_whatsapp: input.localGuardianWhatsapp ?? null,
    local_guardian_address: input.localGuardianAddress ?? null,
    academic_contact_person: input.academicContactPerson ?? null,
    academic_calling_number: input.academicCallingNumber ?? null,
    academic_whatsapp_number: input.academicWhatsappNumber ?? null,
    fee_contact_person: input.feeContactPerson ?? null,
    fee_calling_number: input.feeCallingNumber ?? null,
    fee_whatsapp_number: input.feeWhatsappNumber ?? null,
    home_city: input.homeCity ?? null,
    home_state: input.homeState ?? null,
    home_address: input.homeAddress ?? null,
  };
}
