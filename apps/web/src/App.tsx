import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/lib/auth-store";
import { AppShell } from "@/layouts/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";

// Students
import { StudentsListPage } from "@/pages/students/StudentsListPage";
import { StudentViewPage } from "@/pages/students/StudentViewPage";
import { StudentEditPage } from "@/pages/students/StudentEditPage";

// Team
import { TeamListPage } from "@/pages/team/TeamListPage";
import { TeamViewPage } from "@/pages/team/TeamViewPage";
import { TeamEditPage } from "@/pages/team/TeamEditPage";
import { TeamRolesPage } from "@/pages/team/TeamRolesPage";

// Sessions
import { SessionsPage } from "@/pages/sessions/SessionsPage";

// Settings (school info)
import { SettingsPage } from "@/pages/settings/SettingsPage";

// Classes
import { ClassesPage } from "@/pages/classes/ClassesPage";

// Streams
import { StreamsPage } from "@/pages/streams/StreamsPage";

// Families
import { FamiliesListPage } from "@/pages/families/FamiliesListPage";
import { FamilyViewPage } from "@/pages/families/FamilyViewPage";
import { FamilyEditPage } from "@/pages/families/FamilyEditPage";

// Holidays
import { HolidaysPage } from "@/pages/holidays/HolidaysPage";

// Batch B: daily driver
import { AttendancePage } from "@/pages/attendance/AttendancePage";
import { AttendanceHistoryPage } from "@/pages/attendance/AttendanceHistoryPage";
import { FeeLedgerListPage } from "@/pages/fee-ledger/FeeLedgerListPage";
import { StudentPaymentPage } from "@/pages/fee-ledger/StudentPaymentPage";
import { ReceiptsListPage } from "@/pages/fee-ledger/ReceiptsListPage";
import { ReceiptPrintPage } from "@/pages/fee-ledger/ReceiptPrintPage";
import { FeeStructurePage } from "@/pages/fee-structure/FeeStructurePage";
import { DiaryPage } from "@/pages/diary/DiaryPage";
import { TimetablePage } from "@/pages/timetable/TimetablePage";
import { PeriodsPage } from "@/pages/timetable/PeriodsPage";
import { WorkloadPage } from "@/pages/timetable/WorkloadPage";
import { DailyReportPage } from "@/pages/daily-report/DailyReportPage";
import { NotificationsPage } from "@/pages/notifications/NotificationsPage";
import { StaffAttendancePage } from "@/pages/staff-attendance/StaffAttendancePage";
import { StaffPunchDetailPage } from "@/pages/staff-attendance/StaffPunchDetailPage";
import { PunchPage } from "@/pages/staff-attendance/PunchPage";

// Batch C: academic
import { ExamsIndexPage } from "@/pages/exams/ExamsIndexPage";
import { ExamTermsPage } from "@/pages/exams/ExamTermsPage";
import { ExamSubjectsPage } from "@/pages/exams/ExamSubjectsPage";
import { ExamDatesheetPage } from "@/pages/exams/ExamDatesheetPage";
import { ExamCoScholasticPage } from "@/pages/exams/ExamCoScholasticPage";
import { ExamMarksPage } from "@/pages/exams/ExamMarksPage";
import { ExamResultsPage } from "@/pages/exams/ExamResultsPage";
import { MarksheetPrintPage } from "@/pages/exams/MarksheetPrintPage";

// Parent-facing payment result pages (no auth, no AppShell)
import { PaySuccessPage, PayFailurePage } from "@/pages/pay/PayResultPage";

// Parent portal — its own auth flow, separate from admin/staff
import { ParentLoginPage } from "@/pages/parent/ParentLoginPage";
import { ParentHomePage } from "@/pages/parent/ParentHomePage";
import { ParentShell } from "@/pages/parent/_layout/ParentShell";
import { ParentAttendancePage } from "@/pages/parent/ParentAttendancePage";
import { ParentExamsPage } from "@/pages/parent/ParentExamsPage";
import { ParentFeesPage } from "@/pages/parent/ParentFeesPage";
import { ParentDiaryPage } from "@/pages/parent/ParentDiaryPage";
import { ParentTimetablePage } from "@/pages/parent/ParentTimetablePage";
import { ParentContactPage } from "@/pages/parent/ParentContactPage";
import { ParentMorePage } from "@/pages/parent/ParentMorePage";
import { PromotionPage } from "@/pages/promotion/PromotionPage";
import { AdmissionsListPage } from "@/pages/admissions/AdmissionsListPage";
import { EnquiryViewPage } from "@/pages/admissions/EnquiryViewPage";
import { EnquiryEditPage } from "@/pages/admissions/EnquiryEditPage";
import { ReviewHistoryPage } from "@/pages/review-history/ReviewHistoryPage";
import { ApprovalsListPage } from "@/pages/approvals/ApprovalsListPage";
import { ApprovalReviewPage } from "@/pages/approvals/ApprovalReviewPage";
import { ImportPage } from "@/pages/import/ImportPage";

// Batch D: finance & HR
import { VouchersListPage } from "@/pages/vouchers/VouchersListPage";
import { VoucherViewPage } from "@/pages/vouchers/VoucherViewPage";
import { VoucherEditPage } from "@/pages/vouchers/VoucherEditPage";
import { LedgerPage } from "@/pages/ledger/LedgerPage";
import { StaffSalaryPage } from "@/pages/ledger/StaffSalaryPage";
import { HrDashboardPage } from "@/pages/hr/HrDashboardPage";
import { SalaryPage } from "@/pages/salary/SalaryPage";
import { LeavesPage } from "@/pages/leaves/LeavesPage";
import { LeaveApplyPage } from "@/pages/leaves/LeaveApplyPage";
import { ShiftsPage } from "@/pages/shifts/ShiftsPage";

// Batch E: operations
import { HostelIndexPage } from "@/pages/hostel/HostelIndexPage";
import { HostelRoomsPage } from "@/pages/hostel/HostelRoomsPage";
import { HostelBoardersPage } from "@/pages/hostel/HostelBoardersPage";
import { HostelFeesPage } from "@/pages/hostel/HostelFeesPage";
import { HostelSchedulePage } from "@/pages/hostel/HostelSchedulePage";
import { TransportListPage } from "@/pages/transport/TransportListPage";
import { PickupViewPage } from "@/pages/transport/PickupViewPage";
import { PickupEditPage } from "@/pages/transport/PickupEditPage";
import { TransportSlabsPage } from "@/pages/transport/TransportSlabsPage";

// Batch F: cross-cutting
import { WhatsappSettingsPage } from "@/pages/whatsapp/WhatsappSettingsPage";
import { WhatsappTemplatesPage } from "@/pages/whatsapp/WhatsappTemplatesPage";
import { WhatsappLogPage } from "@/pages/whatsapp/WhatsappLogPage";
import { FeaturesStorePage } from "@/pages/features-store/FeaturesStorePage";
import { PaymentGatewaySettingsPage } from "@/pages/payment-gateway/PaymentGatewaySettingsPage";
import { AiSettingsPage } from "@/pages/ai/AiSettingsPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Standalone print route — bypasses AppShell so the layout doesn't
          fight with the sidebar / topbar when printing on A5 landscape. */}
      <Route
        path="/print/receipt/:id"
        element={<RequireAuth><ReceiptPrintPage /></RequireAuth>}
      />
      <Route
        path="/print/marksheet/:sr"
        element={<RequireAuth><MarksheetPrintPage /></RequireAuth>}
      />

      {/* Parent-facing payment result pages — public, no AppShell.
          HDFC's return URL redirects here after a checkout. */}
      <Route path="/pay/success" element={<PaySuccessPage />} />
      <Route path="/pay/failure" element={<PayFailurePage />} />

      {/* Parent portal — public login, then all child pages mounted under
          ParentShell (topbar + bottom nav). Separate auth from the staff
          side; ParentShell bounces unauthenticated visitors back to login. */}
      <Route path="/parent/login" element={<ParentLoginPage />} />
      <Route path="/parent" element={<ParentShell />}>
        <Route index               element={<ParentHomePage />} />
        <Route path="attendance"   element={<ParentAttendancePage />} />
        <Route path="exams"        element={<ParentExamsPage />} />
        <Route path="fees"         element={<ParentFeesPage />} />
        <Route path="diary"        element={<ParentDiaryPage />} />
        <Route path="timetable"    element={<ParentTimetablePage />} />
        <Route path="contact"      element={<ParentContactPage />} />
        <Route path="more"         element={<ParentMorePage />} />
      </Route>

      <Route
        path="/"
        element={
          <RequireAuth>
            <AppShell schoolName="Crestly" />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />

        {/* Students */}
        <Route path="students" element={<StudentsListPage />} />
        <Route path="students/new" element={<StudentEditPage />} />
        <Route path="students/:srNumber" element={<StudentViewPage />} />
        <Route path="students/:srNumber/edit" element={<StudentEditPage />} />

        {/* Team + Roles */}
        <Route path="team" element={<TeamListPage />} />
        <Route path="team/new" element={<TeamEditPage />} />
        <Route path="team/roles" element={<TeamRolesPage />} />
        <Route path="team/:id" element={<TeamViewPage />} />
        <Route path="team/:id/edit" element={<TeamEditPage />} />

        {/* Sessions */}
        <Route path="sessions" element={<SessionsPage />} />

        {/* Settings */}
        <Route path="settings" element={<SettingsPage />} />

        {/* Classes & Sections */}
        <Route path="classes" element={<ClassesPage />} />

        {/* Streams */}
        <Route path="streams" element={<StreamsPage />} />

        {/* Families */}
        <Route path="families" element={<FamiliesListPage />} />
        <Route path="families/new" element={<FamilyEditPage />} />
        <Route path="families/:familyId" element={<FamilyViewPage />} />
        <Route path="families/:familyId/edit" element={<FamilyEditPage />} />

        {/* Holidays */}
        <Route path="holidays" element={<HolidaysPage />} />

        {/* Batch B */}
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="attendance/student/:srNumber" element={<AttendanceHistoryPage />} />

        <Route path="fee-ledger" element={<FeeLedgerListPage />} />
        <Route path="fee-ledger/receipts" element={<ReceiptsListPage />} />
        <Route path="fee-ledger/student/:srNumber" element={<StudentPaymentPage />} />

        <Route path="fee-structure" element={<FeeStructurePage />} />

        <Route path="diary" element={<DiaryPage />} />

        <Route path="timetable" element={<TimetablePage />} />
        <Route path="timetable/periods" element={<PeriodsPage />} />
        <Route path="timetable/workload" element={<WorkloadPage />} />

        <Route path="daily-report" element={<DailyReportPage />} />

        <Route path="notifications" element={<NotificationsPage />} />

        <Route path="staff-attendance" element={<StaffAttendancePage />} />
        <Route path="staff-attendance/:id" element={<StaffPunchDetailPage />} />
        <Route path="punch" element={<PunchPage />} />

        {/* Batch C: academic */}
        <Route path="exams" element={<ExamsIndexPage />} />
        <Route path="exams/terms" element={<ExamTermsPage />} />
        <Route path="exams/subjects" element={<ExamSubjectsPage />} />
        <Route path="exams/datesheet" element={<ExamDatesheetPage />} />
        <Route path="exams/marks" element={<ExamMarksPage />} />
        <Route path="exams/results" element={<ExamResultsPage />} />
        <Route path="exams/co-scholastic" element={<ExamCoScholasticPage />} />

        <Route path="promotion" element={<PromotionPage />} />

        <Route path="admissions" element={<AdmissionsListPage />} />
        <Route path="admissions/new" element={<EnquiryEditPage />} />
        <Route path="admissions/:id" element={<EnquiryViewPage />} />
        <Route path="admissions/:id/edit" element={<EnquiryEditPage />} />

        <Route path="review-history" element={<ReviewHistoryPage />} />

        <Route path="approvals" element={<ApprovalsListPage />} />
        <Route path="approvals/:id" element={<ApprovalReviewPage />} />

        <Route path="import" element={<ImportPage />} />

        {/* Batch D: finance & HR */}
        <Route path="vouchers" element={<VouchersListPage />} />
        <Route path="vouchers/new" element={<VoucherEditPage />} />
        <Route path="vouchers/:id" element={<VoucherViewPage />} />
        <Route path="vouchers/:id/edit" element={<VoucherEditPage />} />

        <Route path="ledger" element={<LedgerPage />} />
        <Route path="ledger/staff" element={<StaffSalaryPage />} />

        <Route path="hr" element={<HrDashboardPage />} />

        <Route path="salary" element={<SalaryPage />} />

        <Route path="leaves" element={<LeavesPage />} />
        <Route path="leaves/apply" element={<LeaveApplyPage />} />

        <Route path="shifts" element={<ShiftsPage />} />

        {/* Batch E: operations */}
        <Route path="hostel" element={<HostelIndexPage />} />
        <Route path="hostel/rooms" element={<HostelRoomsPage />} />
        <Route path="hostel/boarders" element={<HostelBoardersPage />} />
        <Route path="hostel/fees" element={<HostelFeesPage />} />
        <Route path="hostel/schedule" element={<HostelSchedulePage />} />

        <Route path="transport" element={<TransportListPage />} />
        <Route path="transport/new" element={<PickupEditPage />} />
        <Route path="transport/slabs" element={<TransportSlabsPage />} />
        <Route path="transport/:id" element={<PickupViewPage />} />
        <Route path="transport/:id/edit" element={<PickupEditPage />} />

        {/* Batch F: cross-cutting */}
        <Route path="settings/whatsapp" element={<WhatsappSettingsPage />} />
        <Route path="settings/whatsapp/templates" element={<WhatsappTemplatesPage />} />
        <Route path="settings/whatsapp/log" element={<WhatsappLogPage />} />
        <Route path="settings/payment-gateway" element={<PaymentGatewaySettingsPage />} />
        <Route path="settings/ai" element={<AiSettingsPage />} />
        <Route path="features" element={<FeaturesStorePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
