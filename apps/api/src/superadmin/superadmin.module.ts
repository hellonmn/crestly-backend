import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SuperAuthController } from "./super-auth.controller";
import { SuperAuthService } from "./super-auth.service";
import { SchoolsAdminController } from "./schools-admin.controller";
import { SchoolsAdminService } from "./schools-admin.service";
import { CatalogAdminController } from "./catalog-admin.controller";
import { CatalogAdminService } from "./catalog-admin.service";
import { PlatformBillingController } from "./platform-billing.controller";
import { PlatformBillingService } from "./platform-billing.service";
import { PlatformLedgerController } from "./platform-ledger.controller";
import { PlatformLedgerService } from "./platform-ledger.service";
import { SuperAdminsController } from "./super-admins.controller";
import { SuperAdminsService } from "./super-admins.service";
import { UpgradesController } from "./upgrades.controller";
import { UpgradesService } from "./upgrades.service";
import { PricingStrategyController } from "./pricing-strategy.controller";
import { PricingStrategyService } from "./pricing-strategy.service";
import { MarketingLeadsController } from "./marketing-leads.controller";
import { MarketingLeadsService } from "./marketing-leads.service";
import { SuperAdminGuard } from "./super-admin.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get<string>("JWT_EXPIRES_IN", "12h") },
      }),
    }),
  ],
  controllers: [
    SuperAuthController,
    SchoolsAdminController,
    CatalogAdminController,
    PlatformBillingController,
    PlatformLedgerController,
    SuperAdminsController,
    UpgradesController,
    PricingStrategyController,
    MarketingLeadsController,
  ],
  providers: [
    SuperAuthService,
    SchoolsAdminService,
    CatalogAdminService,
    PlatformBillingService,
    PlatformLedgerService,
    SuperAdminsService,
    UpgradesService,
    PricingStrategyService,
    MarketingLeadsService,
    SuperAdminGuard,
  ],
})
export class SuperadminModule {}
