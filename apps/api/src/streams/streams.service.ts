import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { StreamSummary, StreamSubject } from "@crestly/shared";

/**
 * Streams reference data (PCM / PCB / Commerce) for classes 11/12.
 *
 * - stream_subjects: which exam_subjects apply per stream
 * - sections matched by section.code starting with '11-' / '12-'
 * - students.stream column drives the per-stream roster
 *
 * Mirrors erp/streams.php.
 */
@Injectable()
export class StreamsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async summary(): Promise<StreamSummary[]> {
    const rows = await this.prisma.db.stream_subjects.findMany({
      include: { exam_subjects: { select: { name: true } } },
      orderBy: [{ stream: "asc" }, { sort_order: "asc" }],
    });

    const byStream = new Map<string, StreamSubject[]>();
    for (const r of rows) {
      const list = byStream.get(r.stream) ?? [];
      list.push({
        id: r.id,
        stream: r.stream,
        subjectId: r.subject_id,
        subjectName: r.exam_subjects.name,
        isOptional: Boolean(r.is_optional),
        sortOrder: r.sort_order,
      });
      byStream.set(r.stream, list);
    }

    // Student + section counts per stream from `students` table.
    const studentByStream = await this.prisma.db.student.groupBy({
      by: ["stream"],
      where: { status: "active", stream: { not: null } },
      _count: { _all: true },
    });
    const studentCounts = new Map<string, number>(
      studentByStream
        .filter((s): s is { stream: string; _count: { _all: number } } => s.stream != null)
        .map((s) => [s.stream, s._count._all]),
    );

    // Sections in classes 11/12 grouped by class+section. We don't know which
    // section maps to which stream without per-section metadata, so we just
    // count distinct sections that have any student in the stream.
    const sectionByStream = await this.prisma.db.student.groupBy({
      by: ["stream", "class", "section"],
      where: { status: "active", stream: { not: null } },
      _count: { _all: true },
    });
    const sectionCounts = new Map<string, number>();
    for (const r of sectionByStream) {
      if (!r.stream) continue;
      sectionCounts.set(r.stream, (sectionCounts.get(r.stream) ?? 0) + 1);
    }

    return Array.from(byStream.entries()).map(([stream, subjects]) => ({
      stream,
      subjects,
      sectionsCount: sectionCounts.get(stream) ?? 0,
      studentCount: studentCounts.get(stream) ?? 0,
    }));
  }

  async roster(stream: string) {
    return this.prisma.db.student.findMany({
      where: { stream, status: "active" },
      select: {
        srNumber: true,
        studentName: true,
        class: true,
        section: true,
        fatherName: true,
        gender: true,
      },
      orderBy: [{ class: "asc" }, { section: "asc" }, { studentName: "asc" }],
    });
  }
}
