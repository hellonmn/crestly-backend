import { Module, Global } from "@nestjs/common";
import { FeaturesController } from "./features.controller";
import { FeaturesService } from "./features.service";
import { RazorpayService } from "./razorpay.service";
import { HdfcSettingsController } from "./hdfc-settings.controller";
import { HdfcSettingsService } from "./hdfc-settings.service";

@Global()
@Module({
  controllers: [FeaturesController, HdfcSettingsController],
  providers: [FeaturesService, RazorpayService, HdfcSettingsService],
  exports: [FeaturesService, HdfcSettingsService],
})
export class FeaturesModule {}
