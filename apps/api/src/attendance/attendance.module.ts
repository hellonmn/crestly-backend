import { Module } from "@nestjs/common";
import { AttendanceController } from "./attendance.controller";
import { AttendanceService } from "./attendance.service";
import { SessionsModule } from "../sessions/sessions.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";

@Module({
  imports: [SessionsModule, WhatsappModule],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
