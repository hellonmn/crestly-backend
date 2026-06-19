import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { AcademicSession, AcademicSessionUpsert } from "@crestly/shared";

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async list(): Promise<AcademicSession[]> {
    const rows = await this.prisma.db.session.findMany({
      orderBy: { code: "desc" },
    });
    return rows.map(toDto);
  }

  async current(): Promise<AcademicSession> {
    const row = await this.prisma.db.session.findFirst({
      where: { isCurrent: true },
    });
    if (!row) throw new NotFoundException("No current academic session is set");
    return toDto(row);
  }

  async findOne(code: string): Promise<AcademicSession> {
    const row = await this.prisma.db.session.findUnique({ where: { code } });
    if (!row) throw new NotFoundException(`Session '${code}' not found`);
    return toDto(row);
  }

  async create(input: AcademicSessionUpsert): Promise<AcademicSession> {
    const exists = await this.prisma.db.session.findUnique({ where: { code: input.code } });
    if (exists) throw new ConflictException(`Session '${input.code}' already exists`);
    const row = await this.prisma.db.session.create({
      data: {
        code: input.code,
        label: input.label,
        startedAt: new Date(input.startedAt),
        endedAt: new Date(input.endedAt),
      },
    });
    return toDto(row);
  }

  async update(code: string, input: AcademicSessionUpsert): Promise<AcademicSession> {
    await this.findOne(code);
    const data: Prisma.SessionUpdateInput = {
      label: input.label,
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
    };
    const row = await this.prisma.db.session.update({ where: { code }, data });
    return toDto(row);
  }

  /**
   * Flip is_current to `code`. Mirrors `promotion/index.php`'s "Switch session"
   * step: there's exactly one current session at a time.
   */
  async setCurrent(code: string): Promise<AcademicSession> {
    await this.findOne(code);
    await this.prisma.db.$transaction([
      this.prisma.db.session.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.db.session.update({
        where: { code },
        data: { isCurrent: true },
      }),
    ]);
    return this.findOne(code);
  }
}

type SessionRow = Prisma.SessionGetPayload<Record<string, never>>;

function toDto(r: SessionRow): AcademicSession {
  return {
    code: r.code,
    label: r.label,
    isCurrent: Boolean(r.isCurrent),
    startedAt: r.startedAt.toISOString().slice(0, 10),
    endedAt: r.endedAt.toISOString().slice(0, 10),
    promotedFrom: r.promotedFrom ?? null,
    promotedAt: r.promotedAt ? r.promotedAt.toISOString() : null,
  };
}
