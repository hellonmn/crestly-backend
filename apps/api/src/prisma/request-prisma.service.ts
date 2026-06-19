import { Injectable, Inject, Scope, ForbiddenException } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { TenantService } from "../tenant/tenant.service";

/**
 * Per-request facade for the tenant Prisma client.
 *
 * The JWT carries `schoolId`; the auth guard attaches the resolved
 * TenantContext to req.tenant. This service exposes that tenant's
 * PrismaClient — controllers just inject this and call `.db.student.findMany()`.
 *
 * For unauthenticated routes (e.g. login), the service throws on access.
 * Use TenantService.platform directly when you need the platform DB.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestPrismaService {
  constructor(
    @Inject(REQUEST) private readonly req: Record<string, unknown>,
    private readonly tenants: TenantService,
  ) {}

  get db(): PrismaClient {
    const tenant = (this.req as { tenant?: { prisma: PrismaClient } }).tenant;
    if (!tenant) {
      throw new ForbiddenException("No tenant context — login required");
    }
    return tenant.prisma;
  }

  get platform(): PrismaClient {
    return this.tenants.platform;
  }
}
