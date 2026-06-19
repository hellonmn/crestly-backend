import { Module } from "@nestjs/common";
import { TimetableController } from "./timetable.controller";
import { TimetableService } from "./timetable.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [TimetableController],
  providers: [TimetableService],
})
export class TimetableModule {}
