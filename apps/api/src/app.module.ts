import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { APP_GUARD } from "@nestjs/core";
import * as path from "node:path";
import { PrismaModule } from "./prisma/prisma.module";
import { TenantModule } from "./tenant/tenant.module";
import { AuthModule } from "./auth/auth.module";
import { StudentsModule } from "./students/students.module";
import { TeamModule } from "./team/team.module";
import { SessionsModule } from "./sessions/sessions.module";
import { SchoolInfoModule } from "./school-info/school-info.module";
import { ClassesModule } from "./classes/classes.module";
import { StreamsModule } from "./streams/streams.module";
import { FamiliesModule } from "./families/families.module";
import { HolidaysModule } from "./holidays/holidays.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { FeesModule } from "./fees/fees.module";
import { DiaryModule } from "./diary/diary.module";
import { TimetableModule } from "./timetable/timetable.module";
import { DailyReportModule } from "./daily-report/daily-report.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { StaffAttendanceModule } from "./staff-attendance/staff-attendance.module";
import { ExamsModule } from "./exams/exams.module";
import { PromotionModule } from "./promotion/promotion.module";
import { AdmissionsModule } from "./admissions/admissions.module";
import { ReviewHistoryModule } from "./review-history/review-history.module";
import { ApprovalsModule } from "./approvals/approvals.module";
import { ImportModule } from "./import/import.module";
import { VouchersModule } from "./vouchers/vouchers.module";
import { LedgerModule } from "./ledger/ledger.module";
import { HrModule } from "./hr/hr.module";
import { SalaryModule } from "./salary/salary.module";
import { LeavesModule } from "./leaves/leaves.module";
import { ShiftsModule } from "./shifts/shifts.module";
import { HostelModule } from "./hostel/hostel.module";
import { TransportModule } from "./transport/transport.module";
import { UploadsModule } from "./uploads/uploads.module";
import { WhatsappModule } from "./whatsapp/whatsapp.module";
import { AiModule } from "./ai/ai.module";
import { FeaturesModule } from "./features/features.module";
import { SuperadminModule } from "./superadmin/superadmin.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { SearchModule } from "./search/search.module";
import { PaymentsModule } from "./payments/payments.module";
import { ParentModule } from "./parent/parent.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), "uploads"),
      serveRoot: "/uploads",
      serveStaticOptions: { fallthrough: false, maxAge: 86400_000 },
    }),
    UploadsModule,
    PrismaModule,
    TenantModule,
    AuthModule,
    StudentsModule,
    TeamModule,
    SessionsModule,
    SchoolInfoModule,
    ClassesModule,
    StreamsModule,
    FamiliesModule,
    HolidaysModule,
    AttendanceModule,
    FeesModule,
    DiaryModule,
    TimetableModule,
    DailyReportModule,
    NotificationsModule,
    StaffAttendanceModule,
    ExamsModule,
    PromotionModule,
    AdmissionsModule,
    ReviewHistoryModule,
    ApprovalsModule,
    ImportModule,
    VouchersModule,
    LedgerModule,
    HrModule,
    SalaryModule,
    LeavesModule,
    ShiftsModule,
    HostelModule,
    TransportModule,
    WhatsappModule,
    AiModule,
    SearchModule,
    PaymentsModule,
    ParentModule,
    FeaturesModule,
    SuperadminModule,
    DashboardModule,
  ],
  providers: [
    // Every route is protected by default; @Public() opts out.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
