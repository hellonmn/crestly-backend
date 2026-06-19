import { Module } from "@nestjs/common";
import { VouchersController } from "./vouchers.controller";
import { VouchersService } from "./vouchers.service";
import { UploadsModule } from "../uploads/uploads.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";

@Module({
  imports: [UploadsModule, WhatsappModule],
  controllers: [VouchersController],
  providers: [VouchersService],
  exports: [VouchersService],
})
export class VouchersModule {}
