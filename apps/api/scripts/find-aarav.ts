/**
 * One-off: find any student named "Aarav" in class Nursery in the Demo School
 * tenant DB and report parent contact info + matching user-row status.
 *
 *   npx tsx scripts/find-aarav.ts
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const tenants = app.get(TenantService);
    const schools = await tenants.findAllActiveSchools();
    console.log(`Checking ${schools.length} active school(s)…\n`);

    for (const school of schools) {
      let prisma;
      try {
        prisma = tenants.clientForSchool(school);
        // Cheap reachability ping.
        await prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        console.log(`  ! ${school.name} — DB unreachable (${(err as Error).message.slice(0, 80)})`);
        continue;
      }

      const students = await prisma.student.findMany({
        where: {
          studentName: { contains: "Aarav" },
          class: { in: ["Nursery", "nursery", "NURSERY", "Nur", "nur"] },
        },
        select: {
          srNumber: true,
          studentName: true,
          class: true,
          section: true,
          dob: true,
          fatherName: true,
          fatherContact: true,
          motherName: true,
          motherContact: true,
          status: true,
        },
      });

      if (students.length === 0) {
        // Broader probe — maybe "class" isn't exactly "Nursery".
        const broad = await prisma.student.findMany({
          where: { studentName: { contains: "Aarav" } },
          select: {
            srNumber: true,
            studentName: true,
            class: true,
            section: true,
            fatherContact: true,
            motherContact: true,
          },
          take: 20,
        });
        console.log(`\n── ${school.name} (id=${school.id}) ──`);
        console.log(`  No "Aarav" in a Nursery class.`);
        if (broad.length > 0) {
          console.log(`  Any "Aarav" in this school:`);
          for (const s of broad) {
            console.log(
              `    SR ${s.srNumber}: ${s.studentName} · Class ${s.class}-${s.section} · father ${s.fatherContact ?? "-"} · mother ${s.motherContact ?? "-"}`,
            );
          }
        }
        continue;
      }

      console.log(`\n── ${school.name} (id=${school.id}) ──`);
      for (const s of students) {
        console.log(`\nStudent SR ${s.srNumber}: ${s.studentName}`);
        console.log(`  Class:   ${s.class}-${s.section}`);
        console.log(`  Status:  ${s.status}`);
        console.log(`  DOB:     ${s.dob ? s.dob.toISOString().slice(0, 10) : "—"}`);
        console.log(`  Father:  ${s.fatherName ?? "—"} (${s.fatherContact ?? "no phone"})`);
        console.log(`  Mother:  ${s.motherName ?? "—"} (${s.motherContact ?? "no phone"})`);

        const phones = [s.fatherContact, s.motherContact]
          .map((p) => (p ?? "").replace(/\D+/g, ""))
          .filter((p) => p.length >= 8);

        if (phones.length === 0) {
          console.log("  Parent user: cannot probe — no phone on record.");
          continue;
        }

        for (const phone of phones) {
          const user = await prisma.user.findFirst({
            where: { phone, status: "active" },
            select: {
              id: true,
              name: true,
              phone: true,
              passwordHash: true,
              role: { select: { slug: true, name: true } },
              lastLoginAt: true,
            },
          });
          if (user) {
            console.log(
              `  ✓ Active user row matches phone ${phone}:`,
            );
            console.log(`    user.id=${user.id}, name=${user.name}, role=${user.role?.slug ?? "—"}`);
            console.log(`    passwordHash=${user.passwordHash?.slice(0, 14)}… (bcrypt — opaque)`);
            console.log(`    lastLoginAt=${user.lastLoginAt?.toISOString() ?? "never"}`);
          } else {
            console.log(`  ✗ No active user row for phone ${phone}.`);
          }
        }
      }
    }
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
