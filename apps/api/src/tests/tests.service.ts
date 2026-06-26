import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  Test, TestListItem, TestListQuery, TestStatus, TestUpsert,
  TestResultsResponse,
} from "@crestly/shared";
import { toTestQuestionDto } from "./tests.grading";

/**
 * Teacher-facing online tests (MCQ + fill-in-the-blanks).
 *
 * Authoring + lifecycle (draft → published → closed) + results.
 * Students attempt published tests through the parent portal
 * (see ParentService.tests / testDetail / submitTest).
 */
@Injectable()
export class TestsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(query: TestListQuery): Promise<TestListItem[]> {
    const rows = await this.prisma.db.tests.findMany({
      where: {
        ...(query.sessionCode ? { session_code: query.sessionCode } : {}),
        ...(query.classSlug ? { class_slug: query.classSlug } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { id: "desc" },
      include: { _count: { select: { test_questions: true, test_attempts: true } } },
    });
    const subjMap = await this.subjectNames(rows.map((r) => r.subject_id));
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      classSlug: r.class_slug,
      sectionCode: r.section_code,
      subjectName: r.subject_id ? subjMap.get(r.subject_id) ?? null : null,
      status: r.status,
      totalMarks: r.total_marks,
      questionCount: r._count.test_questions,
      attemptCount: r._count.test_attempts,
      availableFrom: isoDateTime(r.available_from),
      availableTo: isoDateTime(r.available_to),
      createdAt: r.created_at ? r.created_at.toISOString() : null,
    }));
  }

  async findOne(id: number): Promise<Test> {
    const row = await this.prisma.db.tests.findUnique({
      where: { id },
      include: { test_questions: { orderBy: { sort_order: "asc" } } },
    });
    if (!row) throw new NotFoundException(`Test #${id} not found`);
    const subjectName = row.subject_id
      ? (await this.subjectNames([row.subject_id])).get(row.subject_id) ?? null
      : null;
    return {
      id: row.id,
      sessionCode: row.session_code,
      title: row.title,
      instructions: row.instructions,
      classSlug: row.class_slug,
      sectionCode: row.section_code,
      subjectId: row.subject_id,
      subjectName,
      status: row.status,
      durationMin: row.duration_min,
      availableFrom: isoDateTime(row.available_from),
      availableTo: isoDateTime(row.available_to),
      shuffle: Boolean(row.shuffle),
      totalMarks: row.total_marks,
      questionCount: row.test_questions.length,
      createdBy: row.created_by,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
      questions: row.test_questions.map(toTestQuestionDto),
    };
  }

  async create(input: TestUpsert, userId: number): Promise<Test> {
    const sessionCode = input.sessionCode ?? (await this.currentSessionCode());
    const totalMarks = input.questions.reduce((s, q) => s + q.marks, 0);
    const created = await this.prisma.db.tests.create({
      data: { ...testRow(input), session_code: sessionCode, total_marks: totalMarks, created_by: userId },
    });
    await this.prisma.db.test_questions.createMany({
      data: input.questions.map((q, i) => questionRow(q, created.id, i)),
    });
    return this.findOne(created.id);
  }

  async update(id: number, input: TestUpsert): Promise<Test> {
    const existing = await this.prisma.db.tests.findUnique({
      where: { id },
      include: { _count: { select: { test_attempts: true } } },
    });
    if (!existing) throw new NotFoundException(`Test #${id} not found`);
    // Questions can't change once students have attempted — answers reference them.
    if (existing._count.test_attempts > 0) {
      throw new ConflictException("Students have already attempted this test; questions can't be edited.");
    }
    const totalMarks = input.questions.reduce((s, q) => s + q.marks, 0);
    await this.prisma.db.$transaction([
      this.prisma.db.test_questions.deleteMany({ where: { test_id: id } }),
      this.prisma.db.tests.update({
        where: { id },
        data: { ...testRow(input), total_marks: totalMarks },
      }),
    ]);
    await this.prisma.db.test_questions.createMany({
      data: input.questions.map((q, i) => questionRow(q, id, i)),
    });
    return this.findOne(id);
  }

  async setStatus(id: number, status: TestStatus): Promise<Test> {
    const row = await this.prisma.db.tests.findUnique({
      where: { id },
      include: { _count: { select: { test_questions: true } } },
    });
    if (!row) throw new NotFoundException(`Test #${id} not found`);
    if (status === "published" && row._count.test_questions === 0) {
      throw new BadRequestException("Add at least one question before publishing.");
    }
    await this.prisma.db.tests.update({ where: { id }, data: { status } });
    return this.findOne(id);
  }

  async remove(id: number): Promise<{ ok: true }> {
    const row = await this.prisma.db.tests.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Test #${id} not found`);
    // test_questions / test_attempts / answers cascade via FK.
    await this.prisma.db.tests.delete({ where: { id } });
    return { ok: true };
  }

  async results(id: number): Promise<TestResultsResponse> {
    const test = await this.prisma.db.tests.findUnique({ where: { id } });
    if (!test) throw new NotFoundException(`Test #${id} not found`);
    const attempts = await this.prisma.db.test_attempts.findMany({
      where: { test_id: id },
      orderBy: [{ score: "desc" }, { submitted_at: "asc" }],
    });
    const srs = attempts.map((a) => a.sr_number);
    const students = srs.length
      ? await this.prisma.db.student.findMany({
          where: { srNumber: { in: srs } },
          select: { srNumber: true, studentName: true, class: true, section: true },
        })
      : [];
    const sMap = new Map(students.map((s) => [s.srNumber, s]));

    const submitted = attempts.filter((a) => a.status === "submitted" && a.score != null);
    const averagePct =
      submitted.length && test.total_marks > 0
        ? round1((submitted.reduce((s, a) => s + (a.score ?? 0), 0) / (submitted.length * test.total_marks)) * 100)
        : null;

    return {
      testId: id,
      title: test.title,
      totalMarks: test.total_marks,
      averagePct,
      attempts: attempts.map((a) => {
        const st = sMap.get(a.sr_number);
        return {
          attemptId: a.id,
          srNumber: a.sr_number,
          studentName: st?.studentName ?? `SR ${a.sr_number}`,
          classLabel: st ? `${st.class}-${st.section}` : "",
          score: a.score,
          maxScore: a.max_score,
          status: a.status,
          submittedAt: a.submitted_at ? a.submitted_at.toISOString() : null,
        };
      }),
    };
  }

  /* ─────────────────── internals ─────────────────── */

  private async subjectNames(ids: (number | null)[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids.filter((x): x is number => x != null))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.db.exam_subjects.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private async currentSessionCode(): Promise<string> {
    const row = await this.prisma.db.session.findFirst({ where: { isCurrent: true } });
    if (!row) throw new NotFoundException("No current academic session is set");
    return row.code;
  }
}

/* ─────────────────── row builders ─────────────────── */

function testRow(input: TestUpsert) {
  return {
    title: input.title,
    instructions: input.instructions ?? null,
    class_slug: input.classSlug,
    section_code: input.sectionCode ?? null,
    subject_id: input.subjectId ?? null,
    duration_min: input.durationMin ?? null,
    available_from: input.availableFrom ? new Date(input.availableFrom) : null,
    available_to: input.availableTo ? new Date(input.availableTo) : null,
    shuffle: input.shuffle,
  } satisfies Partial<Prisma.testsUncheckedCreateInput>;
}

function questionRow(
  q: TestUpsert["questions"][number],
  testId: number,
  sortOrder: number,
): Prisma.test_questionsCreateManyInput {
  const isMcq = q.type === "mcq";
  return {
    test_id: testId,
    q_type: q.type,
    prompt: q.prompt,
    marks: q.marks,
    sort_order: sortOrder,
    options_json: isMcq ? JSON.stringify(q.options ?? []) : null,
    answer_json: JSON.stringify(isMcq ? q.correctOptions ?? [] : q.acceptedAnswers ?? []),
    case_sensitive: q.caseSensitive,
  };
}

function isoDateTime(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
