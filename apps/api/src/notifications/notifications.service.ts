import { Injectable, NotFoundException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { AppNotification, NotificationListResponse } from "@crestly/shared";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async inbox(userId: number, limit = 100): Promise<NotificationListResponse> {
    const [rows, unread] = await Promise.all([
      this.prisma.db.notifications.findMany({
        where: { user_id: userId },
        orderBy: { id: "desc" },
        take: limit,
      }),
      this.prisma.db.notifications.count({ where: { user_id: userId, read_at: null } }),
    ]);

    return {
      unread,
      items: rows.map(toDto),
    };
  }

  async markRead(userId: number, id: number): Promise<AppNotification> {
    const row = await this.prisma.db.notifications.findUnique({ where: { id } });
    if (!row || row.user_id !== userId) throw new NotFoundException("Notification not found");
    const updated = await this.prisma.db.notifications.update({
      where: { id },
      data: { read_at: new Date() },
    });
    return toDto(updated);
  }

  async markAllRead(userId: number): Promise<{ ok: true; count: number }> {
    const r = await this.prisma.db.notifications.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
    return { ok: true, count: r.count };
  }

  /** Write a notification. 5-minute de-dupe on (user_id, type, link_url). */
  async notify(userId: number, type: string, title: string, body?: string | null, linkUrl?: string | null) {
    const recent = await this.prisma.db.notifications.findFirst({
      where: {
        user_id: userId,
        type,
        link_url: linkUrl ?? null,
        created_at: { gte: new Date(Date.now() - 5 * 60_000) },
      },
    });
    if (recent) return recent;
    return this.prisma.db.notifications.create({
      data: { user_id: userId, type, title, body: body ?? null, link_url: linkUrl ?? null },
    });
  }
}

function toDto(r: {
  id: number; type: string; title: string; body: string | null; link_url: string | null;
  read_at: Date | null; created_at: Date | null;
}): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    linkUrl: r.link_url,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    createdAt: r.created_at ? r.created_at.toISOString() : new Date(0).toISOString(),
  };
}
