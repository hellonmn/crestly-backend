import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { FeaturePurchaseRow, PlatformLedgerOverview } from "@crestly/shared";

@Injectable()
export class PlatformLedgerService {
  constructor(private readonly tenants: TenantService) {}

  async overview(): Promise<PlatformLedgerOverview> {
    const purchases = await this.tenants.platform.feature_purchases.findMany({
      orderBy: { id: "desc" },
      take: 200,
    });
    const schools = await this.tenants.platform.partnerSchool.findMany({
      select: { id: true, name: true },
    });
    const schoolMap = new Map(schools.map((s) => [s.id, s.name]));

    const rows: FeaturePurchaseRow[] = purchases.map((p) => ({
      id: p.id,
      schoolId: p.school_id,
      schoolName: schoolMap.get(p.school_id) ?? `School #${p.school_id}`,
      featureKey: p.feature_key,
      amount: p.amount,
      gateway: p.gateway,
      orderId: p.order_id,
      paymentId: p.payment_id,
      status: p.status,
      invoiceNo: p.invoice_no,
      gstAmount: p.gst_amount,
      totalAmount: p.total_amount,
      createdAt: p.created_at ? p.created_at.toISOString() : null,
      paidAt: p.paid_at ? p.paid_at.toISOString() : null,
    }));

    const paid = rows.filter((r) => r.status === "paid");
    const totalCollected = paid.reduce((s, r) => s + r.amount, 0);
    const pending = rows.filter((r) => r.status === "created").length;
    const failed = rows.filter((r) => r.status === "failed").length;

    const bySchoolMap = new Map<number, { schoolName: string; purchases: number; revenue: number }>();
    for (const r of paid) {
      const slot = bySchoolMap.get(r.schoolId) ?? { schoolName: r.schoolName, purchases: 0, revenue: 0 };
      slot.purchases++;
      slot.revenue += r.amount;
      bySchoolMap.set(r.schoolId, slot);
    }
    const bySchool = Array.from(bySchoolMap.entries())
      .map(([schoolId, v]) => ({ schoolId, schoolName: v.schoolName, purchases: v.purchases, revenue: v.revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return { totalCollected, pending, failed, bySchool, recent: rows.slice(0, 25) };
  }

  async school(schoolId: number): Promise<FeaturePurchaseRow[]> {
    const school = await this.tenants.platform.partnerSchool.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException();
    const purchases = await this.tenants.platform.feature_purchases.findMany({
      where: { school_id: schoolId },
      orderBy: { id: "desc" },
    });
    return purchases.map((p) => ({
      id: p.id, schoolId: p.school_id, schoolName: school.name,
      featureKey: p.feature_key, amount: p.amount, gateway: p.gateway,
      orderId: p.order_id, paymentId: p.payment_id, status: p.status,
      invoiceNo: p.invoice_no, gstAmount: p.gst_amount, totalAmount: p.total_amount,
      createdAt: p.created_at ? p.created_at.toISOString() : null,
      paidAt: p.paid_at ? p.paid_at.toISOString() : null,
    }));
  }

  async invoice(id: number): Promise<FeaturePurchaseRow & { school: { name: string; address: string | null; city: string | null; state: string | null } }> {
    const p = await this.tenants.platform.feature_purchases.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    const s = await this.tenants.platform.partnerSchool.findUnique({ where: { id: p.school_id } });
    if (!s) throw new NotFoundException("School missing");
    return {
      id: p.id, schoolId: p.school_id, schoolName: s.name,
      featureKey: p.feature_key, amount: p.amount, gateway: p.gateway,
      orderId: p.order_id, paymentId: p.payment_id, status: p.status,
      invoiceNo: p.invoice_no, gstAmount: p.gst_amount, totalAmount: p.total_amount,
      createdAt: p.created_at ? p.created_at.toISOString() : null,
      paidAt: p.paid_at ? p.paid_at.toISOString() : null,
      school: { name: s.name, address: s.address, city: s.city, state: s.state },
    };
  }
}
