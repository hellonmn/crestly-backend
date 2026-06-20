/**
 * Teacher (staff) seed. Creates or resets a teacher user inside a school's DB,
 * with a 'teacher' role carrying teacher-appropriate permissions.
 *
 *   npm run seed:teacher -w @crestly/api
 *
 * Customise via env:
 *   TEACHER_PHONE=8888888888
 *   TEACHER_PASSWORD=Teacher@2026
 *   TEACHER_NAME="Demo Teacher"
 *   TEACHER_SCHOOL_SLUG=demo        (which partner_schools row to seed into)
 *
 * Idempotent — re-running just resets the password / re-attaches perms.
 * Requires a partner_schools row with the given slug (run seed:demo first).
 */

import { NestFactory } from "@nestjs/core";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";

const PHONE = process.env.TEACHER_PHONE ?? "8888888888";
const PASSWORD = process.env.TEACHER_PASSWORD ?? "Teacher@2026";
const NAME = process.env.TEACHER_NAME ?? "Demo Teacher";
const SCHOOL_SLUG = process.env.TEACHER_SCHOOL_SLUG ?? "demo";

// Teacher-appropriate permission keys. Only those that already exist in the
// school's DB are attached (we never invent permissions here).
const TEACHER_PERMS = [
  "dashboard.view",
  "students.view",
  "attendance.view",
  "attendance.mark",
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const tenants = app.get(TenantService);

    const school = await tenants.platform.partnerSchool.findUnique({
      where: { slug: SCHOOL_SLUG },
    });
    if (!school) {
      throw new Error(
        `No partner_schools row with slug='${SCHOOL_SLUG}'. Run seed:demo first, or set TEACHER_SCHOOL_SLUG.`,
      );
    }

    const prisma = tenants.clientForSchool(school);

    // 1) 'teacher' role.
    let role = await prisma.role.findUnique({ where: { slug: "teacher" } });
    if (!role) {
      role = await prisma.role.create({
        data: { slug: "teacher", name: "Teacher", isSystem: false, description: "Teaching staff" },
      });
      console.log(`  ✓ created 'teacher' role (#${role.id})`);
    } else {
      console.log(`  · 'teacher' role already present (#${role.id})`);
    }

    // 2) Attach teacher-appropriate permissions that exist in this DB.
    const perms = await prisma.permission.findMany({
      where: { permKey: { in: TEACHER_PERMS } },
      select: { id: true, permKey: true },
    });
    let attached = 0;
    for (const perm of perms) {
      const link = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
      });
      if (!link) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
        attached++;
      }
    }
    console.log(
      `  ✓ teacher role has ${perms.length} permission(s) [${perms.map((p) => p.permKey).join(", ")}] (${attached} newly attached)`,
    );

    // 3) The teacher user.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const existing = await prisma.user.findFirst({ where: { phone: PHONE } });
    let userId: number;
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: NAME, passwordHash, roleId: role.id, status: "active", designation: "Teacher" },
      });
      userId = existing.id;
      console.log(`  ✓ reset password for user #${userId} (phone ${PHONE})`);
    } else {
      const created = await prisma.user.create({
        data: {
          name: NAME,
          phone: PHONE,
          passwordHash,
          roleId: role.id,
          status: "active",
          designation: "Teacher",
          department: "Academics",
        },
      });
      userId = created.id;
      console.log(`  ✓ created teacher #${userId} (phone ${PHONE})`);
    }

    console.log("\n────────────────────────────────────────────────────────");
    console.log(" TEACHER LOGIN");
    console.log("────────────────────────────────────────────────────────");
    console.log(`  Phone:    ${PHONE}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  School:   ${school.name} (slug=${school.slug})`);
    console.log(`  Role:     teacher`);
    console.log("────────────────────────────────────────────────────────");
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
