/**
 * Super-admin seed. Creates or resets a super-admin so you can sign in to
 * the platform control plane at http://localhost:5174.
 *
 *   npm run seed:super -w @crestly/api
 *
 * Customise via env:
 *   SUPER_EMAIL=super@crestly.in   (default)
 *   SUPER_PASSWORD=temp1234        (default)
 *   SUPER_NAME="Platform Super Admin"
 *
 * Idempotent — re-running just resets the password.
 */

import { NestFactory } from "@nestjs/core";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../src/app.module";
import { TenantService } from "../src/tenant/tenant.service";

const EMAIL = process.env.SUPER_EMAIL ?? "super@crestly.in";
const PASSWORD = process.env.SUPER_PASSWORD ?? "temp1234";
const NAME = process.env.SUPER_NAME ?? "Platform Super Admin";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const tenants = app.get(TenantService);
    const platform = tenants.platform;

    const hash = await bcrypt.hash(PASSWORD, 10);
    const existing = await platform.platformAdmin.findUnique({ where: { email: EMAIL } });

    if (existing) {
      await platform.platformAdmin.update({
        where: { id: existing.id },
        data: { passwordHash: hash, status: "active", name: NAME },
      });
      console.log(`  ✓ Reset password for ${EMAIL} (id=${existing.id})`);
    } else {
      const created = await platform.platformAdmin.create({
        data: { email: EMAIL, name: NAME, passwordHash: hash, status: "active" },
      });
      console.log(`  ✓ Created super-admin ${EMAIL} (id=${created.id})`);
    }

    console.log("\n────────────────────────────────────────────────────────");
    console.log(" SUPER-ADMIN LOGIN  ·  http://localhost:5174");
    console.log("────────────────────────────────────────────────────────");
    console.log(`  Email:    ${EMAIL}`);
    console.log(`  Password: ${PASSWORD}`);
    console.log("────────────────────────────────────────────────────────");
    console.log("\nChange the password after first login at /account.");
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
