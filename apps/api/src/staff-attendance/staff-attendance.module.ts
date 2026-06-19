import { Module } from "@nestjs/common";
import { StaffAttendanceController } from "./staff-attendance.controller";
import { StaffAttendanceService } from "./staff-attendance.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [UploadsModule],
  controllers: [StaffAttendanceController],
  providers: [StaffAttendanceService],
})
export class StaffAttendanceModule {}
