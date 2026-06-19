import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import { SchoolInfoService } from "../school-info/school-info.service";
import type { Marksheet, MarksheetQuery, MarksheetSubjectRow, MarksheetCoRow } from "@crestly/shared";

/**
 * Single-student marksheet aggregate — ports erp/lib/exams.php :: exam_build_marksheet().
 *
 * Key rules (per PHP source):
 *  - Pass/fail decided strictly by the "decision" term: Annual (slug='annual')
 *    if present in the session, else the last term by sort_order. In single-
 *    term view the chosen term is the decision term.
 *  - A subject fails if the student is absent in the decision-term paper OR
 *    `marks_obtained < pass_marks`. Pass-marks default to `floor(max * 0.33)`.
 *  - Weighted % per subject = Σ((obtained/max) × weight_seen) / Σ(weight_seen).
 *  - Overall % = simple average of per-subject weighted %s.
 *  - Promotion map kicks in only when the annual term is involved.
 */
@Injectable()
export class ExamMarksheetService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
    private readonly schoolInfo: SchoolInfoService,
  ) {}

  async build(sr: number, query: MarksheetQuery): Promise<Marksheet> {
    const sessionCode = query.sessionCode ?? (await this.sessions.current()).code;
    const session = await this.sessions.findOne(sessionCode);

    const student = await this.prisma.db.student.findUnique({ where: { srNumber: sr } });
    if (!student) throw new NotFoundException(`Student #${sr} not found`);

    // --- Terms in this session (optionally filter to a single term) ---
    let terms = await this.prisma.db.exam_terms.findMany({
      where: { session_code: sessionCode },
      orderBy: { sort_order: "asc" },
    });
    if (query.termId) {
      terms = terms.filter((t) => t.id === query.termId);
      if (terms.length === 0) {
        throw new NotFoundException(`Term #${query.termId} not in session ${sessionCode}`);
      }
    }
    if (terms.length === 0) throw new NotFoundException(`No terms configured for session ${sessionCode}`);

    // --- Subjects assigned to this student's class ---
    const subjectsRaw = await this.prisma.db.exam_subjects.findMany({
      where: { exam_class_subjects: { some: { class_slug: student.class } } },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });
    if (subjectsRaw.length === 0) {
      throw new NotFoundException(`No subjects configured for class ${student.class}`);
    }

    // --- Co-scholastic areas (catalog) ---
    const coAreas = await this.prisma.db.exam_co_areas.findMany({
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    });

    const termIds = terms.map((t) => t.id);

    // --- Datesheet rows → maxmap[subject_id][term_id] = { max, pass } ---
    const datesheetRows = await this.prisma.db.exam_datesheet.findMany({
      where: { class_slug: student.class, term_id: { in: termIds } },
    });
    const maxmap = new Map<number, Map<number, { max: number; pass: number }>>();
    for (const r of datesheetRows) {
      if (!maxmap.has(r.subject_id)) maxmap.set(r.subject_id, new Map());
      maxmap.get(r.subject_id)!.set(r.term_id, { max: r.max_marks, pass: r.pass_marks });
    }

    // --- Marks for this student in this session ---
    const markRows = await this.prisma.db.exam_marks.findMany({
      where: { sr_number: sr, term_id: { in: termIds } },
    });
    const marks = new Map<number, Map<number, { obtained: number | null; isAbsent: boolean }>>();
    for (const r of markRows) {
      if (!marks.has(r.subject_id)) marks.set(r.subject_id, new Map());
      marks.get(r.subject_id)!.set(r.term_id, {
        obtained: r.marks_obtained !== null ? Number(r.marks_obtained) : null,
        isAbsent: Boolean(r.is_absent),
      });
    }

    // --- Co-scholastic grades for this student ---
    const coRows = await this.prisma.db.exam_co_grades.findMany({
      where: { sr_number: sr, term_id: { in: termIds } },
    });
    const coGrades = new Map<number, Map<number, "A" | "B" | "C">>();
    for (const r of coRows) {
      if (!coGrades.has(r.area_id)) coGrades.set(r.area_id, new Map());
      coGrades.get(r.area_id)!.set(r.term_id, r.grade as "A" | "B" | "C");
    }

    // --- Decision term (Annual if present else last term; in single-term mode → the chosen term) ---
    const isSingleTerm = Boolean(query.termId);
    const annualTerm = isSingleTerm
      ? terms[0]
      : (terms.find((t) => t.slug === "annual") ?? terms[terms.length - 1]);

    // --- Per-subject roll-up ---
    let hasFail = false;
    const subjectRows: MarksheetSubjectRow[] = subjectsRaw.map((sub) => {
      let wPct = 0;
      let wSeen = 0;
      let sumObt = 0;
      let sumMax = 0;
      const perTerm: Record<string, { obtained: number | null; max: number; isAbsent: boolean } | null> = {};

      for (const t of terms) {
        const tWeight = Number(t.weight_percent);
        const ds = maxmap.get(sub.id)?.get(t.id);
        const max = ds?.max ?? t.default_max_marks;
        const m = marks.get(sub.id)?.get(t.id);

        if (m) {
          const obt = m.isAbsent ? null : m.obtained;
          perTerm[String(t.id)] = { obtained: obt, max, isAbsent: m.isAbsent };
          sumMax += max;
          sumObt += obt ?? 0;
          if (obt !== null) {
            wPct += (obt / Math.max(1, max)) * tWeight;
            wSeen += tWeight;
          }
        } else {
          perTerm[String(t.id)] = null;
          sumMax += max;
        }
      }

      // Annual / decision-term pass-fail check
      let subjectFailed = false;
      let annualStatus: "pending" | "pass" | "fail" | "absent" = "pending";
      const aDs = maxmap.get(sub.id)?.get(annualTerm.id);
      const aMax = aDs?.max ?? annualTerm.default_max_marks;
      const aPass = aDs?.pass ?? Math.floor(aMax * 0.33);
      const aRow = marks.get(sub.id)?.get(annualTerm.id);
      if (aRow) {
        if (aRow.isAbsent) {
          subjectFailed = true;
          annualStatus = "absent";
        } else if (aRow.obtained !== null) {
          if (aRow.obtained < aPass) {
            subjectFailed = true;
            annualStatus = "fail";
          } else {
            annualStatus = "pass";
          }
        }
      }
      if (subjectFailed) hasFail = true;

      const weightedPercent = wSeen > 0 ? (wPct / wSeen) * 100 : 0;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        shortCode: sub.short_code,
        isLanguage: sub.is_language,
        perTerm,
        obtained: round2(sumObt),
        max: sumMax,
        weightedPercent: round2(weightedPercent),
        finalGrade: gradeFor(weightedPercent),
        failed: subjectFailed,
        annualStatus,
      };
    });

    // --- Co-scholastic rows ---
    const coScholastic: MarksheetCoRow[] = coAreas.map((a) => {
      const perTerm: Record<string, "A" | "B" | "C" | null> = {};
      for (const t of terms) perTerm[String(t.id)] = coGrades.get(a.id)?.get(t.id) ?? null;
      return {
        areaId: a.id,
        areaName: a.name,
        description: a.description ?? null,
        perTerm,
      };
    });

    // --- Overall: simple average of per-subject weighted % (matches PHP fallback) ---
    const overallPct =
      subjectRows.length > 0
        ? subjectRows.reduce((s, r) => s + r.weightedPercent, 0) / subjectRows.length
        : 0;

    // --- Rank within section (only meaningful for full-class scope) ---
    let rank: number | null = null;
    let classSize = 0;
    const peers = await this.prisma.db.student.findMany({
      where: { class: student.class, section: student.section, status: "active" },
      select: { srNumber: true },
    });
    classSize = peers.length;
    if (peers.length > 1) {
      // Cheap rank — bulk-load marks for all peers and compute weighted % per student.
      const peerSrs = peers.map((p) => p.srNumber);
      const peerMarks = await this.prisma.db.exam_marks.findMany({
        where: { sr_number: { in: peerSrs }, term_id: { in: termIds } },
      });
      const byPeer = new Map<number, typeof peerMarks>();
      for (const m of peerMarks) {
        const arr = byPeer.get(m.sr_number) ?? [];
        arr.push(m);
        byPeer.set(m.sr_number, arr);
      }
      const peerPct = peerSrs.map((s) => {
        let totObt = 0;
        let totW = 0;
        for (const t of terms) {
          const tWeight = Number(t.weight_percent);
          for (const sub of subjectsRaw) {
            const ds = maxmap.get(sub.id)?.get(t.id);
            const max = ds?.max ?? t.default_max_marks;
            const m = (byPeer.get(s) ?? []).find((x) => x.term_id === t.id && x.subject_id === sub.id);
            if (m && !m.is_absent && m.marks_obtained !== null) {
              totObt += (Number(m.marks_obtained) / Math.max(1, max)) * tWeight;
              totW += tWeight;
            }
          }
        }
        const pct = totW > 0 ? (totObt / totW) * 100 / Math.max(1, subjectsRaw.length) * subjectsRaw.length : 0;
        return { sr: s, pct };
      });
      peerPct.sort((a, b) => b.pct - a.pct);
      const myIdx = peerPct.findIndex((p) => p.sr === sr);
      rank = myIdx >= 0 ? myIdx + 1 : null;
    }

    // --- Promotion mapping ---
    const promotionMap: Record<string, string> = {
      Nursery: "LKG", LKG: "UKG", UKG: "1st",
      "1st": "2nd", "2nd": "3rd", "3rd": "4th", "4th": "5th",
      "5th": "6th", "6th": "7th", "7th": "8th", "8th": "9th",
      "9th": "10th", "10th": "11th", "11th": "12th",
    };
    const promotionMeaningful = !isSingleTerm || annualTerm.slug === "annual";
    const nextClass = promotionMeaningful ? (promotionMap[student.class] ?? null) : null;

    // --- School header info ---
    const info = await this.schoolInfo.getAll();
    const v = info.values;
    // Keys mirror erp/settings/index.php exactly so PHP-written rows are
    // read without any rewrite. See packages/shared/src/school-info.ts.
    const schoolName = v["School Name"] || "School";
    const schoolAddress = v["Address"] || null;
    const board = v["Board"] || null;
    const sessionLabel = session.label;

    return {
      student: {
        srNumber: student.srNumber,
        studentName: student.studentName,
        fatherName: student.fatherName ?? null,
        motherName: student.motherName ?? null,
        dob: student.dob ? student.dob.toISOString().slice(0, 10) : null,
        class: student.class,
        section: student.section,
        address: student.address ?? null,
      },
      session: sessionCode,
      terms: terms.map((t) => ({
        id: t.id,
        name: t.name,
        shortCode: t.short_code,
        weightPercent: Number(t.weight_percent),
        isFinalized: t.is_finalized,
      })),
      isSingleTerm,
      filterTerm: isSingleTerm
        ? { id: terms[0].id, name: terms[0].name, shortCode: terms[0].short_code }
        : null,
      annualTerm: annualTerm
        ? { id: annualTerm.id, name: annualTerm.name, shortCode: annualTerm.short_code }
        : null,
      subjects: subjectRows,
      coScholastic,
      overall: {
        obtained: round2(subjectRows.reduce((s, r) => s + r.obtained, 0)),
        max: subjectRows.reduce((s, r) => s + r.max, 0),
        percent: round2(overallPct),
        grade: gradeFor(overallPct),
        result: hasFail ? "FAIL" : "PASS",
        rank,
        classSize,
      },
      nextClass,
      school: {
        name: schoolName,
        address: schoolAddress,
        board,
        sessionLabel,
      },
    };
  }
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

function gradeFor(pct: number): string {
  if (pct >= 91) return "A+";
  if (pct >= 81) return "A";
  if (pct >= 71) return "B+";
  if (pct >= 61) return "B";
  if (pct >= 51) return "C+";
  if (pct >= 41) return "C";
  if (pct >= 33) return "D";
  return "F";
}
