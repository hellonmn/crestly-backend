import { ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { TenantService } from "../tenant/tenant.service";
import { PaymentsService } from "../payments/payments.service";
import { buildCalendarFeed, resolveRange } from "../calendar/calendar.feed";
import {
  readCallingConfig, isCallingUsable, placeMaskedCall,
} from "../calling/calling.exotel";
import { parseQuestion, gradeAnswer } from "../tests/tests.grading";
import type {
  CalendarFeedResponse,
  MaskedCallResult,
  ParentTestListResponse, ParentTestDetail, TestSubmitInput, TestSubmitResult,
  CheckoutCreateInput, CheckoutSession,
  ParentAttendanceMonth,
  ParentContactResponse, ParentContactStaff, ParentOfficeStatus,
  ParentDiaryResponse,
  ParentExamsResponse,
  ParentFeesResponse,
  ParentKid,
  ParentLoginInput, ParentLoginResponse,
  ParentMoreInfo,
  ParentReceiptResponse,
  ParentTimetableResponse,
  ParentTransportResponse,
} from "@crestly/shared";

/**
 * Parent portal queries run against the platform DB (which, in single-
 * tenant deployments, IS the school's DB). We deliberately don't use
 * RequestPrismaService — parents have no JWT at the login endpoint, so
 * the request has no tenant context.
 *
 * In a future multi-tenant world the parent login flow will need a
 * subdomain or query param to pick the right tenant DB; for now every
 * parent in this deployment maps to the platform DB.
 */
@Injectable()
export class ParentService {
  private readonly log = new Logger(ParentService.name);

  constructor(
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
    private readonly payments: PaymentsService,
  ) {}

  private get db() { return this.tenants.platform; }

  /** Public — returns just the school name for the login page header. */
  async schoolInfo(): Promise<{ name: string }> {
    try {
      const row = await this.db.$queryRawUnsafe<{ v: string }[]>(
        "SELECT v FROM school_info WHERE k = 'School Name' LIMIT 1",
      );
      const name = row[0]?.v?.trim();
      return { name: name || "School" };
    } catch (e) {
      this.log.warn(`schoolInfo failed: ${(e as Error).message}`);
      return { name: "School" };
    }
  }

  /**
   * Two-step parent login (single-tenant for now):
   *   1. Find students whose DOB matches. Usually 1-3 rows in a school.
   *   2. In JS, strip non-digits from EVERY contact field of every
   *      candidate and match the last 10 digits against the input.
   *
   * We deliberately skip MySQL's REGEXP_REPLACE — older shared hosts
   * have spotty regex support, and the DOB-narrowed candidate list is
   * tiny so the per-row compare is fine.
   */
  async login(input: ParentLoginInput): Promise<ParentLoginResponse> {
    const phone10 = lastTenDigits(input.phone);
    if (phone10.length !== 10) {
      throw new UnauthorizedException("Enter a 10-digit Indian mobile number.");
    }
    const dobIso = ddmmyyyyToIso(input.dob);
    if (!dobIso) {
      throw new UnauthorizedException("Enter the date of birth as DDMMYYYY.");
    }

    // Step 1: candidates by DOB. Cast to plain strings/numbers right away
    // so BigInt doesn't leak into anything downstream.
    const candidates = await this.db.student.findMany({
      where: {
        dob: new Date(`${dobIso}T00:00:00Z`),
        status: "active",
      },
      select: { ...KID_SELECT, familyId: true },
    });

    if (candidates.length === 0) {
      this.log.log(`parent login miss — no students with dob=${dobIso}`);
      throw new UnauthorizedException(
        "We couldn't find a child with that mobile + date of birth. Check the values, or contact the school office.",
      );
    }

    // Step 2: match the phone (last 10 digits) against ANY contact field.
    const matched = candidates.find((s) => {
      const phones = [
        s.fatherContact, s.motherContact,
        s.father_whatsapp, s.mother_whatsapp,
        s.callingNumber, s.whatsappNumber,
        s.local_guardian_contact,
      ];
      return phones.some((p) => lastTenDigits(p ?? "") === phone10);
    });

    if (!matched) {
      this.log.log(
        `parent login miss — phone ${phone10} not in any contact field of ${candidates.length} dob match(es)`,
      );
      throw new UnauthorizedException(
        "We couldn't find a child with that mobile + date of birth. Check the values, or contact the school office.",
      );
    }

    const familyId = matched.familyId != null ? Number(matched.familyId) : null;

    // Step 3: expand to siblings via family_id if present. Keep the raw
    // rows around — resolveParent() needs the contact fields to work out
    // which parent (and their name) the login phone belongs to.
    const sourceRows = familyId !== null
      ? await this.db.student.findMany({
          where: { familyId, status: "active" },
          select: KID_SELECT,
          orderBy: { srNumber: "asc" },
        })
      : [matched];
    const kids: ParentKid[] = sourceRows.map(mapKid);

    const { parentName, relationship } = resolveParent(phone10, sourceRows);

    const srNumbers = kids.map((k) => k.srNumber);
    const accessToken = await this.jwt.signAsync({
      kind: "parent",
      phone: phone10,
      familyId,
      srs: srNumbers,
    });

    const label = kids.length === 1
      ? `+91 ${phone10} · ${kids[0]!.studentName}`
      : `+91 ${phone10} · ${kids.length} children`;

    this.log.log(`parent login ok — phone=${phone10} family=${familyId} kids=${kids.length}`);
    return { accessToken, parentLabel: label, parentName, relationship, familyId, kids };
  }

  /* ============================================================
     Data endpoints — each requires the kid SR to be in the
     parent's JWT scope. The controller passes `allowedSrs` from
     the verified token.
     ============================================================ */

  private ensureScope(sr: number, allowedSrs: number[]) {
    if (!allowedSrs.includes(sr)) {
      throw new ForbiddenException("That child is not in your account.");
    }
  }

  private async currentSessionCode(): Promise<string> {
    const row = await this.db.session.findFirst({
      where: { isCurrent: true },
      select: { code: true },
    });
    return row?.code ?? "";
  }

  /** Re-fetch the kid list for an authenticated parent (used by /parent/me). */
  async kidsForSession(allowedSrs: number[], phone10: string, familyId: number | null): Promise<ParentLoginResponse> {
    const rows = await this.db.student.findMany({
      where: { srNumber: { in: allowedSrs }, status: "active" },
      select: KID_SELECT,
      orderBy: { srNumber: "asc" },
    });
    const kids: ParentKid[] = rows.map(mapKid);
    const { parentName, relationship } = resolveParent(phone10, rows);
    const label = kids.length === 1
      ? `+91 ${phone10} · ${kids[0]!.studentName}`
      : `+91 ${phone10} · ${kids.length} children`;
    // No fresh token issued here — the existing one is still valid.
    return { accessToken: "", parentLabel: label, parentName, relationship, familyId, kids };
  }

  /* ─── ATTENDANCE ─── */

  async attendance(sr: number, month: string, allowedSrs: number[]): Promise<ParentAttendanceMonth> {
    this.ensureScope(sr, allowedSrs);
    const [yy, mm] = month.split("-").map(Number);
    if (!yy || !mm || mm < 1 || mm > 12) {
      throw new NotFoundException("Bad month");
    }
    const monthStart = new Date(Date.UTC(yy, mm - 1, 1));
    const monthEnd = new Date(Date.UTC(yy, mm, 0));     // last day
    const sessionCode = await this.currentSessionCode();

    // Whole-month rows
    const rows = await this.db.attendance.findMany({
      where: {
        sr_number: sr,
        session_code: sessionCode,
        attendance_date: { gte: monthStart, lte: monthEnd },
      },
      select: { attendance_date: true, status: true },
    });
    const days: Record<string, string> = {};
    let present = 0, absent = 0, late = 0, excused = 0;
    for (const r of rows) {
      const d = r.attendance_date.toISOString().slice(8, 10).replace(/^0/, "");
      days[d] = r.status;
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "excused") excused++;
    }
    const marked = present + absent + late + excused;
    const percent = marked > 0 ? Math.round((present / marked) * 100) : 0;

    // Today + last 7 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().slice(0, 10);
    const todayRow = await this.db.attendance.findFirst({
      where: { sr_number: sr, attendance_date: today },
      select: { status: true },
    });
    const todayStatus = todayRow?.status ?? "not_marked";

    const last7: { iso: string; status: string }[] = [];
    const last7Map = new Map<string, string>();
    const sevenAgo = new Date(today);
    sevenAgo.setDate(sevenAgo.getDate() - 6);
    const last7Rows = await this.db.attendance.findMany({
      where: { sr_number: sr, attendance_date: { gte: sevenAgo, lte: today } },
      select: { attendance_date: true, status: true },
    });
    for (const r of last7Rows) last7Map.set(r.attendance_date.toISOString().slice(0, 10), r.status);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      last7.push({ iso, status: last7Map.get(iso) ?? "not_marked" });
    }

    return {
      srNumber: sr,
      month,
      todayStatus,
      monthSummary: { present, absent, late, excused, marked, percent },
      days,
      last7,
      // todayKey unused by client but kept inline for parity
      ...(todayKey ? {} : {}),
    };
  }

  /* ─── EXAMS ─── */

  async exams(sr: number, allowedSrs: number[]): Promise<ParentExamsResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();

    const student = await this.db.student.findUnique({ where: { srNumber: sr }, select: { class: true } });
    const classSlug = student?.class ?? "";

    // Find class subjects + terms; left-join marks to compute final %s per subject.
    const [classSubjects, terms] = await Promise.all([
      this.db.exam_class_subjects.findMany({
        where: { class_slug: classSlug },
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        include: { exam_subjects: true },
      }),
      this.db.exam_terms.findMany({
        where: { session_code: sessionCode },
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      }),
    ]);
    const subjectIds = classSubjects.map((cs) => cs.subject_id);
    const termIds = terms.map((t) => t.id);
    const marks = subjectIds.length > 0 && termIds.length > 0
      ? await this.db.exam_marks.findMany({
          where: { sr_number: sr, subject_id: { in: subjectIds }, term_id: { in: termIds } },
          select: { subject_id: true, term_id: true, marks_obtained: true },
        })
      : [];
    // Per-term max marks comes from exam_terms.default_max_marks (the
    // per-class-per-subject override on exam_datesheet would be more
    // accurate but it's not always populated; this matches the PHP
    // marksheet helper closely enough).
    const maxByTerm = new Map(terms.map((t) => [t.id, t.default_max_marks ?? 100]));
    const markBy = new Map<string, { pct: number }>();
    for (const m of marks) {
      const obtained = m.marks_obtained != null ? Number(m.marks_obtained) : 0;
      const max = maxByTerm.get(m.term_id) ?? 100;
      const pct = max > 0 ? (obtained / max) * 100 : 0;
      markBy.set(`${m.subject_id}|${m.term_id}`, { pct });
    }

    // Per-subject final % = weighted average across terms
    type Subj = { id: number; name: string; shortCode: string; finalPct: number | null; finalGrade: string | null };
    const subjects: Subj[] = classSubjects.map((cs) => {
      const sub = cs.exam_subjects;
      let totalWeight = 0, weighted = 0, hasAny = false;
      for (const t of terms) {
        const got = markBy.get(`${sub.id}|${t.id}`);
        if (!got) continue;
        hasAny = true;
        const w = Number(t.weight_percent ?? 0);
        weighted += got.pct * w;
        totalWeight += w;
      }
      const finalPct = hasAny && totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : null;
      return {
        id: sub.id, name: sub.name, shortCode: sub.short_code,
        finalPct,
        finalGrade: finalPct == null ? null : gradeFromPct(finalPct),
      };
    });

    // Per-term overall % across all subjects
    const termRows = terms.map((t) => {
      let totalWeight = 0, weighted = 0, hasAny = false;
      for (const sub of classSubjects) {
        const got = markBy.get(`${sub.subject_id}|${t.id}`);
        if (!got) continue;
        hasAny = true;
        weighted += got.pct;
        totalWeight += 1;
      }
      return {
        id: t.id,
        name: t.name,
        shortCode: t.short_code,
        weightPercent: Number(t.weight_percent ?? 0),
        pct: hasAny && totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : null,
      };
    });

    // Overall
    const filledSubjects = subjects.filter((s) => s.finalPct != null);
    let overall: ParentExamsResponse["overall"] = null;
    if (filledSubjects.length > 0) {
      const avg = filledSubjects.reduce((s, x) => s + (x.finalPct ?? 0), 0) / filledSubjects.length;
      const round = Math.round(avg * 10) / 10;
      overall = {
        weightedPct: round,
        grade: gradeFromPct(round),
        result: round >= 33 ? "PASS" : "FAIL",
        totalObtained: filledSubjects.reduce((s, x) => s + (x.finalPct ?? 0), 0),
        totalMax: filledSubjects.length * 100,
      };
    }

    return {
      srNumber: sr,
      sessionCode,
      overall,
      subjects,
      terms: termRows,
    };
  }

  /* ─── FEES ─── */

  async fees(sr: number, allowedSrs: number[]): Promise<ParentFeesResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();

    const sf = await this.db.studentFee.findFirst({
      where: { srNumber: sr, sessionCode },
    });
    const payments = await this.db.fee_payments.findMany({
      where: { sr_number: sr, session_code: sessionCode, is_voided: false },
      orderBy: { paid_on: "desc" },
      select: {
        id: true, receipt_no: true, paid_on: true, amount: true, method: true,
        reference: true, recorded_by: true,
      },
    });

    const totalCharged = sf?.totalThisYear ?? 0;
    const paidAmount   = sf?.paidAmount    ?? 0;
    const dueAmount    = sf?.dueAmount     ?? Math.max(0, totalCharged - paidAmount);
    const status       = sf?.paymentStatus ?? "pending";

    const breakdown: { label: string; amount: number; note?: string }[] = [];
    if (sf) {
      if (sf.tuitionPayable > 0)  breakdown.push({ label: "Tuition fee",   amount: sf.tuitionPayable });
      if (sf.annualCharges > 0)   breakdown.push({ label: "Annual charges",amount: sf.annualCharges });
      if (sf.activityFee > 0)     breakdown.push({ label: "Activity fee",  amount: sf.activityFee });
      if (sf.examFee > 0)         breakdown.push({ label: "Exam fee",      amount: sf.examFee });
    }

    return {
      srNumber: sr,
      sessionCode,
      status,
      totalCharged,
      paidAmount,
      dueAmount,
      quarterlyInstallment: sf?.quarterlyInstallment ?? 0,
      monthlyEmi: sf?.monthlyEmi ?? 0,
      breakdown,
      payments: payments.map((p) => ({
        id: Number(p.id),
        receiptNo: p.receipt_no,
        paidOn: p.paid_on.toISOString().slice(0, 10),
        amount: p.amount,
        method: p.method,
        reference: p.reference,
        recordedBy: p.recorded_by,
      })),
    };
  }

  /* ─── DIARY ─── */

  async diary(sr: number, date: string, allowedSrs: number[]): Promise<ParentDiaryResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();
    const day = new Date(`${date}T00:00:00Z`);

    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: { class: true, section: true },
    });
    const classSlug = student?.class ?? "";
    const sectionCode = student?.section ?? "";
    const classLabel = `${classSlug}-${sectionCode}`;

    // Class-day entries (one per period)
    const rows = await this.db.class_diary.findMany({
      where: {
        session_code: sessionCode,
        class_slug: classSlug,
        section_code: sectionCode,
        diary_date: day,
      },
      include: {
        timetable_periods: { select: { name: true, start_time: true, end_time: true } },
        exam_subjects: { select: { name: true, short_code: true } },
        users_class_diary_teacher_user_idTousers: { select: { name: true } },
      },
      orderBy: { period_id: "asc" },
    });

    const entries = rows.map((r) => ({
      periodName: r.timetable_periods?.name ?? "",
      startTime:  r.timetable_periods?.start_time ? toHMS(r.timetable_periods.start_time) : null,
      endTime:    r.timetable_periods?.end_time   ? toHMS(r.timetable_periods.end_time)   : null,
      subjectName: r.exam_subjects?.name ?? null,
      subjectCode: r.exam_subjects?.short_code ?? null,
      teacherName: r.users_class_diary_teacher_user_idTousers?.name ?? null,
      topic:    r.topic    ?? null,
      homework: r.homework ?? null,
    }));

    // Recent dates with entries (last 7 distinct)
    const recent = await this.db.class_diary.findMany({
      where: { session_code: sessionCode, class_slug: classSlug, section_code: sectionCode },
      orderBy: { diary_date: "desc" },
      distinct: ["diary_date"],
      take: 7,
      select: { diary_date: true },
    });
    const recentDates = recent.map((r) => r.diary_date.toISOString().slice(0, 10));

    return { srNumber: sr, date, classLabel, entries, recentDates };
  }

  /* ─── TIMETABLE ─── */

  async timetable(sr: number, allowedSrs: number[]): Promise<ParentTimetableResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();

    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: { class: true, section: true },
    });
    const classSlug = student?.class ?? "";
    const sectionCode = student?.section ?? "";

    const periods = await this.db.timetable_periods.findMany({
      where: { session_code: sessionCode },
      orderBy: [{ sort_order: "asc" }, { period_no: "asc" }],
    });
    const cells = await this.db.timetable_entries.findMany({
      where: { session_code: sessionCode, class_slug: classSlug, section_code: sectionCode },
      include: {
        exam_subjects_timetable_entries_subject_idToexam_subjects: { select: { name: true, short_code: true } },
        users_timetable_entries_teacher_user_idTousers: { select: { name: true } },
      },
    });
    return {
      srNumber: sr,
      classLabel: `${classSlug}-${sectionCode}`,
      sessionCode,
      periods: periods.map((p) => ({
        id: p.id,
        periodNo: p.period_no,
        name: p.name,
        startTime: toHMS(p.start_time),
        endTime: toHMS(p.end_time),
        isBreak: p.is_break,
      })),
      cells: cells.map((c) => ({
        dayOfWeek: c.day_of_week,
        periodId: c.period_id,
        subjectName: c.exam_subjects_timetable_entries_subject_idToexam_subjects?.name ?? null,
        subjectCode: c.exam_subjects_timetable_entries_subject_idToexam_subjects?.short_code ?? null,
        teacherName: c.users_timetable_entries_teacher_user_idTousers?.name ?? null,
        room: c.room ?? null,
      })),
    };
  }

  /* ─── CONTACT ─── */

  async contact(sr: number, allowedSrs: number[]): Promise<ParentContactResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();

    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: { class: true, section: true },
    });
    const classSlug   = student?.class   ?? "";
    const sectionCode = student?.section ?? "";

    // Subject teachers (from this section's timetable)
    const cells = await this.db.timetable_entries.findMany({
      where: { session_code: sessionCode, class_slug: classSlug, section_code: sectionCode, teacher_user_id: { not: null } },
      include: {
        users_timetable_entries_teacher_user_idTousers: {
          select: {
            id: true, name: true, designation: true,
            phone: true, whatsapp: true,
            // staff schedule fields, if present:
          },
        },
        exam_subjects_timetable_entries_subject_idToexam_subjects: { select: { name: true } },
      },
    });
    const teacherMap = new Map<number, ParentContactStaff>();
    for (const c of cells) {
      const u = c.users_timetable_entries_teacher_user_idTousers;
      if (!u) continue;
      const existing = teacherMap.get(u.id);
      const subj = c.exam_subjects_timetable_entries_subject_idToexam_subjects?.name;
      if (existing) {
        if (subj && !existing.subjects?.includes(subj)) existing.subjects?.push(subj);
      } else {
        teacherMap.set(u.id, {
          id: u.id,
          roleLabel: "Subject Teacher",
          name: u.name,
          designation: u.designation ?? null,
          phone: u.phone ?? null,
          whatsapp: u.whatsapp ?? null,
          callStart: null,
          callEnd: null,
          canCallNow: false,
          callMasked: false,
          subjects: subj ? [subj] : [],
          isClassTeacher: false,
        });
      }
    }
    // Mark the section's class teacher
    const section = await this.db.sections.findFirst({
      where: { code: sectionCode, classes: { slug: classSlug } },
      select: { teacher_user_id: true },
    });
    if (section?.teacher_user_id) {
      const t = teacherMap.get(section.teacher_user_id);
      if (t) { t.isClassTeacher = true; t.roleLabel = "Class Teacher"; }
    }

    // School-chain staff — pick first user per role we care about.
    const roleSlugs = ["reception", "coordinator", "principal", "vice_principal", "head", "accountant", "hostel_warden", "counsellor"];
    const chainUsers = await this.db.user.findMany({
      where: { status: "active", role: { slug: { in: roleSlugs } } },
      select: {
        id: true, name: true, designation: true, phone: true, whatsapp: true,
        role: { select: { slug: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    const chain: ParentContactStaff[] = chainUsers.map((u) => ({
      id: u.id,
      roleLabel: u.role?.name ?? u.designation ?? "Staff",
      name: u.name,
      designation: u.designation ?? null,
      phone: u.phone ?? null,
      whatsapp: u.whatsapp ?? null,
      callStart: null,
      callEnd: null,
      canCallNow: false,
      callMasked: false,
    }));

    // Populate callStart/callEnd from each staffer's latest duty schedule.
    const allStaff = [...teacherMap.values(), ...chain];
    const userIds = allStaff.map((s) => s.id);
    const dutyByUser = await this.dutyWindows(userIds);
    for (const s of allStaff) {
      const w = dutyByUser.get(s.id);
      if (w) { s.callStart = w.start; s.callEnd = w.end; }
    }

    // Office status: reception's window is the office window if known,
    // else the widest window across school-chain staff who have one.
    // Falls back to the free-text "Office Hours" from school_info.
    const reception = chainUsers.find((u) => u.role?.slug === "reception");
    const receptionWindow = reception ? dutyByUser.get(reception.id) : undefined;
    const chainWindows = chain.map((c) => dutyByUser.get(c.id)).filter(Boolean) as { start: string; end: string }[];
    const hoursRow = await this.db.$queryRawUnsafe<{ v: string }[]>(
      "SELECT v FROM school_info WHERE k = 'Office Hours' LIMIT 1",
    );
    const fallbackHours = hoursRow[0]?.v?.trim() || null;
    const office = this.officeStatus(receptionWindow, chainWindows, fallbackHours);

    // Call gating + number masking. When masked calling is configured we
    // NEVER hand the parent a personal number — calls go through the
    // provider (POST /parent/contact/call). The call button is enabled
    // only inside each staffer's window (or office hours as a fallback).
    const callMasked = isCallingUsable(await readCallingConfig(this.db));
    const { minutes, dow } = nowInIst();
    const isSunday = dow === 0;
    for (const s of allStaff) {
      s.canCallNow = !isSunday && (
        s.callStart && s.callEnd
          ? minutes >= hmToMinutes(s.callStart) && minutes < hmToMinutes(s.callEnd)
          : office.isOpen
      );
      s.callMasked = callMasked;
      if (callMasked) { s.phone = null; s.whatsapp = null; }
    }

    // After-hours WhatsApp routes through the school's business number,
    // never a staffer's personal one.
    const waNum = await this.db.app_settings.findUnique({
      where: { setting_key: "whatsapp.display_number" },
      select: { setting_value: true },
    });
    const schoolWhatsapp = waNum?.setting_value?.trim() || null;

    return {
      srNumber: sr,
      classLabel: `${classSlug}-${sectionCode}`,
      office,
      callingEnabled: callMasked,
      schoolWhatsapp,
      subjectTeachers: Array.from(teacherMap.values()),
      schoolChain: chain,
    };
  }

  /* ─── MASKED CALL ─── */

  /**
   * Place a masked parent ↔ staff call via the provider (Exotel). Neither
   * party sees the other's number. Refuses outside the staffer's call
   * window so the gating can't be bypassed by hitting the API directly.
   */
  async callStaff(sr: number, staffId: number, parentPhone: string, allowedSrs: number[]): Promise<MaskedCallResult> {
    this.ensureScope(sr, allowedSrs);

    const cfg = await readCallingConfig(this.db);
    if (!isCallingUsable(cfg)) {
      throw new ForbiddenException("Calling is not available. Please use WhatsApp.");
    }

    const staff = await this.db.user.findFirst({
      where: { id: staffId, status: "active" },
      select: { phone: true },
    });
    if (!staff?.phone) throw new NotFoundException("Staff member not reachable.");

    // Enforce the same window gating the UI shows.
    const window = (await this.dutyWindows([staffId])).get(staffId);
    const { minutes, dow } = nowInIst();
    const open = dow !== 0 && (
      window
        ? minutes >= hmToMinutes(window.start) && minutes < hmToMinutes(window.end)
        : true
    );
    if (!open) {
      throw new ForbiddenException("Calling is closed right now. Please use WhatsApp.");
    }

    if (!parentPhone) throw new ForbiddenException("Your number is unavailable for calling.");
    return placeMaskedCall(cfg, parentPhone, staff.phone);
  }

  /* ─── TESTS (MCQ + fill-in-the-blanks) ─── */

  /** Published tests for a child's class, with attempt state + prior score. */
  async tests(sr: number, allowedSrs: number[]): Promise<ParentTestListResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();
    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: { class: true, section: true },
    });
    const classSlug = student?.class ?? "";
    const sectionCode = student?.section ?? "";

    const tests = await this.db.tests.findMany({
      where: {
        session_code: sessionCode,
        status: "published",
        class_slug: classSlug,
        OR: [{ section_code: null }, { section_code: sectionCode }],
      },
      include: { _count: { select: { test_questions: true } } },
      orderBy: { id: "desc" },
    });

    const ids = tests.map((t) => t.id);
    const attempts = ids.length
      ? await this.db.test_attempts.findMany({ where: { test_id: { in: ids }, sr_number: sr } })
      : [];
    const aMap = new Map(attempts.map((a) => [a.test_id, a]));
    const subjMap = await this.subjectNames(tests.map((t) => t.subject_id));
    const now = new Date();

    return {
      srNumber: sr,
      tests: tests.map((t) => {
        const att = aMap.get(t.id);
        let state: ParentTestListResponse["tests"][number]["state"];
        if (att?.status === "submitted") state = "attempted";
        else if (t.available_from && t.available_from > now) state = "upcoming";
        else if (t.available_to && t.available_to < now) state = "closed";
        else state = "available";
        return {
          id: t.id,
          title: t.title,
          subjectName: t.subject_id ? subjMap.get(t.subject_id) ?? null : null,
          totalMarks: t.total_marks,
          questionCount: t._count.test_questions,
          durationMin: t.duration_min,
          availableFrom: t.available_from ? t.available_from.toISOString() : null,
          availableTo: t.available_to ? t.available_to.toISOString() : null,
          state,
          score: att?.score ?? null,
          passMarks: t.pass_marks,
          passed:
            t.pass_marks != null && att?.status === "submitted" && att.score != null
              ? att.score >= t.pass_marks
              : null,
        };
      }),
    };
  }

  /** A playable test for the child — questions WITHOUT the answer key. */
  async testDetail(testId: number, sr: number, allowedSrs: number[]): Promise<ParentTestDetail> {
    this.ensureScope(sr, allowedSrs);
    const test = await this.loadOpenTestForStudent(testId, sr, { enforceWindow: true });
    const attempt = await this.db.test_attempts.findUnique({
      where: { test_id_sr_number: { test_id: testId, sr_number: sr } },
    });
    const subjMap = await this.subjectNames([test.subject_id]);
    return {
      id: test.id,
      title: test.title,
      instructions: test.instructions,
      subjectName: test.subject_id ? subjMap.get(test.subject_id) ?? null : null,
      durationMin: test.duration_min,
      totalMarks: test.total_marks,
      alreadyAttempted: attempt?.status === "submitted",
      questions: test.test_questions.map((q) => {
        const p = parseQuestion(q);
        return { id: p.id, type: p.type, prompt: p.prompt, marks: p.marks, options: p.options };
      }),
    };
  }

  /** Submit + auto-grade a child's attempt. One submission per child per test. */
  async submitTest(
    testId: number,
    input: TestSubmitInput,
    allowedSrs: number[],
    phone: string,
  ): Promise<TestSubmitResult> {
    const sr = input.sr;
    this.ensureScope(sr, allowedSrs);
    const test = await this.loadOpenTestForStudent(testId, sr, { enforceWindow: true });

    const existing = await this.db.test_attempts.findUnique({
      where: { test_id_sr_number: { test_id: testId, sr_number: sr } },
    });
    if (existing?.status === "submitted") {
      throw new ForbiddenException("You've already submitted this test.");
    }

    const parsed = test.test_questions.map(parseQuestion);
    const ansByQ = new Map(input.answers.map((a) => [a.questionId, a]));
    let score = 0;
    const graded = parsed.map((q) => {
      const a = ansByQ.get(q.id);
      const { isCorrect, awarded } = gradeAnswer(q, a?.selectedOptions, a?.responseText);
      score += awarded;
      return { q, a, isCorrect, awarded };
    });
    const maxScore = test.total_marks;
    const now = new Date();

    const attempt = await this.db.test_attempts.upsert({
      where: { test_id_sr_number: { test_id: testId, sr_number: sr } },
      update: { status: "submitted", score, max_score: maxScore, submitted_at: now, submitted_by_phone: phone },
      create: {
        test_id: testId, sr_number: sr, status: "submitted",
        score, max_score: maxScore, submitted_at: now, submitted_by_phone: phone,
      },
    });
    await this.db.test_attempt_answers.deleteMany({ where: { attempt_id: attempt.id } });
    await this.db.test_attempt_answers.createMany({
      data: graded.map((g) => ({
        attempt_id: attempt.id,
        question_id: g.q.id,
        selected_json: g.q.type === "mcq" ? JSON.stringify(g.a?.selectedOptions ?? []) : null,
        response_text: g.q.type === "fill_blank" ? g.a?.responseText ?? null : null,
        is_correct: g.isCorrect,
        awarded_marks: g.awarded,
      })),
    });

    return {
      testId,
      srNumber: sr,
      score,
      maxScore,
      percent: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : 0,
      passMarks: test.pass_marks,
      passed: test.pass_marks != null ? score >= test.pass_marks : null,
      submittedAt: now.toISOString(),
      answers: graded.map((g) => ({
        questionId: g.q.id,
        type: g.q.type,
        prompt: g.q.prompt,
        marks: g.q.marks,
        awardedMarks: g.awarded,
        isCorrect: g.isCorrect,
        selectedOptions: g.q.type === "mcq" ? g.a?.selectedOptions ?? [] : null,
        responseText: g.q.type === "fill_blank" ? g.a?.responseText ?? null : null,
        correctOptions: g.q.correctOptions,
        acceptedAnswers: g.q.acceptedAnswers,
      })),
    };
  }

  /**
   * Load a published test and assert it belongs to this child's class and
   * (optionally) is within its availability window.
   */
  private async loadOpenTestForStudent(
    testId: number,
    sr: number,
    opts: { enforceWindow: boolean },
  ) {
    const test = await this.db.tests.findUnique({
      where: { id: testId },
      include: { test_questions: { orderBy: { sort_order: "asc" } } },
    });
    if (!test || test.status !== "published") {
      throw new NotFoundException("Test not available.");
    }
    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: { class: true, section: true },
    });
    const classOk = student && student.class === test.class_slug &&
      (!test.section_code || test.section_code === student.section);
    if (!classOk) throw new ForbiddenException("This test isn't for this student.");

    if (opts.enforceWindow) {
      const now = new Date();
      if (test.available_from && test.available_from > now) {
        throw new ForbiddenException("This test hasn't opened yet.");
      }
      if (test.available_to && test.available_to < now) {
        throw new ForbiddenException("This test has closed.");
      }
    }
    return test;
  }

  private async subjectNames(ids: (number | null)[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((x): x is number => x != null))];
    if (unique.length === 0) return new Map();
    const rows = await this.db.exam_subjects.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /* ─── CALENDAR ─── */

  /**
   * School calendar feed for parents — merged events + holidays + exams,
   * restricted to parent-visible audiences. When `sr` is given, the feed
   * is scoped to that child's class (school-wide entries still included).
   */
  async calendar(
    query: { month?: string; from?: string; to?: string },
    allowedSrs: number[],
    sr?: number,
  ): Promise<CalendarFeedResponse> {
    const sessionCode = await this.currentSessionCode();
    let classSlug: string | undefined;
    if (sr) {
      this.ensureScope(sr, allowedSrs);
      const student = await this.db.student.findUnique({
        where: { srNumber: sr },
        select: { class: true },
      });
      classSlug = student?.class ?? undefined;
    }
    const { from, to } = resolveRange(query);
    return buildCalendarFeed(this.db, {
      from,
      to,
      sessionCode,
      classSlug,
      includeHolidays: true,
      includeExams: true,
      parentScope: true,
    });
  }

  /**
   * Latest effective duty window per user as "HH:MM" strings.
   * Picks the row with the most recent effective_from on/before today.
   */
  private async dutyWindows(userIds: number[]): Promise<Map<number, { start: string; end: string }>> {
    const out = new Map<number, { start: string; end: string }>();
    if (userIds.length === 0) return out;
    const rows = await this.db.staff_schedules.findMany({
      where: { user_id: { in: userIds }, effective_from: { lte: new Date() } },
      orderBy: [{ user_id: "asc" }, { effective_from: "desc" }],
      select: { user_id: true, duty_start: true, duty_end: true },
    });
    for (const r of rows) {
      if (out.has(r.user_id)) continue;   // first per user = latest effective_from
      out.set(r.user_id, { start: timeToHM(r.duty_start), end: timeToHM(r.duty_end) });
    }
    return out;
  }

  /** Build the structured office-open status for the contact page. */
  private officeStatus(
    reception: { start: string; end: string } | undefined,
    chainWindows: { start: string; end: string }[],
    fallbackHours: string | null,
  ): ParentOfficeStatus {
    let opensAt: string | null = null;
    let closesAt: string | null = null;
    if (reception) {
      opensAt = reception.start;
      closesAt = reception.end;
    } else if (chainWindows.length > 0) {
      opensAt = chainWindows.reduce((a, w) => (w.start < a ? w.start : a), chainWindows[0]!.start);
      closesAt = chainWindows.reduce((a, w) => (w.end > a ? w.end : a), chainWindows[0]!.end);
    }

    // No structured window — surface the free-text hours, can't compute isOpen.
    if (!opensAt || !closesAt) {
      return {
        isOpen: false,
        opensAt: null,
        closesAt: null,
        hoursLabel: fallbackHours,
        label: fallbackHours ?? "Office hours unavailable",
      };
    }

    const { minutes, dow } = nowInIst();
    const isSunday = dow === 0;
    const isOpen = !isSunday && minutes >= hmToMinutes(opensAt) && minutes < hmToMinutes(closesAt);

    const label = isOpen
      ? `Open now · closes ${hmTo12(closesAt)}`
      : isSunday
        ? "Closed today (Sunday)"
        : minutes < hmToMinutes(opensAt)
          ? `Closed · opens ${hmTo12(opensAt)}`
          : `Closed · opens ${hmTo12(opensAt)} tomorrow`;

    return {
      isOpen,
      opensAt,
      closesAt,
      hoursLabel: `Mon–Sat ${hmTo12(opensAt)} – ${hmTo12(closesAt)}`,
      label,
    };
  }

  /* ─── TRANSPORT ─── */

  async transport(sr: number, allowedSrs: number[]): Promise<ParentTransportResponse> {
    this.ensureScope(sr, allowedSrs);
    const sessionCode = await this.currentSessionCode();

    const student = await this.db.student.findUnique({
      where: { srNumber: sr },
      select: {
        pickup_point_name: true, pickup_distance_km: true, pickup_maps_link: true,
        pickupPoint: { select: { name: true, distanceKm: true, googleMapsLink: true } },
      },
    });
    const fee = await this.db.studentFee.findUnique({
      where: { srNumber_sessionCode: { srNumber: sr, sessionCode } },
      select: { distanceKm: true, transportSlab: true, transportFee: true },
    });

    const pickupPointName = student?.pickupPoint?.name ?? student?.pickup_point_name ?? null;
    const distanceDec = fee?.distanceKm ?? student?.pickupPoint?.distanceKm ?? student?.pickup_distance_km ?? null;
    const distanceKm = distanceDec != null ? Number(distanceDec) : null;
    const transportFee = fee?.transportFee ?? 0;
    const routeSlab = fee?.transportSlab ?? null;
    const mapsLink = student?.pickupPoint?.googleMapsLink ?? student?.pickup_maps_link ?? null;

    let routeRange: string | null = null;
    let yearlyFee: number | null = null;
    let quarterlyFee: number | null = null;
    let monthlyFee: number | null = null;
    if (routeSlab) {
      const slab = await this.db.transport_slabs.findUnique({ where: { slab: routeSlab } });
      if (slab) {
        routeRange = slab.distance_range;
        yearlyFee = slab.yearly_fee;
        quarterlyFee = slab.quarterly_fee;
        monthlyFee = slab.monthly_fee;
      }
    }

    const usesTransport = transportFee > 0 || pickupPointName != null || routeSlab != null;

    return {
      srNumber: sr,
      usesTransport,
      pickupPointName,
      routeSlab,
      routeRange,
      distanceKm,
      transportFee,
      yearlyFee,
      quarterlyFee,
      monthlyFee,
      mapsLink,
    };
  }

  /* ─── RECEIPT ─── */

  async receipt(id: number, allowedSrs: number[]): Promise<ParentReceiptResponse> {
    const p = await this.db.fee_payments.findUnique({
      where: { id },
      include: {
        students: { select: { srNumber: true, studentName: true, class: true, section: true, fatherName: true } },
      },
    });
    if (!p || p.is_voided) throw new NotFoundException("Receipt not found.");
    this.ensureScope(Number(p.sr_number), allowedSrs);

    const info = await this.db.$queryRawUnsafe<{ k: string; v: string }[]>(
      "SELECT k, v FROM school_info WHERE k IN ('School Name', 'Address')",
    );
    const m = new Map(info.map((r) => [r.k, r.v]));

    return {
      id: Number(p.id),
      receiptNo: p.receipt_no,
      srNumber: Number(p.sr_number),
      studentName: p.students.studentName,
      classLabel: `${p.students.class}-${p.students.section}`,
      fatherName: p.students.fatherName ?? null,
      sessionCode: p.session_code,
      paidOn: p.paid_on.toISOString().slice(0, 10),
      amount: p.amount,
      method: p.method,
      reference: p.reference,
      notes: p.notes,
      recordedBy: p.recorded_by,
      schoolName: m.get("School Name")?.trim() || "School",
      schoolAddress: m.get("Address")?.trim() || null,
    };
  }

  /* ─── CHECKOUT (HDFC) ─── */

  async checkout(sr: number, input: CheckoutCreateInput, allowedSrs: number[], phone10: string, ip: string | null): Promise<CheckoutSession> {
    this.ensureScope(sr, allowedSrs);
    // Reuse the shared HDFC flow against the platform DB. The hosted-page
    // return + webhook (POST /api/pay/return, /api/pay/webhook) reconcile
    // the attempt back into fee_payments on the same platform DB.
    return this.payments.createCheckout(this.db, sr, input, `parent:${phone10}`, ip);
  }

  /* ─── MORE ─── */

  async moreInfo(): Promise<ParentMoreInfo> {
    const rows = await this.db.$queryRawUnsafe<{ k: string; v: string }[]>(
      "SELECT k, v FROM school_info",
    );
    const m = new Map(rows.map((r) => [r.k, r.v]));
    return {
      schoolName: m.get("School Name") || "School",
      address: m.get("Address") || null,
      officeHours: m.get("Office Hours") || "Mon–Fri 8 AM – 4 PM · Sat till 1 PM",
      affiliation: m.get("Affiliation") || null,
      mapsLink: m.get("Google Maps Link") || null,
    };
  }
}

function gradeFromPct(pct: number): string {
  if (pct >= 90) return "A1";
  if (pct >= 80) return "A2";
  if (pct >= 70) return "B1";
  if (pct >= 60) return "B2";
  if (pct >= 50) return "C1";
  if (pct >= 40) return "C2";
  if (pct >= 33) return "D";
  return "E";
}

function toHMS(d: Date): string {
  return d.toISOString().slice(11, 19);
}

/* ─────────────────── helpers ─────────────────── */

/** Columns selected for every kid row — covers display fields plus the
 *  contact fields login matching and resolveParent() rely on. */
const KID_SELECT = {
  srNumber: true, studentName: true, class: true, section: true,
  dob: true, is_hostel: true, gender: true,
  fatherName: true, fatherContact: true, father_whatsapp: true,
  motherName: true, motherContact: true, mother_whatsapp: true,
  local_guardian_name: true, local_guardian_contact: true, local_guardian_whatsapp: true,
  guardian_relation: true,
  callingNumber: true, whatsappNumber: true,
} as const;

interface KidRow {
  srNumber: number;
  studentName: string;
  class: string;
  section: string;
  dob: Date | null;
  is_hostel: boolean;
  gender: string | null;
  fatherName: string | null;
  fatherContact: string | null;
  father_whatsapp: string | null;
  motherName: string | null;
  motherContact: string | null;
  mother_whatsapp: string | null;
  local_guardian_name: string | null;
  local_guardian_contact: string | null;
  local_guardian_whatsapp: string | null;
  guardian_relation: string | null;
  callingNumber: string | null;
  whatsappNumber: string | null;
}

function mapKid(s: KidRow): ParentKid {
  return {
    srNumber: Number(s.srNumber),
    studentName: s.studentName,
    classLabel: `${s.class}-${s.section}`,
    dob: s.dob ? s.dob.toISOString().slice(0, 10) : null,
    isHostel: s.is_hostel,
    gender: s.gender ?? null,
    fatherName: s.fatherName ?? null,
    fatherPhone: s.fatherContact ?? null,
    motherName: s.motherName ?? null,
    motherPhone: s.motherContact ?? null,
    guardianName: s.local_guardian_name ?? null,
    guardianPhone: s.local_guardian_contact ?? null,
  };
}

/**
 * Work out which parent the login phone belongs to (and their name) by
 * matching the last-10-digits against each kid's contact fields. Father
 * → mother → guardian precedence; the first hit across any kid wins.
 */
function resolveParent(phone10: string, rows: KidRow[]): { parentName: string | null; relationship: string | null } {
  for (const s of rows) {
    if ([s.fatherContact, s.father_whatsapp].some((p) => lastTenDigits(p ?? "") === phone10)) {
      return { parentName: s.fatherName ?? null, relationship: "Father" };
    }
    if ([s.motherContact, s.mother_whatsapp].some((p) => lastTenDigits(p ?? "") === phone10)) {
      return { parentName: s.motherName ?? null, relationship: "Mother" };
    }
    if ([s.local_guardian_contact, s.local_guardian_whatsapp].some((p) => lastTenDigits(p ?? "") === phone10)) {
      return {
        parentName: s.local_guardian_name ?? null,
        relationship: s.guardian_relation ? capitalize(s.guardian_relation) : "Guardian",
      };
    }
  }
  return { parentName: null, relationship: null };
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}

/** Prisma @db.Time(0) → "HH:MM" (the stored wall-clock, read as UTC). */
function timeToHM(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hmTo12(hm: string): string {
  const [h, m] = hm.split(":").map(Number);
  const hh = h ?? 0, mm = m ?? 0;
  const ampm = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0 ? `${h12} ${ampm}` : `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

/** Current time in IST as minutes-since-midnight + day-of-week (0=Sun). */
function nowInIst(): { minutes: number; dow: number } {
  const ist = new Date(Date.now() + (5 * 60 + 30) * 60_000);
  return { minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(), dow: ist.getUTCDay() };
}

function lastTenDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.slice(-10);
}

/** "08072008" → "2008-07-08". Returns null on invalid date. */
function ddmmyyyyToIso(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const dd = Number(d.slice(0, 2));
  const mm = Number(d.slice(2, 4));
  const yy = Number(d.slice(4, 8));
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return null;
  // Cheap validity check via Date round-trip.
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  if (dt.getUTCFullYear() !== yy || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== dd) return null;
  return `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
