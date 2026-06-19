import { Injectable, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { TenantService } from "../tenant/tenant.service";
import type {
  SuperAccountUpdate, SuperAdminProfile, SuperChangePassword, SuperLoginResponse,
} from "@crestly/shared";

@Injectable()
export class SuperAuthService {
  constructor(
    private readonly tenants: TenantService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<SuperLoginResponse> {
    const admin = await this.tenants.platform.platformAdmin.findUnique({ where: { email } });
    if (!admin || admin.status !== "active") {
      throw new UnauthorizedException("Invalid credentials");
    }
    const hash = normaliseBcrypt(admin.passwordHash);
    const ok = await bcrypt.compare(password, hash);
    if (!ok) throw new UnauthorizedException("Invalid credentials");

    await this.tenants.platform.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, kind: "super", email: admin.email },
      {
        secret: this.config.getOrThrow<string>("JWT_SECRET"),
        expiresIn: this.config.get<string>("JWT_EXPIRES_IN", "12h"),
      },
    );

    return {
      accessToken,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
      },
    };
  }

  async me(adminId: number): Promise<SuperAdminProfile> {
    const a = await this.tenants.platform.platformAdmin.findUnique({ where: { id: adminId } });
    if (!a) throw new UnauthorizedException();
    return {
      id: a.id, name: a.name, email: a.email, phone: a.phone,
      status: a.status,
      lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
      createdAt: a.createdAt ? a.createdAt.toISOString() : null,
    };
  }

  async updateAccount(adminId: number, input: SuperAccountUpdate): Promise<SuperAdminProfile> {
    await this.tenants.platform.platformAdmin.update({
      where: { id: adminId },
      data: { name: input.name, phone: input.phone ?? null },
    });
    return this.me(adminId);
  }

  async changePassword(adminId: number, input: SuperChangePassword): Promise<{ ok: true }> {
    const a = await this.tenants.platform.platformAdmin.findUnique({ where: { id: adminId } });
    if (!a) throw new UnauthorizedException();
    const ok = await bcrypt.compare(input.currentPassword, normaliseBcrypt(a.passwordHash));
    if (!ok) throw new BadRequestException("Current password is incorrect");
    const hash = await bcrypt.hash(input.newPassword, 10);
    await this.tenants.platform.platformAdmin.update({
      where: { id: adminId },
      data: { passwordHash: hash },
    });
    return { ok: true };
  }
}

function normaliseBcrypt(hash: string): string {
  return hash.startsWith("$2y$") ? "$2a$" + hash.slice(4) : hash;
}
