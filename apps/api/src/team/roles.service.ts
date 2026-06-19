import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { Role, Permission, RolePermToggle } from "@crestly/shared";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async listRoles(): Promise<Role[]> {
    const rows = await this.prisma.db.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    });
    const memberCounts = await this.prisma.db.user.groupBy({
      by: ["roleId"],
      _count: { _all: true },
    });
    const counts = new Map<number, number>(
      memberCounts
        .filter((c): c is { roleId: number; _count: { _all: number } } => c.roleId !== null)
        .map((c) => [c.roleId, c._count._all]),
    );

    const result: Role[] = [];
    for (const r of rows) {
      const perms = await this.prisma.db.rolePermission.findMany({
        where: { roleId: r.id },
        include: { permission: { select: { permKey: true } } },
      });
      result.push({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        isSystem: Boolean(r.isSystem),
        memberCount: counts.get(r.id) ?? 0,
        permissions: perms.map((p) => p.permission.permKey),
      });
    }
    return result;
  }

  async listPermissions(): Promise<Permission[]> {
    const rows = await this.prisma.db.permission.findMany({
      orderBy: [{ module: "asc" }, { sortOrder: "asc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      permKey: p.permKey,
      label: p.label,
      module: p.module,
      sortOrder: p.sortOrder,
    }));
  }

  async createRole(input: { slug: string; name: string; description?: string | null }): Promise<Role> {
    const exists = await this.prisma.db.role.findUnique({ where: { slug: input.slug } });
    if (exists) throw new ConflictException(`Role '${input.slug}' already exists`);
    const created = await this.prisma.db.role.create({
      data: { slug: input.slug, name: input.name, description: input.description ?? null, isSystem: false },
    });
    return { id: created.id, slug: created.slug, name: created.name, description: created.description,
             isSystem: created.isSystem, memberCount: 0, permissions: [] };
  }

  async deleteRole(slug: string): Promise<{ ok: true }> {
    const role = await this.prisma.db.role.findUnique({ where: { slug } });
    if (!role) throw new NotFoundException(`Role '${slug}' not found`);
    if (role.isSystem) throw new BadRequestException("System roles cannot be deleted");
    await this.prisma.db.role.delete({ where: { id: role.id } });
    return { ok: true };
  }

  async togglePermission(slug: string, body: RolePermToggle): Promise<{ ok: true }> {
    const role = await this.prisma.db.role.findUnique({ where: { slug } });
    if (!role) throw new NotFoundException(`Role '${slug}' not found`);
    const perm = await this.prisma.db.permission.findUnique({ where: { permKey: body.permKey } });
    if (!perm) throw new NotFoundException(`Permission '${body.permKey}' not found`);

    if (body.enabled) {
      await this.prisma.db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      });
    } else {
      await this.prisma.db.rolePermission
        .delete({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        })
        .catch(() => undefined);
    }
    return { ok: true };
  }
}
