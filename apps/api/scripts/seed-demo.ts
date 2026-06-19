/**
 * Demo user seed.
 *
 * Ensures there's an active partner_schools row pointing at the platform DB
 * itself (so the login flow can route to a database we can actually reach
 * from this dev machine), then seeds an admin user inside that DB.
 *
 * Idempotent. Re-run any time — on subsequent runs it just resets the password.
 *
 *   npm run seed:demo -w @crestly/api
 *
 * Customise via env:
 *   DEMO_PHONE=9999999999
 *   DEMO_PASSWORD=demo1234
 *   DEMO_NAME="Demo Admin"
 *   DEMO_SCHOOL_NAME="Demo School"
 *   DEMO_SCHOOL_SLUG="demo"
 */

import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";
import { ppEncrypt } from "../src/tenant/crypto";

const PHONE = process.env.DEMO_PHONE ?? "9999999999";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo1234";
const NAME = process.env.DEMO_NAME ?? "Demo Admin";
const SCHOOL_NAME = process.env.DEMO_SCHOOL_NAME ?? "Demo School";
const SCHOOL_SLUG = process.env.DEMO_SCHOOL_SLUG ?? "demo";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const tenants = app.get(TenantService);
    const config = app.get(ConfigService);

    const dbUrl = config.getOrThrow<string>("DATABASE_URL");
    const platformKey = config.getOrThrow<string>("PLATFORM_KEY");
    const parsed = new URL(dbUrl);
    const dbHost = parsed.hostname;
    const dbName = parsed.pathname.replace(/^\//, "");
    const dbUser = decodeURIComponent(parsed.username);
    const dbPass = decodeURIComponent(parsed.password);

    console.log(`Platform DB: ${dbUser}@${dbHost}/${dbName}`);

    // 1) Make sure partner_schools has an active row pointing at THIS DB so the
    //    multi-tenant login flow can find it. We store db_host as 'localhost'
    //    to match the PHP convention; TenantService rewrites that at runtime.
    const existing = await tenants.platform.partnerSchool.findUnique({
      where: { slug: SCHOOL_SLUG },
    });

    const encryptedPass = ppEncrypt(dbPass, platformKey);
    const schoolData = {
      name: SCHOOL_NAME,
      slug: SCHOOL_SLUG,
      status: "active" as const,
      dbHost: "localhost",
      dbName,
      dbUser,
      dbPassEnc: encryptedPass,
    };

    const school = existing
      ? await tenants.platform.partnerSchool.update({
          where: { id: existing.id },
          data: schoolData,
        })
      : await tenants.platform.partnerSchool.create({ data: schoolData });

    console.log(`  ✓ partner_schools row #${school.id} (slug='${school.slug}') points at this DB`);

    // 2) Seed inside that DB.
    const prisma = tenants.clientForSchool(school);

    // 2a) Roles — make sure 'admin' exists.
    let adminRole = await prisma.role.findUnique({ where: { slug: "admin" } });
    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: { slug: "admin", name: "Admin", isSystem: 1, description: "Full access" },
      });
      console.log(`  ✓ created 'admin' role`);
    } else {
      console.log(`  · 'admin' role already present (#${adminRole.id})`);
    }

    // 2b) Permissions — seed the canonical 12 keys from PHP migration 003 if
    //     none exist. If permissions already exist (PHP-migrated DB), keep them.
    const permCount = await prisma.permission.count();
    if (permCount === 0) {
      const canonical = [
        ["dashboard.view", "View dashboard", "Dashboard"],
        ["students.view", "View students", "Students"],
        ["students.manage", "Add / edit / disable students", "Students"],
        ["attendance.view", "View attendance records", "Attendance"],
        ["attendance.mark", "Mark / edit attendance", "Attendance"],
        ["fees.view", "View fee ledger", "Finance"],
        ["fees.manage", "Record / void payments", "Finance"],
        ["fee_structure.view", "View fee structure", "Finance"],
        ["fee_structure.manage", "Edit fee structure", "Finance"],
        ["team.view", "View team members", "Team"],
        ["team.manage", "Add / edit / disable members", "Team"],
        ["team.roles", "Define roles & permissions", "Team"],
      ];
      for (let i = 0; i < canonical.length; i++) {
        const [permKey, label, mod] = canonical[i]!;
        await prisma.permission.create({
          data: { permKey, label, module: mod, sortOrder: (i + 1) * 10 },
        });
      }
      console.log(`  ✓ seeded ${canonical.length} canonical permissions`);
    } else {
      console.log(`  · ${permCount} permissions already present`);
    }

    // 2c) Admin role gets every permission.
    const allPerms = await prisma.permission.findMany({ select: { id: true } });
    let attached = 0;
    for (const perm of allPerms) {
      const link = await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      });
      if (!link) {
        await prisma.rolePermission.create({
          data: { roleId: adminRole.id, permissionId: perm.id },
        });
        attached++;
      }
    }
    if (attached > 0) console.log(`  ✓ attached ${attached} permission(s) to admin role`);

    // 2d) The user.
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const existingUser = await prisma.user.findFirst({ where: { phone: PHONE } });
    let userId: number;
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: NAME, passwordHash, roleId: adminRole.id, status: "active" },
      });
      userId = existingUser.id;
      console.log(`  ✓ reset password for user #${userId} (phone ${PHONE})`);
    } else {
      const created = await prisma.user.create({
        data: {
          name: NAME,
          phone: PHONE,
          passwordHash,
          roleId: adminRole.id,
          status: "active",
        },
      });
      userId = created.id;
      console.log(`  ✓ created user #${userId} (phone ${PHONE})`);
    }

    console.log("\n────────────────────────────────────────────────────────");
    console.log(" DEMO LOGIN");
    console.log("────────────────────────────────────────────────────────");
    console.log(`  Phone:    ${PHONE}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log(`  School:   ${school.name} (slug=${school.slug})`);
    console.log("────────────────────────────────────────────────────────");
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
