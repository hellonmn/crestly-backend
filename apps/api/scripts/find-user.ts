/**
 * Probe every active school for a user with a given phone, and try common
 * "DOB-as-password" formats to figure out which one verifies.
 *
 *   PHONE=8188614117 npx ts-node --transpile-only -P tsconfig.json scripts/find-user.ts
 */

import { NestFactory } from "@nestjs/core";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";

const PHONE = (process.env.PHONE ?? "8188614117").replace(/\D+/g, "");

function dobFormats(d: Date): string[] {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const m1 = String(d.getMonth() + 1);
  const d1 = String(d.getDate());
  return Array.from(new Set([
    `${y}-${m}-${day}`,
    `${day}-${m}-${y}`,
    `${day}/${m}/${y}`,
    `${m}/${day}/${y}`,
    `${day}${m}${y}`,
    `${y}${m}${day}`,
    `${day}-${m1}-${y}`,
    `${d1}/${m1}/${y}`,
  ]));
}

function normalisePhpBcrypt(h: string): string {
  return h.startsWith("$2y$") ? "$2a$" + h.slice(4) : h;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  try {
    const tenants = app.get(TenantService);
    const schools = await tenants.findAllActiveSchools();

    for (const school of schools) {
      let prisma;
      try {
        prisma = tenants.clientForSchool(school);
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.log(`! ${school.name} — DB unreachable`);
        continue;
      }

      const user = await prisma.user.findFirst({
        where: { phone: PHONE },
        include: { role: true },
      });
      if (!user) {
        console.log(`\n── ${school.name} ── no user with phone ${PHONE}`);
        continue;
      }

      console.log(`\n── ${school.name} ──`);
      console.log(`✓ Found user.id=${user.id}, name=${user.name}, status=${user.status}, role=${user.role?.slug ?? "—"}`);
      console.log(`  passwordHash prefix: ${user.passwordHash?.slice(0, 7) ?? "(null)"}`);
      console.log(`  lastLoginAt: ${user.lastLoginAt?.toISOString() ?? "never"}`);

      if (!user.passwordHash) {
        console.log("  (no passwordHash on file — cannot verify anything)");
        continue;
      }

      // 1) Try the phone itself (staff-import default)
      const phoneHashOk = await bcrypt.compare(PHONE, normalisePhpBcrypt(user.passwordHash));
      console.log(`  • password == phone digits? ${phoneHashOk ? "YES ✓" : "no"}`);

      // 2) Find linked student(s) by parent contact, try DOB formats
      const students = await prisma.student.findMany({
        where: { OR: [{ fatherContact: PHONE }, { motherContact: PHONE }] },
        select: { srNumber: true, studentName: true, class: true, section: true, dob: true },
      });
      console.log(`  • students with this phone as parent: ${students.length}`);

      for (const s of students) {
        if (!s.dob) {
          console.log(`    SR ${s.srNumber} ${s.studentName} — no DOB on file`);
          continue;
        }
        const fmts = dobFormats(s.dob);
        let matched: string | null = null;
        for (const fmt of fmts) {
          const ok = await bcrypt.compare(fmt, normalisePhpBcrypt(user.passwordHash));
          if (ok) { matched = fmt; break; }
        }
        console.log(
          `    SR ${s.srNumber} ${s.studentName} (Class ${s.class}-${s.section}, DOB ${s.dob.toISOString().slice(0, 10)}): ` +
            (matched ? `DOB matches as "${matched}" ✓` : "no DOB-format match"),
        );
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
