import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ParentController } from "./parent.controller";
import { ParentService } from "./parent.service";
import { ParentJwtGuard } from "./parent-jwt.guard";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    PaymentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: { expiresIn: config.get<string>("PARENT_JWT_EXPIRES_IN", "30d") },
      }),
    }),
  ],
  controllers: [ParentController],
  providers: [ParentService, ParentJwtGuard],
})
export class ParentModule {}
