import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type { SchoolInfo, SchoolInfoUpdate } from "@crestly/shared";

/**
 * The `school_info` table is a key/value store used for school-wide
 * settings (name, address, board, timezone, geofence radii, punch
 * policy, etc.). Mirrors erp/settings/index.php's CRUD.
 */
@Injectable()
export class SchoolInfoService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async getAll(): Promise<SchoolInfo> {
    const rows = await this.prisma.db.schoolInfo.findMany();
    const values: Record<string, string | null> = {};
    for (const r of rows) values[r.k] = r.v;
    return { values };
  }

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.db.schoolInfo.findUnique({ where: { k: key } });
    return row?.v ?? null;
  }

  /** Bulk upsert. Deleting a key means setting v to null. */
  async update(input: SchoolInfoUpdate): Promise<SchoolInfo> {
    const ops = Object.entries(input.patch).map(([k, v]) =>
      this.prisma.db.schoolInfo.upsert({
        where: { k },
        update: { v },
        create: { k, v },
      }),
    );
    await this.prisma.db.$transaction(ops);
    return this.getAll();
  }
}
