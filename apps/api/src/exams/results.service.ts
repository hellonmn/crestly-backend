import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import { SessionsService } from "../sessions/sessions.service";
import type { ResultsQuery, ResultsResponse, ResultRow } from "@crestly/shared";

/**
 * Rank list + grade distribution for a section.
 *  - `termId` set      → just that term.
 *  - `termId` omitted  → weighted aggregate across every term in the current
 *                        session (weights from exam_terms.weight_percent).
 */
@Injectable()
export class ExamResultsService {
  constructor(
    private readonly prisma: RequestPrismaService,
    private readonly sessions: SessionsService,
  ) {}

  async results(query: ResultsQuery): Promise<ResultsResponse> {
    const session = await this.sessions.current();

    const students = await this.prisma.db.student.findMany({
      where: { class: query.class, section: query.section, status: "active" },
      select: { srNumber: true, studentName: true },
      orderBy: { studentName: "asc" },
    });
    const srNumbers = students.map((s) => s.srNumber);

    let scopeTermName: string | null = null;
    let termIds: number[] = [];

    if (query.termId) {
      const term = await this.prisma.db.exam_terms.findUnique({ where: { id: query.termId } });
      if (!term) throw new NotFoundException();
      scopeTermName = term.name;
      termIds = [term.id];
    } else {
      const terms = await this.prisma.db.exam_terms.findMany({
        where: { session_code: session.code },
        orderBy: { sort_order: "asc" },
      });
      termIds = terms.map((t) => t.id);
    }

    if (termIds.length === 0 || srNumbers.length === 0) {
      return {
        scope: query.termId ? "term" : "session",
        termId: query.termId ?? null,
        termName: scopeTermName,
        class: query.class,
        section: query.section,
        passed: 0, failed: 0, classAverage: 0, topper: null,
        gradeDistribution: {},
        rows: [],
      };
    }

    const marks = await this.prisma.db.exam_marks.findMany({
      where: { term_id: { in: termIds }, sr_number: { in: srNumbers } },
    });

    // Per student aggregate. For session-aggregate we collapse per-term first,
    // then apply each term's weight.
    const termById = new Map(
      (await this.prisma.db.exam_terms.findMany({ where: { id: { in: termIds } } })).map((t) => [t.id, t]),
    );

    const rows: ResultRow[] = students.map((stu) => {
      let totalObt = 0;
      let totalMax = 0;
      let everyTermHasMarks = true;

      for (const termId of termIds) {
        const term = termById.get(termId)!;
        const termMarks = marks.filter((m) => m.term_id === termId && m.sr_number === stu.srNumber);
        if (termMarks.length === 0) {
          everyTermHasMarks = false;
          continue;
        }
        const obt = termMarks.reduce((s, m) => s + Number(m.marks_obtained ?? 0), 0);
        const max = termMarks.length * term.default_max_marks;

        if (query.termId) {
          // Single-term mode: raw obt/max.
          totalObt = obt;
          totalMax = max;
        } else {
          // Aggregate: scale to weight_percent.
          const w = Number(term.weight_percent) || 0;
          if (max > 0) {
            totalObt += (obt / max) * w;
            totalMax += w;
          }
        }
      }

      const pct = totalMax > 0 ? (totalObt / totalMax) * (query.termId ? 100 : 1) : 0;
      const finalPct = query.termId ? pct : totalObt; // already scaled
      return {
        rank: 0,                  // assigned after sort
        srNumber: stu.srNumber,
        studentName: stu.studentName,
        totalObtained: Math.round(totalObt * 100) / 100,
        totalMax: Math.round(totalMax * 100) / 100,
        percentage: Math.round(finalPct * 100) / 100,
        grade: gradeFor(finalPct),
        passFail: everyTermHasMarks && finalPct >= 33 ? "PASS" : "FAIL",
      };
    });

    rows.sort((a, b) => b.percentage - a.percentage);
    rows.forEach((r, i) => (r.rank = i + 1));

    const passed = rows.filter((r) => r.passFail === "PASS").length;
    const failed = rows.length - passed;
    const classAverage = rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + r.percentage, 0) / rows.length) * 100) / 100
      : 0;
    const topper = rows[0] ? { srNumber: rows[0].srNumber, studentName: rows[0].studentName, percentage: rows[0].percentage } : null;

    const gradeDistribution: Record<string, number> = {};
    for (const r of rows) gradeDistribution[r.grade] = (gradeDistribution[r.grade] ?? 0) + 1;

    return {
      scope: query.termId ? "term" : "session",
      termId: query.termId ?? null,
      termName: scopeTermName,
      class: query.class,
      section: query.section,
      passed, failed, classAverage, topper, gradeDistribution, rows,
    };
  }
}

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
