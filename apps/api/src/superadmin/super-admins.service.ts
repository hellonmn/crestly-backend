import { Injectable, ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { TenantService } from "../tenant/tenant.service";
import type { SuperAdminProfile, SuperAdminUpsert } from "@crestly/shared";

@Injectable()
export class SuperAdminsService {
  constructor(private readonly tenants: TenantService) {}

  async list(): Promise<SuperAdminProfile[]> {
    const rows = await this.tenants.platform.platformAdmin.findMany({ orderBy: { id: "asc" } });
    return rows.map(toDto);
  }

  async create(input: SuperAdminUpsert): Promise<SuperAdminProfile & { tempPassword: string }> {
    const clash = await this.tenants.platform.platformAdmin.findUnique({ where: { email: input.email } });
    if (clash) throw new ConflictException(`Email '${input.email}' is already in use`);
    const tempPassword = `Crestly@${Math.floor(1000 + Math.random() * 9000)}`;
    const hash = await bcrypt.hash(tempPassword, 10);
    const created = await this.tenants.platform.platformAdmin.create({
      data: {
        name: input.name, email: input.email, phone: input.phone ?? null,
        passwordHash: hash, status: input.status,
      },
    });
    return { ...toDto(created), tempPassword };
  }

  async update(id: number, input: SuperAdminUpsert): Promise<SuperAdminProfile> {
    const existing = await this.tenants.platform.platformAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    if (input.email !== existing.email) {
      const clash = await this.tenants.platform.platformAdmin.findUnique({ where: { email: input.email } });
      if (clash) throw new ConflictException(`Email '${input.email}' is already in use`);
    }
    const row = await this.tenants.platform.platformAdmin.update({
      where: { id },
      data: { name: input.name, email: input.email, phone: input.phone ?? null, status: input.status },
    });
    return toDto(row);
  }

  async resetPassword(id: number): Promise<{ ok: true; tempPassword: string }> {
    const existing = await this.tenants.platform.platformAdmin.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();
    const tempPassword = `Crestly@${Math.floor(1000 + Math.random() * 9000)}`;
    const hash = await bcrypt.hash(tempPassword, 10);
    await this.tenants.platform.platformAdmin.update({ where: { id }, data: { passwordHash: hash } });
    return { ok: true, tempPassword };
  }

  async delete(id: number, callerId: number): Promise<{ ok: true }> {
    if (id === callerId) throw new BadRequestException("You can't delete yourself");
    await this.tenants.platform.platformAdmin.delete({ where: { id } });
    return { ok: true };
  }
}

function toDto(a: {
  id: number; name: string; email: string; phone: string | null;
  status: "active" | "inactive";
  lastLoginAt: Date | null; createdAt: Date | null;
}): SuperAdminProfile {
  return {
    id: a.id, name: a.name, email: a.email, phone: a.phone,
    status: a.status,
    lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
    createdAt: a.createdAt ? a.createdAt.toISOString() : null,
  };
}
