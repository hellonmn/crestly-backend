import { Module } from "@nestjs/common";
import { FeesController } from "./fees.controller";
import { FeesService } from "./fees.service";
import { FeeStructureController } from "./fee-structure.controller";
import { FeeStructureService } from "./fee-structure.service";
import { SessionsModule } from "../sessions/sessions.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";

@Module({
  imports: [SessionsModule, WhatsappModule],
  controllers: [FeesController, FeeStructureController],
  providers: [FeesService, FeeStructureService],
})
export class FeesModule {}
