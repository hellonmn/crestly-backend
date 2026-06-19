import { Injectable, BadRequestException, NotFoundException, ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type {
  EligibleTeachersResponse,
  SmartAllotInput,
  SmartAllotResult,
  TimetableCell,
  TimetableCellUpsert,
  TimetableGridQuery,
  TimetableGridResponse,
  TimetablePeriod,
  TimetablePeriodUpsert,
  WorkloadRow,
} from "@crestly/shared";

/* ============================================================
   Port of erp/lib/timetable.php — strict feature parity.

   Schema:
     - timetable_periods  : daily time-slot skeleton (per session)
     - timetable_entries  : one row per (session, class, section, day, period)
   Day-of-week is 1..6 (Mon..Sat).
   ============================================================ */

const DAYS = [1, 2, 3, 4, 5, 6] as const;

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  /* ─────────────────────────── Periods ────────────────────────── */

  async periods(): Promise<TimetablePeriod[]> {
    const session = await this.sessions.current();
    const rows = await this.prisma.db.timetable_periods.findMany({
      where: { session_code: session.code },
      orderBy: [{ sort_order: "asc" }, { period_no: "asc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      periodNo: p.period_no,
      name: p.name,
      startTime: timeStr(p.start_time),
      endTime: timeStr(p.end_time),
      isBreak: p.is_break,
      sortOrder: p.sort_order,
    }));
  }

  async upsertPeriod(input: TimetablePeriodUpsert, id?: number): Promise<TimetablePeriod> {
    const session = await this.sessions.current();
    const start = new Date(`1970-01-01T${normaliseTime(input.startTime)}Z`);
    const end = new Date(`1970-01-01T${normaliseTime(input.endTime)}Z`);
    const row = id
      ? await this.prisma.db.timetable_periods.update({
          where: { id },
          data: {
            period_no: input.periodNo, name: input.name,
            start_time: start, end_time: end,
            is_break: input.isBreak, sort_order: input.sortOrder,
          },
        })
      : await this.prisma.db.timetable_periods.create({
          data: {
            session_code: session.code, period_no: input.periodNo, name: input.name,
            start_time: start, end_time: end,
            is_break: input.isBreak, sort_order: input.sortOrder,
          },
        });
    return {
      id: row.id, periodNo: row.period_no, name: row.name,
      startTime: timeStr(row.start_time), endTime: timeStr(row.end_time),
      isBreak: row.is_break, sortOrder: row.sort_order,
    };
  }

  async deletePeriod(id: number): Promise<{ ok: true }> {
    await this.prisma.db.timetable_periods.delete({ where: { id } });
    return { ok: true };
  }

  /* ─────────────────────────── Grid ──────────────────────────── */

  async grid(query: TimetableGridQuery): Promise<TimetableGridResponse> {
    const sessionCode = query.sessionCode ?? (await this.sessions.current()).code;
    const periods = await this.periods();

    let where: Prisma.timetable_entriesWhereInput;
    let scope: "section" | "teacher";
    let scopeLabel: string;
    let fillCount: number | undefined;

    if (query.teacherUserId) {
      // PHP: tt_teacher_grid — matches in EITHER primary or parallel slot.
      where = {
        session_code: sessionCode,
        OR: [
          { teacher_user_id: query.teacherUserId },
          { teacher_user_id2: query.teacherUserId },
        ],
      };
      scope = "teacher";
      const teacher = await this.prisma.db.user.findUnique({
        where: { id: query.teacherUserId },
        select: { name: true },
      });
      scopeLabel = teacher?.name ?? `User #${query.teacherUserId}`;
    } else if (query.class && query.section) {
      where = {
        session_code: sessionCode,
        class_slug: query.class,
        section_code: query.section,
      };
      scope = "section";
      scopeLabel = `${query.class}-${query.section}`;
      // PHP: tt_section_fill — count of cells with subject OR teacher.
      fillCount = await this.prisma.db.timetable_entries.count({
        where: {
          ...where,
          OR: [{ subject_id: { not: null } }, { teacher_user_id: { not: null } }],
        },
      });
    } else {
      throw new BadRequestException("Provide either teacherUserId or both class+section");
    }

    const cells = await this.prisma.db.timetable_entries.findMany({
      where,
      include: {
        exam_subjects_timetable_entries_subject_idToexam_subjects: { select: { id: true, name: true, short_code: true } },
        users_timetable_entries_teacher_user_idTousers: { select: { id: true, name: true } },
        exam_subjects_timetable_entries_subject_id2Toexam_subjects: { select: { id: true, name: true, short_code: true } },
        users_timetable_entries_teacher_user_id2Tousers: { select: { id: true, name: true } },
      },
    });

    const cellsDto: TimetableCell[] = cells.map((c) => ({
      id: c.id,
      dayOfWeek: c.day_of_week,
      periodId: c.period_id,
      classSlug: c.class_slug,
      sectionCode: c.section_code,
      subjectId: c.subject_id,
      subjectName: c.exam_subjects_timetable_entries_subject_idToexam_subjects?.name ?? null,
      subjectShortCode: c.exam_subjects_timetable_entries_subject_idToexam_subjects?.short_code ?? null,
      teacherUserId: c.teacher_user_id,
      teacherName: c.users_timetable_entries_teacher_user_idTousers?.name ?? null,
      subjectId2: c.subject_id2,
      subjectName2: c.exam_subjects_timetable_entries_subject_id2Toexam_subjects?.name ?? null,
      subjectShortCode2: c.exam_subjects_timetable_entries_subject_id2Toexam_subjects?.short_code ?? null,
      teacherUserId2: c.teacher_user_id2,
      teacherName2: c.users_timetable_entries_teacher_user_id2Tousers?.name ?? null,
      room: c.room,
      notes: c.notes,
    }));

    return { sessionCode, scope, scopeLabel, periods, cells: cellsDto, fillCount };
  }

  /* ──────────────────── Cell save / clear ──────────────────── */

  /** PHP: tt_save_cell — upsert one cell, throw on teacher double-booking
   *  unless `force` is set. */
  async upsertCell(input: TimetableCellUpsert): Promise<TimetableCell> {
    const session = await this.sessions.current();

    if (!input.force) {
      for (const t of [input.teacherUserId, input.teacherUserId2]) {
        if (!t) continue;
        const conflict = await this.teacherConflict(
          t, input.dayOfWeek, input.periodId, input.classSlug, input.sectionCode, session.code,
        );
        if (conflict) {
          throw new ConflictException(
            `Teacher already booked for ${conflict.classSlug}-${conflict.sectionCode} in this slot.`,
          );
        }
      }
    }

    const existing = await this.prisma.db.timetable_entries.findFirst({
      where: {
        session_code: session.code,
        class_slug: input.classSlug,
        section_code: input.sectionCode,
        day_of_week: input.dayOfWeek,
        period_id: input.periodId,
      },
    });
    if (existing) {
      await this.prisma.db.timetable_entries.update({
        where: { id: existing.id },
        data: {
          subject_id: input.subjectId,
          teacher_user_id: input.teacherUserId,
          subject_id2: input.subjectId2 ?? null,
          teacher_user_id2: input.teacherUserId2 ?? null,
          room: input.room ?? null,
          notes: input.notes ?? null,
        },
      });
    } else {
      await this.prisma.db.timetable_entries.create({
        data: {
          session_code: session.code,
          class_slug: input.classSlug,
          section_code: input.sectionCode,
          day_of_week: input.dayOfWeek,
          period_id: input.periodId,
          subject_id: input.subjectId,
          teacher_user_id: input.teacherUserId,
          subject_id2: input.subjectId2 ?? null,
          teacher_user_id2: input.teacherUserId2 ?? null,
          room: input.room ?? null,
          notes: input.notes ?? null,
        },
      });
    }
    const grid = await this.grid({
      class: input.classSlug,
      section: input.sectionCode,
      sessionCode: session.code,
    });
    const cell = grid.cells.find(
      (c) => c.dayOfWeek === input.dayOfWeek && c.periodId === input.periodId,
    );
    if (!cell) throw new NotFoundException("Cell saved but reload failed");
    return cell;
  }

  async deleteCell(id: number): Promise<{ ok: true }> {
    await this.prisma.db.timetable_entries.delete({ where: { id } });
    return { ok: true };
  }

  /** PHP: tt_clear_cell — by (class, section, day, period). */
  async clearCell(classSlug: string, sectionCode: string, day: number, periodId: number): Promise<{ ok: true }> {
    const session = await this.sessions.current();
    await this.prisma.db.timetable_entries.deleteMany({
      where: {
        session_code: session.code,
        class_slug: classSlug,
        section_code: sectionCode,
        day_of_week: day,
        period_id: periodId,
      },
    });
    return { ok: true };
  }

  /** PHP: tt_teacher_conflict — is this teacher already booked elsewhere
   *  at (day, period), in either primary or parallel column? Excludes the
   *  cell being edited. */
  private async teacherConflict(
    teacherUserId: number, day: number, periodId: number,
    classSlug: string, sectionCode: string, sessionCode: string,
  ): Promise<{ classSlug: string; sectionCode: string } | null> {
    const row = await this.prisma.db.timetable_entries.findFirst({
      where: {
        session_code: sessionCode,
        day_of_week: day,
        period_id: periodId,
        OR: [{ teacher_user_id: teacherUserId }, { teacher_user_id2: teacherUserId }],
        NOT: { AND: [{ class_slug: classSlug }, { section_code: sectionCode }] },
      },
      select: { class_slug: true, section_code: true },
    });
    return row ? { classSlug: row.class_slug, sectionCode: row.section_code } : null;
  }

  /* ─────────────────── Eligible teachers ─────────────────── */

  /** PHP: tt_eligible_teachers_for_class — per-subject lists filtered by
   *  class band + subject specialty (or generalist class teachers). */
  async eligibleTeachersForClass(classSlug: string): Promise<EligibleTeachersResponse> {
    const band = classBand(classSlug);
    const subjects = await this.subjectsForClass(classSlug);
    const teachers = await this.teacherRoster();

    const bySubject: Record<string, number[]> = {};
    for (const s of subjects) bySubject[String(s.id)] = [];

    for (const t of teachers) {
      const desig = (t.designation ?? "").toLowerCase();
      const tband = deptBand(t.department ?? "");
      const isGeneralist = desig.includes("class teacher");

      for (const sub of subjects) {
        if (designationMatchesSubject(desig, sub.shortCode, sub.name)) {
          // Subject specialist — give benefit of the doubt on unknown band.
          if (band === "" || tband === "" || tband === band) {
            bySubject[String(sub.id)]!.push(t.id);
          }
        } else if (isGeneralist && band !== "" && tband === band) {
          // Generalist class teacher — strict band match.
          bySubject[String(sub.id)]!.push(t.id);
        }
      }
    }

    return {
      classSlug,
      classBand: band,
      teachers: teachers.map((t) => ({
        id: t.id,
        name: t.name,
        designation: t.designation,
        department: t.department,
      })),
      bySubject,
    };
  }

  /* ─────────────────── Workload ─────────────────── */

  /** PHP: tt_teacher_workload — capacity = (non-break periods) × 6 days. */
  async workload(): Promise<WorkloadRow[]> {
    const session = await this.sessions.current();
    const periods = await this.prisma.db.timetable_periods.count({
      where: { session_code: session.code, is_break: false },
    });
    const capacity = periods * 6;

    const teachers = await this.prisma.db.user.findMany({
      where: { status: "active" },
      select: { id: true, name: true, designation: true, department: true },
      orderBy: { name: "asc" },
    });

    const primary = await this.prisma.db.timetable_entries.groupBy({
      by: ["teacher_user_id"],
      where: { session_code: session.code, teacher_user_id: { not: null } },
      _count: { _all: true },
    });
    const parallel = await this.prisma.db.timetable_entries.groupBy({
      by: ["teacher_user_id2"],
      where: { session_code: session.code, teacher_user_id2: { not: null } },
      _count: { _all: true },
    });
    const counts = new Map<number, number>();
    for (const r of primary) if (r.teacher_user_id) counts.set(r.teacher_user_id, (counts.get(r.teacher_user_id) ?? 0) + r._count._all);
    for (const r of parallel) if (r.teacher_user_id2) counts.set(r.teacher_user_id2, (counts.get(r.teacher_user_id2) ?? 0) + r._count._all);

    const sections = await this.prisma.db.timetable_entries.findMany({
      where: { session_code: session.code, teacher_user_id: { not: null } },
      select: { teacher_user_id: true, class_slug: true, section_code: true },
    });
    const sectionsByTeacher = new Map<number, Set<string>>();
    for (const s of sections) {
      if (!s.teacher_user_id) continue;
      const set = sectionsByTeacher.get(s.teacher_user_id) ?? new Set();
      set.add(`${s.class_slug}-${s.section_code}`);
      sectionsByTeacher.set(s.teacher_user_id, set);
    }

    return teachers.map((t) => {
      const assigned = counts.get(t.id) ?? 0;
      return {
        userId: t.id,
        name: t.name,
        designation: t.designation,
        department: t.department,
        assignedSlots: assigned,
        capacitySlots: capacity,
        sectionsCount: sectionsByTeacher.get(t.id)?.size ?? 0,
        utilizationPct: capacity > 0 ? Math.round((assigned / capacity) * 100) : 0,
      };
    });
  }

  /* ─────────────────── Smart allot ─────────────────── */

  /** PHP: tt_auto_allot / tt_auto_allot_all — entry point for the
   *  Smart Allot modal. */
  async smartAllot(input: SmartAllotInput): Promise<SmartAllotResult> {
    const session = await this.sessions.current();

    if (input.scope === "all") {
      return this.smartAllotAll(session.code, input.clearFirst);
    }
    return this.smartAllotSection(session.code, input.classSlug!, input.sectionCode!, input.clearFirst);
  }

  /** PHP: tt_auto_allot_all — every real section, in class order.
   *  Sections come from the union of (sections table) ∪ (active students'
   *  section codes), matching the PHP source. */
  private async smartAllotAll(sessionCode: string, clearFirst: boolean): Promise<SmartAllotResult> {
    // (a) sections table — explicit definitions
    const fromSections = await this.prisma.db.sections.findMany({
      select: { code: true, classes: { select: { slug: true, sort_order: true } } },
    });
    // (b) student-derived — catches sections (e.g. hostel D/E) that exist in
    //     students even when the sections master is stale.
    const fromStudents = await this.prisma.db.student.findMany({
      where: { status: "active", section: { not: "" } },
      select: { class: true, section: true },
      distinct: ["class", "section"],
    });

    type SectionRow = { classSlug: string; sectionCode: string; sortOrder: number };
    const seen = new Set<string>();
    const rows: SectionRow[] = [];
    for (const s of fromSections) {
      const key = `${s.classes.slug}|${s.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ classSlug: s.classes.slug, sectionCode: s.code, sortOrder: s.classes.sort_order });
    }
    // Build a classSlug→sortOrder map for student-derived sections.
    const classes = await this.prisma.db.classes.findMany({ select: { slug: true, sort_order: true } });
    const sortMap = new Map(classes.map((c) => [c.slug, c.sort_order]));
    for (const s of fromStudents) {
      if (!s.section) continue;
      const key = `${s.class}|${s.section}`;
      if (seen.has(key)) continue;
      const sort = sortMap.get(s.class);
      if (sort === undefined) continue; // unknown class
      seen.add(key);
      rows.push({ classSlug: s.class, sectionCode: s.section, sortOrder: sort });
    }
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.sectionCode.localeCompare(b.sectionCode));

    // Wipe globally once if requested (so per-section runs don't see stale conflicts).
    if (clearFirst) {
      await this.prisma.db.timetable_entries.deleteMany({ where: { session_code: sessionCode } });
    }

    let sections = 0, filled = 0, unassigned = 0, skipped = 0;
    for (const r of rows) {
      const res = await this.smartAllotSection(sessionCode, r.classSlug, r.sectionCode, false);
      if (res.ok) {
        sections++;
        filled += res.filled ?? 0;
        unassigned += res.unassigned ?? 0;
      } else {
        skipped++;
      }
    }
    return { ok: true, sections, filled, unassigned, skipped };
  }

  /** PHP: tt_auto_allot — see PHP source for the algorithm. Mirror, not
   *  reinvent — every numbered step in the PHP comment block has a 1:1
   *  translation below. */
  private async smartAllotSection(
    sessionCode: string, classSlug: string, sectionCode: string, clearFirst: boolean,
  ): Promise<SmartAllotResult> {
    const allPeriods = await this.prisma.db.timetable_periods.findMany({
      where: { session_code: sessionCode },
      orderBy: [{ sort_order: "asc" }, { period_no: "asc" }],
    });
    const teaching = allPeriods.filter((p) => !p.is_break);
    if (teaching.length === 0) {
      return { ok: false, msg: "No teaching periods defined. Set up periods first." };
    }

    const subjects = await this.subjectsForClass(classSlug);
    if (subjects.length === 0) {
      return { ok: false, msg: "No subjects mapped for this class." };
    }

    if (clearFirst) {
      await this.prisma.db.timetable_entries.deleteMany({
        where: { session_code: sessionCode, class_slug: classSlug, section_code: sectionCode },
      });
    }

    // Existing grid for "skip-if-already-filled" logic.
    const existingRows = await this.prisma.db.timetable_entries.findMany({
      where: { session_code: sessionCode, class_slug: classSlug, section_code: sectionCode },
    });
    const existing = new Map<string, typeof existingRows[number]>();
    for (const r of existingRows) existing.set(`${r.day_of_week}|${r.period_id}`, r);

    // Global teacher-busy set seeded from EVERY session cell (both columns).
    const busy = new Set<string>();
    const allCells = await this.prisma.db.timetable_entries.findMany({
      where: {
        session_code: sessionCode,
        OR: [{ teacher_user_id: { not: null } }, { teacher_user_id2: { not: null } }],
      },
      select: { teacher_user_id: true, teacher_user_id2: true, day_of_week: true, period_id: true },
    });
    for (const r of allCells) {
      if (r.teacher_user_id) busy.add(`${r.teacher_user_id}|${r.day_of_week}|${r.period_id}`);
      if (r.teacher_user_id2) busy.add(`${r.teacher_user_id2}|${r.day_of_week}|${r.period_id}`);
    }

    // Band-aware eligibility + specialists subset.
    const teachers = await this.teacherRoster();
    const desigById = new Map<number, string>();
    for (const t of teachers) desigById.set(t.id, (t.designation ?? "").toLowerCase());

    const eligible = await this.eligibleTeachersForClass(classSlug);
    const eligibleMap = new Map<number, number[]>();
    for (const [sid, ids] of Object.entries(eligible.bySubject)) eligibleMap.set(Number(sid), ids);

    const specInband = new Map<number, number[]>();
    for (const sub of subjects) {
      const specs = (eligibleMap.get(sub.id) ?? []).filter((tid) =>
        designationMatchesSubject(desigById.get(tid) ?? "", sub.shortCode, sub.name),
      );
      specInband.set(sub.id, specs);
    }

    // Section's own class teacher (primary fill for pre-primary/primary).
    const sectionRow = await this.prisma.db.sections.findFirst({
      where: { code: sectionCode, classes: { slug: classSlug } },
      select: { teacher_user_id: true },
    });
    const sectionTeacher: number | null = sectionRow?.teacher_user_id ?? null;

    // Load counter seeded from session-wide assignments (so "allot all"
    // rotates subject teachers across sections).
    const load = new Map<number, number>();
    const loadRows = await this.prisma.db.timetable_entries.groupBy({
      by: ["teacher_user_id"],
      where: { session_code: sessionCode, teacher_user_id: { not: null } },
      _count: { _all: true },
    });
    for (const r of loadRows) {
      if (r.teacher_user_id) load.set(r.teacher_user_id, r._count._all);
    }

    // Sr-secondary classes get double-period blocks (except ENG / GME / PE).
    const isDouble = classBand(classSlug) === "sr-secondary";

    // Runs of consecutive non-break periods (a break splits a run).
    const runs: number[][] = [];
    let cur: number[] = [];
    for (const p of allPeriods) {
      if (p.is_break) { if (cur.length) { runs.push(cur); cur = []; } continue; }
      cur.push(p.id);
    }
    if (cur.length) runs.push(cur);

    const singleCodes = new Set(["ENG", "GME", "GAMES", "PE"]);
    const isSingle = new Map<number, boolean>();
    for (const sub of subjects) {
      const code = (sub.shortCode ?? "").toUpperCase();
      isSingle.set(sub.id, isDouble ? singleCodes.has(code) : true);
    }

    // Parallel elective (sr-secondary): Maths || Biology.
    let parPrimary: number | null = null;
    let parSecondary: number | null = null;
    if (isDouble) {
      const byCode = new Map<string, number>();
      for (const sub of subjects) byCode.set((sub.shortCode ?? "").toUpperCase(), sub.id);
      if (byCode.has("MAT") && byCode.has("BIO")) {
        parPrimary = byCode.get("MAT")!;
        parSecondary = byCode.get("BIO")!;
      }
    }
    const planSubjects = parSecondary
      ? subjects.filter((s) => s.id !== parSecondary)
      : subjects;

    const cellsPerDay = runs.reduce((sum, r) => sum + r.length, 0);
    const totalCells = cellsPerDay * DAYS.length;
    if (totalCells === 0) return { ok: true, filled: 0, unassigned: 0, msg: "No teaching periods." };

    // Even quota across plan subjects, remainder to the first.
    const ns = Math.max(1, planSubjects.length);
    const base = Math.floor(totalCells / ns);
    const rem = totalCells % ns;
    const periodQuota = new Map<number, number>();
    planSubjects.forEach((sub, i) => periodQuota.set(sub.id, base + (i < rem ? 1 : 0)));

    // Convert quotas into block sizes (2 for double subjects, 1 for single).
    const blocksBySub = new Map<number, number[]>();
    for (const sub of planSubjects) {
      const q = periodQuota.get(sub.id) ?? 0;
      if (isSingle.get(sub.id)) {
        blocksBySub.set(sub.id, Array.from({ length: q }, () => 1));
      } else {
        const pairs = Math.floor(q / 2);
        const odd = q % 2;
        const blocks = Array.from({ length: pairs }, () => 2);
        if (odd) blocks.push(1);
        blocksBySub.set(sub.id, blocks);
      }
    }

    // Round-robin interleave → block queue [{sub, size}, …].
    type Block = { sub: number; size: number };
    let blockQueue: Block[] = [];
    const bidx = new Map<number, number>();
    for (const sub of planSubjects) bidx.set(sub.id, 0);
    let more = true;
    while (more) {
      more = false;
      for (const sub of planSubjects) {
        const i = bidx.get(sub.id)!;
        const blocks = blocksBySub.get(sub.id)!;
        if (i < blocks.length) {
          blockQueue.push({ sub: sub.id, size: blocks[i]! });
          bidx.set(sub.id, i + 1);
          more = true;
        }
      }
    }

    // Stagger per section so A/B/C don't all demand the same teacher.
    if (blockQueue.length > 0) {
      const first = sectionCode[0] ?? "";
      const secIdx = /^[A-Za-z]$/.test(first)
        ? first.toUpperCase().charCodeAt(0) - 65
        : Math.abs(hashStr(sectionCode)) % Math.max(1, ns);
      const shift = secIdx % blockQueue.length;
      if (shift > 0) blockQueue = [...blockQueue.slice(shift), ...blockQueue.slice(0, shift)];
    }

    // Pick ONE subject teacher per section (rotates across sections via load).
    const leastGlobal = (ids: number[]): number | null => {
      let best: number | null = null;
      let bestLoad = Number.MAX_SAFE_INTEGER;
      const seen = new Set<number>();
      for (const tid of ids) {
        if (seen.has(tid)) continue;
        seen.add(tid);
        const l = load.get(tid) ?? 0;
        if (l < bestLoad) { bestLoad = l; best = tid; }
      }
      return best;
    };
    const subjectTeacher = new Map<number, number | null>();
    for (const sub of subjects) {
      const specs = specInband.get(sub.id) ?? [];
      if (specs.length > 0) subjectTeacher.set(sub.id, leastGlobal(specs));
      else if (sectionTeacher) subjectTeacher.set(sub.id, sectionTeacher);
      else subjectTeacher.set(sub.id, leastGlobal(eligibleMap.get(sub.id) ?? []));
    }

    // Teacher-free-across-whole-unit predicate.
    const freeAll = (tid: number | null, day: number, pids: number[]): boolean => {
      if (tid === null) return false;
      for (const pid of pids) if (busy.has(`${tid}|${day}|${pid}`)) return false;
      return true;
    };
    const pickLeastUnit = (ids: number[], day: number, pids: number[]): number | null => {
      let best: number | null = null;
      let bestLoad = Number.MAX_SAFE_INTEGER;
      const seen = new Set<number>();
      for (const tid of ids) {
        if (seen.has(tid)) continue;
        seen.add(tid);
        if (!freeAll(tid, day, pids)) continue;
        const l = load.get(tid) ?? 0;
        if (l < bestLoad) { bestLoad = l; best = tid; }
      }
      return best;
    };

    // Greedy placement, day-major, run-by-run.
    //
    // PERF NOTE: writes are collected into `pendingUpdates` / `pendingCreates`
    // and flushed in a single transaction at the end. The old code awaited
    // each cell write individually, which for "all sections" scope (60+
    // sections × 8 periods × 6 days ≈ 3000 writes) took longer than the
    // browser HTTP timeout — the user saw "Generating…" forever even though
    // the server eventually finished, and only saw the data after a reload.
    let filled = 0;
    let unassigned = 0;
    let bi = 0;

    type CellData = {
      subject_id: number;
      teacher_user_id: number | null;
      subject_id2: number | null;
      teacher_user_id2: number | null;
    };
    const pendingUpdates: { id: number; data: CellData }[] = [];
    const pendingCreates: (CellData & {
      session_code: string; class_slug: string; section_code: string;
      day_of_week: number; period_id: number;
    })[] = [];

    for (const d of DAYS) {
      for (const run of runs) {
        const rl = run.length;
        let pos = 0;
        while (pos < rl && bi < blockQueue.length) {
          const size = blockQueue[bi]!.size;
          // Won't fit — try to pull a smaller block forward.
          if (pos + size > rl) {
            let swap = -1;
            for (let j = bi + 1; j < blockQueue.length; j++) {
              if (blockQueue[j]!.size <= rl - pos) { swap = j; break; }
            }
            if (swap >= 0) {
              const [b] = blockQueue.splice(swap, 1);
              blockQueue.splice(bi, 0, b!);
              continue;   // re-evaluate at $bi
            }
            break;        // nothing fits — leave the tail empty
          }

          const pids = run.slice(pos, pos + size);
          let allEmpty = true;
          for (const pid of pids) {
            const e = existing.get(`${d}|${pid}`);
            if (e && (e.subject_id != null || e.teacher_user_id != null)) { allEmpty = false; break; }
          }

          if (allEmpty) {
            const subId = blockQueue[bi]!.sub;
            const primaryTeacher = subjectTeacher.get(subId) ?? null;
            let pick: number | null = null;
            if (freeAll(primaryTeacher, d, pids)) {
              pick = primaryTeacher;
            } else {
              pick = pickLeastUnit(specInband.get(subId) ?? [], d, pids);
              if (pick === null && freeAll(sectionTeacher, d, pids)) pick = sectionTeacher;
              if (pick === null) pick = pickLeastUnit(eligibleMap.get(subId) ?? [], d, pids);
            }

            let sub2: number | null = null;
            let pick2: number | null = null;
            if (parSecondary && subId === parPrimary) {
              sub2 = parSecondary;
              const cand2 = subjectTeacher.get(parSecondary) ?? null;
              if (freeAll(cand2, d, pids)) pick2 = cand2;
              else {
                pick2 = pickLeastUnit(specInband.get(parSecondary) ?? [], d, pids);
                if (pick2 === null) pick2 = pickLeastUnit(eligibleMap.get(parSecondary) ?? [], d, pids);
              }
            }

            for (const pid of pids) {
              if (pick !== null) {
                busy.add(`${pick}|${d}|${pid}`);
                load.set(pick, (load.get(pick) ?? 0) + 1);
              } else {
                unassigned++;
              }
              if (pick2 !== null) {
                busy.add(`${pick2}|${d}|${pid}`);
                load.set(pick2, (load.get(pick2) ?? 0) + 1);
              }
              const data: CellData = {
                subject_id: subId,
                teacher_user_id: pick ?? null,
                subject_id2: sub2,
                teacher_user_id2: pick2,
              };
              const ex = existing.get(`${d}|${pid}`);
              if (ex) {
                pendingUpdates.push({ id: ex.id, data });
              } else {
                pendingCreates.push({
                  session_code: sessionCode,
                  class_slug: classSlug,
                  section_code: sectionCode,
                  day_of_week: d,
                  period_id: pid,
                  ...data,
                });
              }
              filled++;
            }
          }
          pos += size;
          bi++;
        }
      }
    }

    // Flush all writes in a single transaction. Bulk-create first
    // (createMany is one round-trip), then run the updates in parallel
    // (Prisma will pipeline them on the same connection).
    if (pendingCreates.length > 0) {
      await this.prisma.db.timetable_entries.createMany({ data: pendingCreates });
    }
    if (pendingUpdates.length > 0) {
      await this.prisma.db.$transaction(
        pendingUpdates.map((u) =>
          this.prisma.db.timetable_entries.update({ where: { id: u.id }, data: u.data }),
        ),
      );
    }

    if (filled === 0) return { ok: true, filled: 0, unassigned: 0, msg: "All slots already filled." };
    return { ok: true, filled, unassigned };
  }

  /* ─────────────────── Internal helpers ─────────────────── */

  /** PHP: tt_subjects_for_class — mapped subjects (falls back to all). */
  private async subjectsForClass(classSlug: string): Promise<{ id: number; name: string; shortCode: string }[]> {
    const mapped = await this.prisma.db.exam_class_subjects.findMany({
      where: { class_slug: classSlug },
      orderBy: [{ sort_order: "asc" }, { id: "asc" }],
      include: { exam_subjects: true },
    });
    if (mapped.length > 0) {
      return mapped.map((m) => ({
        id: m.exam_subjects.id,
        name: m.exam_subjects.name,
        shortCode: m.exam_subjects.short_code,
      }));
    }
    const all = await this.prisma.db.exam_subjects.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
    return all.map((s) => ({ id: s.id, name: s.name, shortCode: s.short_code }));
  }

  /** PHP: tt_teachers — active staff with a teach-capable role. */
  private async teacherRoster(): Promise<{ id: number; name: string; designation: string | null; department: string | null }[]> {
    const rows = await this.prisma.db.user.findMany({
      where: {
        status: "active",
        role: { slug: { in: ["teacher", "principal", "hr", "admin"] } },
      },
      select: { id: true, name: true, designation: true, department: true },
      orderBy: { name: "asc" },
    });
    return rows;
  }
}

/* ============================================================
   Pure helpers — PHP-equivalent.
   ============================================================ */

/** PHP: tt_class_band */
function classBand(slug: string): string {
  const s = slug.toLowerCase().trim();
  if (["nursery", "lkg", "ukg"].includes(s)) return "pre-primary";
  if (["1st", "2nd", "3rd", "4th", "5th"].includes(s)) return "primary";
  if (["6th", "7th", "8th"].includes(s)) return "middle";
  if (["9th", "10th"].includes(s)) return "senior";
  if (["11th", "12th"].includes(s)) return "sr-secondary";
  return "";
}

/** PHP: tt_dept_band */
function deptBand(dept: string | null | undefined): string {
  const d = (dept ?? "").toLowerCase();
  if (d === "") return "";
  if (d.includes("pre-primary") || d.includes("pre primary")) return "pre-primary";
  if (d.includes("11-12") || d.includes("sr. secondary") || d.includes("sr secondary")) return "sr-secondary";
  if (d.includes("9-10")) return "senior";
  if (d.includes("6-8") || d.includes("middle")) return "middle";
  if (d.includes("primary")) return "primary";
  return "";
}

/** PHP: tt_designation_matches_subject */
function designationMatchesSubject(desigLower: string, shortCode: string, subjectName: string): boolean {
  const code = shortCode.toUpperCase();
  // SCI guarded against "social science".
  if (code === "SCI" && desigLower.includes("social")) return false;
  const map: Record<string, string[]> = {
    ENG: ["english"],
    HIN: ["hindi"],
    SKT: ["sanskrit"],
    MAT: ["math"],
    EVS: ["evs", "environ"],
    SCI: ["science"],
    SST: ["social"],
    PHY: ["physics"],
    CHE: ["chemistr"],
    BIO: ["biolog"],
    CSC: ["computer"],
    GK: ["general knowledge"],
    ART: ["art"],
    DRW: ["draw"],
  };
  const kws = map[code] ?? [subjectName.toLowerCase()];
  for (const kw of kws) {
    if (kw !== "" && desigLower.includes(kw)) return true;
  }
  return false;
}

function timeStr(t: Date): string {
  return t.toISOString().slice(11, 19); // 'HH:MM:SS'
}
function normaliseTime(s: string): string {
  return s.length === 5 ? `${s}:00` : s;
}
/** PHP's crc32() approximation for the stagger fallback. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
