import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  CalendarEvent,
  CalendarEventUpsert,
  CalendarFeedQuery,
  CalendarFeedResponse,
} from "@crestly/shared";
import { buildCalendarFeed, resolveRange } from "./calendar.feed";

/**
 * Staff-facing school calendar.
 *
 * CRUD lives on the new `calendar_events` table. The read feed
 * (`feed`) delegates to the shared builder, which merges events with
 * holidays + exam datesheets. Parents read the same feed through the
 * parent portal (scoped to parent-visible audiences).
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async feed(query: CalendarFeedQuery): Promise<CalendarFeedResponse> {
    const { from, to } = resolveRange(query);
    return buildCalendarFeed(this.prisma.db, {
      from,
      to,
      sessionCode: query.sessionCode,
      classSlug: query.classSlug,
      includeHolidays: query.includeHolidays ?? true,
      includeExams: query.includeExams ?? true,
    });
  }

  /** Raw event rows (no holiday/exam merge) — for the admin manage view. */
  async listEvents(sessionCode?: string): Promise<CalendarEvent[]> {
    const code = sessionCode ?? (await this.currentSessionCode());
    const rows = await this.prisma.db.calendar_events.findMany({
      where: { session_code: code },
      orderBy: [{ start_date: "asc" }, { start_time: "asc" }],
    });
    return rows.map(toDto);
  }

  async findEvent(id: number): Promise<CalendarEvent> {
    const row = await this.prisma.db.calendar_events.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Calendar event #${id} not found`);
    return toDto(row);
  }

  async createEvent(input: CalendarEventUpsert, userId: number): Promise<CalendarEvent> {
    const sessionCode = input.sessionCode ?? (await this.currentSessionCode());
    const created = await this.prisma.db.calendar_events.create({
      data: { ...toRow(input), session_code: sessionCode, created_by: userId },
    });
    return toDto(created);
  }

  async updateEvent(id: number, input: CalendarEventUpsert): Promise<CalendarEvent> {
    await this.findEvent(id);
    const data: Prisma.calendar_eventsUpdateInput = toRow(input);
    if (input.sessionCode) data.session_code = input.sessionCode;
    const updated = await this.prisma.db.calendar_events.update({ where: { id }, data });
    return toDto(updated);
  }

  async deleteEvent(id: number): Promise<{ ok: true }> {
    await this.findEvent(id);
    await this.prisma.db.calendar_events.delete({ where: { id } });
    return { ok: true };
  }

  private async currentSessionCode(): Promise<string> {
    const row = await this.prisma.db.session.findFirst({ where: { isCurrent: true } });
    if (!row) throw new NotFoundException("No current academic session is set");
    return row.code;
  }
}

type EventRow = Prisma.calendar_eventsGetPayload<Record<string, never>>;

/** Shared field mapping for create/update (session_code handled by caller). */
function toRow(input: CalendarEventUpsert) {
  return {
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    start_date: parseIsoDate(input.startDate),
    end_date: input.endDate ? parseIsoDate(input.endDate) : null,
    start_time: input.allDay || !input.startTime ? null : parseTime(input.startTime),
    end_time: input.allDay || !input.endTime ? null : parseTime(input.endTime),
    all_day: input.allDay,
    is_holiday: input.isHoliday,
    audience: input.audience,
    class_slug: input.classSlug ?? null,
    location: input.location ?? null,
    color: input.color ?? null,
  };
}

function toDto(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    sessionCode: r.session_code,
    title: r.title,
    description: r.description,
    category: r.category,
    startDate: r.start_date.toISOString().slice(0, 10),
    endDate: r.end_date ? r.end_date.toISOString().slice(0, 10) : null,
    startTime: r.start_time ? timeToHM(r.start_time) : null,
    endTime: r.end_time ? timeToHM(r.end_time) : null,
    allDay: Boolean(r.all_day),
    isHoliday: Boolean(r.is_holiday),
    audience: r.audience,
    classSlug: r.class_slug,
    location: r.location,
    color: r.color,
    createdBy: r.created_by,
    createdAt: r.created_at ? r.created_at.toISOString() : null,
  };
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function parseTime(hm: string): Date {
  return new Date(`1970-01-01T${hm}:00Z`);
}

function timeToHM(d: Date): string {
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
