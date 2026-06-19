import { Injectable, NotFoundException } from "@nestjs/common";
import { TenantService } from "../tenant/tenant.service";
import type { MarketingLead } from "@crestly/shared";

@Injectable()
export class MarketingLeadsService {
  constructor(private readonly tenants: TenantService) {}

  async list(): Promise<MarketingLead[]> {
    const rows = await this.tenants.platform.marketing_leads.findMany({
      orderBy: { id: "desc" },
      take: 500,
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? null,
      email: null,
      schoolName: r.school,
      city: null,
      message: r.notes ?? null,
      status: r.status,
      createdAt: r.created_at ? r.created_at.toISOString() : null,
    }));
  }

  async updateStatus(id: number, status: string): Promise<MarketingLead> {
    const existing = await this.tenants.platform.marketing_leads.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const row = await this.tenants.platform.marketing_leads.update({
      where: { id },
      data: { status: status as never },
    });
    return {
      id: row.id, name: row.name, phone: row.phone ?? null, email: null,
      schoolName: row.school, city: null, message: row.notes ?? null,
      status: row.status,
      createdAt: row.created_at ? row.created_at.toISOString() : null,
    };
  }
}
