import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { ReviewHistoryResponse, ReviewCheckInput } from "@crestly/shared";
import type { CurrentUser } from "@crestly/shared";

/**
 * Canonical list of dashboard tile keys + their human-readable labels.
 * Mirrors erp/lib/dashboard_review.php :: dashboard_review_items() exactly,
 * so the PENDING list on this page reads with the same wording the user
 * saw on the dashboard.
 *
 * IMPORTANT: keys here MUST stay in sync with REVIEW_KEYS_ORDER in
 * apps/web/src/pages/DashboardPage.tsx — they are the same set of 16.
 */
const REVIEW_ITEMS: Array<{ key: string; label: string }> = [
  { key: "students",          label: "Active students" },
  { key: "kpi-attendance",    label: "Today's attendance" },
  { key: "kpi-income",        label: "This month income" },
  { key: "kpi-approvals",     label: "Pending approvals" },
  { key: "fee-collection",    label: "Fee collection" },
  { key: "cashflow",          label: "Monthly cashflow" },
  { key: "pulse-students",    label: "Student attendance pulse" },
  { key: "pulse-staff",       label: "Staff punch-in" },
  { key: "pulse-leaves",      label: "Leaves today" },
  { key: "expense-breakdown", label: "Expense breakdown" },
  { key: "payroll",           label: "Payroll" },
  { key: "hostel",            label: "Hostel occupancy" },
  { key: "transport",         label: "Transport" },
  { key: "calendar",          label: "Upcoming exam / holiday" },
  { key: "class-dist",        label: "Class distribution" },
  { key: "recent-students",   label: "Recent students" },
];
const REVIEW_KEYS = REVIEW_ITEMS.map((i) => i.key);
const REVIEW_LABEL = new Map<string, string>(REVIEW_ITEMS.map((i) => [i.key, i.label]));

@Injectable()
export class ReviewHistoryService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async history(userId: number, window = 30): Promise<ReviewHistoryResponse> {
    const total = REVIEW_KEYS.length;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - (window - 1));

    const rows = await this.prisma.db.dashboard_reviews.findMany({
      where: { user_id: userId, review_date: { gte: from, lte: today } },
      orderBy: [{ review_date: "desc" }, { reviewed_at: "asc" }],
    });

    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const iso = r.review_date.toISOString().slice(0, 10);
      const arr = byDate.get(iso) ?? [];
      arr.push(r);
      byDate.set(iso, arr);
    }

    const days = [];
    const sparkline = [];
    let allTimeChecks = 0;

    for (let i = 0; i < window; i++) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayRows = byDate.get(iso) ?? [];
      const reviewedKeys = new Set(dayRows.map((r) => r.review_key));
      const reviewed = Array.from(reviewedKeys).map((k) => {
        const r = dayRows.find((x) => x.review_key === k)!;
        return {
          key: k,
          // Prefer the canonical label so the UI shows "Active students"
          // even if the original tick stored a different label (or none).
          label: REVIEW_LABEL.get(k) ?? r.review_label,
          reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : new Date(0).toISOString(),
        };
      });
      const pending = REVIEW_KEYS
        .filter((k) => !reviewedKeys.has(k))
        .map((k) => ({ key: k, label: REVIEW_LABEL.get(k) ?? null }));
      days.push({ reviewDate: iso, total, reviewed, pending });
      sparkline.push({ date: iso, percent: Math.round((reviewed.length / total) * 100) });
      allTimeChecks += dayRows.length;
    }

    const last7 = sparkline.slice(0, 7);
    const last30 = sparkline.slice(0, 30);
    const avg7d = Math.round(last7.reduce((s, p) => s + p.percent, 0) / Math.max(last7.length, 1));
    const avg30d = Math.round(last30.reduce((s, p) => s + p.percent, 0) / Math.max(last30.length, 1));

    let streak = 0;
    for (const p of sparkline) {
      if (p.percent === 100) streak++;
      else break;
    }

    sparkline.reverse();
    return {
      window, avg7d, avg30d, fullReviewStreak: streak, allTimeChecks,
      sparkline, days,
    };
  }

  async check(userId: number, input: ReviewCheckInput, _user: CurrentUser): Promise<{ ok: true }> {
    const today = input.reviewDate ? new Date(input.reviewDate) : new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (input.action === "uncheck") {
      await this.prisma.db.dashboard_reviews
        .delete({
          where: {
            user_id_review_date_review_key: {
              user_id: userId,
              review_date: today,
              review_key: input.reviewKey,
            },
          },
        })
        .catch(() => undefined);
      return { ok: true };
    }

    await this.prisma.db.dashboard_reviews.upsert({
      where: {
        user_id_review_date_review_key: {
          user_id: userId,
          review_date: today,
          review_key: input.reviewKey,
        },
      },
      update: { reviewed_at: new Date(), review_label: input.reviewLabel ?? null },
      create: {
        user_id: userId,
        review_date: today,
        review_key: input.reviewKey,
        review_label: input.reviewLabel ?? null,
      },
    });
    return { ok: true };
  }
}
