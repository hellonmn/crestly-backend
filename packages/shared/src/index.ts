// Public surface of @crestly/shared.
//
// Schemas (runtime Zod values) carry the `Schema` suffix; their inferred
// static types keep the clean name. Both are exported from one place so
// consumers can do:
//
//   import { StudentUpsertSchema, type StudentUpsert } from "@crestly/shared";
//   StudentUpsertSchema.safeParse(body);
//   const v: StudentUpsert = ...;

// --- auth ---
export { LoginInputSchema, LoginResponseSchema } from "./auth";
export type { LoginInput, LoginResponse, CurrentUser } from "./auth";

// --- parent portal ---
export {
  ParentLoginInputSchema, ParentKidSchema, ParentLoginResponseSchema,
  ParentAttendanceMonthSchema, ParentExamsResponseSchema,
  ParentFeesResponseSchema, ParentDiaryEntrySchema, ParentDiaryResponseSchema,
  ParentTimetableCellSchema, ParentTimetableResponseSchema,
  ParentContactStaffSchema, ParentOfficeStatusSchema, ParentContactResponseSchema,
  ParentMoreInfoSchema, ParentTransportResponseSchema, ParentReceiptResponseSchema,
} from "./parent";
export type {
  ParentLoginInput, ParentKid, ParentLoginResponse,
  ParentAttendanceMonth, ParentExamsResponse, ParentFeesResponse,
  ParentDiaryEntry, ParentDiaryResponse, ParentTimetableResponse,
  ParentContactStaff, ParentOfficeStatus, ParentContactResponse, ParentMoreInfo,
  ParentTransportResponse, ParentReceiptResponse,
} from "./parent";

// --- ai assistant ---
export {
  AI_PROVIDERS, GROQ_MODELS,
  AiSettingsSchema, AiSettingsUpdateSchema, AiTestResultSchema,
  AiChatMessageSchema, AiAskInputSchema, AiAskResponseSchema,
} from "./ai";
export type {
  AiProvider, AiSettings, AiSettingsUpdate, AiTestResult,
  AiChatMessage, AiAskInput, AiAskResponse,
} from "./ai";

// --- students ---
export {
  GenderSchema,
  StudentStatusSchema,
  StudentAccomSchema,
  StudentPaymentStatusSchema,
  StudentSchema,
  StudentListQuerySchema,
  StudentListResponseSchema,
  StudentUpsertSchema,
  StudentFeeBreakdownSchema,
  StudentHostelInfoSchema,
  SiblingRowSchema,
  StudentFamilySummarySchema,
  StudentDetailSchema,
} from "./students";
export type {
  Gender,
  StudentStatus,
  StudentAccom,
  StudentPaymentStatus,
  Student,
  StudentListQuery,
  StudentListResponse,
  StudentUpsert,
  StudentFeeBreakdown,
  StudentHostelInfo,
  SiblingRow,
  StudentFamilySummary,
  StudentDetail,
} from "./students";

// --- team / roles / permissions ---
export {
  AccountStatusSchema,
  UserGenderSchema,
  TeamMemberSchema,
  TeamListQuerySchema,
  TeamListResponseSchema,
  TeamDepartmentCountSchema,
  TeamUpsertSchema,
  SetPasswordSchema,
  RoleSchema,
  PermissionSchema,
  RolePermToggleSchema,
} from "./team";
export type {
  AccountStatus,
  UserGender,
  TeamMember,
  TeamListQuery,
  TeamListResponse,
  TeamDepartmentCount,
  TeamUpsert,
  SetPasswordInput,
  Role,
  Permission,
  RolePermToggle,
} from "./team";

// --- sessions ---
export { AcademicSessionSchema, AcademicSessionUpsertSchema } from "./sessions";
export type { AcademicSession, AcademicSessionUpsert } from "./sessions";

// --- school info ---
export { SCHOOL_INFO_KEYS, SchoolInfoSchema, SchoolInfoUpdateSchema } from "./school-info";
export type { SchoolInfoKey, SchoolInfo, SchoolInfoUpdate } from "./school-info";

// --- classes ---
export {
  SchoolClassSchema,
  SectionSchema,
  SchoolClassUpsertSchema,
  SectionUpsertSchema,
} from "./classes";
export type { SchoolClass, Section, SchoolClassUpsert, SectionUpsert } from "./classes";

// --- streams ---
export { StreamCode, StreamSubjectSchema, StreamSummarySchema } from "./streams";
export type { StreamSubject, StreamSummary } from "./streams";

// --- families ---
export {
  FamilyMemberSchema,
  FamilySchema,
  FamilyListItemSchema,
  FamilyListQuerySchema,
  FamilyListResponseSchema,
  FamilyUpsertSchema,
} from "./families";
export type {
  FamilyMember,
  Family,
  FamilyListItem,
  FamilyListQuery,
  FamilyListResponse,
  FamilyUpsert,
} from "./families";

// --- holidays ---
export {
  HolidayTypeSchema,
  HolidaySchema,
  HolidayUpsertSchema,
  HolidayCalendarQuerySchema,
  HolidayCalendarResponseSchema,
} from "./holidays";
export type {
  HolidayType,
  Holiday,
  HolidayUpsert,
  HolidayCalendarQuery,
  HolidayCalendarResponse,
} from "./holidays";

// --- attendance (student) ---
export {
  AttendanceStatusSchema,
  AttendanceRowSchema,
  AttendanceRosterQuerySchema,
  AttendanceRosterResponseSchema,
  AttendanceMarkSchema,
  AttendanceBulkSchema,
  AttendanceHistoryQuerySchema,
  AttendanceHistoryResponseSchema,
} from "./attendance";
export type {
  AttendanceStatus,
  AttendanceRow,
  AttendanceRosterQuery,
  AttendanceRosterResponse,
  AttendanceMark,
  AttendanceBulk,
  AttendanceHistoryQuery,
  AttendanceHistoryResponse,
} from "./attendance";

// --- fees ---
export {
  FeePaymentStatusSchema,
  FeePaymentMethodSchema,
  FeeLedgerRowSchema,
  FeeLedgerQuerySchema,
  FeeLedgerResponseSchema,
  FeeLedgerStatusFilterSchema,
  FeeLedgerSortSchema,
  ReceiptListQuerySchema,
  ReceiptRowSchema,
  ReceiptListResponseSchema,
  ReceiptPrintSchema,
  StudentFeeDetailSchema,
  RecordPaymentSchema,
  FeeStructureRowSchema,
  FeeStructureUpsertSchema,
  TransportSlabRowSchema,
} from "./fees";
export type {
  FeePaymentStatus,
  FeePaymentMethod,
  FeeLedgerRow,
  FeeLedgerQuery,
  FeeLedgerResponse,
  FeeLedgerStatusFilter,
  FeeLedgerSort,
  ReceiptListQuery,
  ReceiptRow,
  ReceiptListResponse,
  ReceiptPrint,
  StudentFeeDetail,
  RecordPaymentInput,
  FeeStructureRow,
  FeeStructureUpsert,
  TransportSlabRow,
} from "./fees";

// --- diary ---
export {
  DiaryEntrySchema,
  DiaryDayQuerySchema,
  DiaryDayResponseSchema,
  DiarySaveSchema,
} from "./diary";
export type {
  DiaryEntry,
  DiaryDayQuery,
  DiaryDayResponse,
  DiarySaveInput,
} from "./diary";

// --- timetable ---
export {
  TimetablePeriodSchema,
  TimetablePeriodUpsertSchema,
  TimetableCellSchema,
  TimetableGridQuerySchema,
  TimetableGridResponseSchema,
  TimetableCellUpsertSchema,
  EligibleTeachersQuerySchema,
  EligibleTeachersResponseSchema,
  SmartAllotInputSchema,
  SmartAllotResultSchema,
  WorkloadRowSchema,
} from "./timetable";
export type {
  TimetablePeriod,
  TimetablePeriodUpsert,
  TimetableCell,
  TimetableGridQuery,
  TimetableGridResponse,
  TimetableCellUpsert,
  EligibleTeachersQuery,
  EligibleTeachersResponse,
  SmartAllotInput,
  SmartAllotResult,
  WorkloadRow,
} from "./timetable";

// --- daily report ---
export { DailyReportQuerySchema, DailyReportResponseSchema } from "./daily-report";
export type { DailyReportQuery, DailyReportResponse } from "./daily-report";

// --- notifications ---
export { NotificationSchema, NotificationListResponseSchema } from "./notifications";
export type { AppNotification, NotificationListResponse } from "./notifications";

// --- staff attendance ---
export {
  PunchTypeSchema,
  GeofenceTypeSchema,
  StaffPunchSchema,
  StaffPunchListQuerySchema,
  StaffPunchListResponseSchema,
  PunchCreateSchema,
  PunchTodaySchema,
} from "./staff-attendance";
export type {
  PunchType,
  GeofenceType,
  StaffPunch,
  StaffPunchListQuery,
  StaffPunchListResponse,
  PunchCreateInput,
  PunchTodayResponse,
} from "./staff-attendance";

// --- payments (HDFC checkout) ---
export {
  CheckoutCreateSchema, CheckoutSessionSchema,
  PaymentAttemptStatusSchema, PaymentAttemptSchema,
} from "./payments";
export type {
  CheckoutCreateInput, CheckoutSession,
  PaymentAttemptStatus, PaymentAttempt,
} from "./payments";

// --- search (spotlight) ---
export {
  SearchHitKindSchema, SearchHitSchema, SearchGroupSchema,
  SearchResponseSchema, SearchQuerySchema,
} from "./search";
export type {
  SearchHitKind, SearchHit, SearchGroup, SearchResponse, SearchQuery,
} from "./search";

// --- exams ---
export {
  ExamTermSchema, ExamTermUpsertSchema,
  ExamSubjectSchema, ExamSubjectUpsertSchema, ExamClassSubjectToggleSchema,
  ExamDatesheetRowSchema, ExamDatesheetUpsertSchema,
  ExamMarksRowSchema, ExamMarksQuerySchema, ExamMarksResponseSchema, ExamMarkSaveSchema,
  CoGradeSchema, CoAreaSchema, CoGradeSaveSchema,
  ResultRowSchema, ResultsQuerySchema, ResultsResponseSchema,
  MarksheetQuerySchema, MarksheetSubjectRowSchema, MarksheetCoRowSchema, MarksheetSchema,
} from "./exams";
export type {
  ExamTerm, ExamTermUpsert,
  ExamSubject, ExamSubjectUpsert, ExamClassSubjectToggle,
  ExamDatesheetRow, ExamDatesheetUpsert,
  ExamMarksRow, ExamMarksQuery, ExamMarksResponse, ExamMarkSave,
  CoGrade, CoArea, CoGradeSave,
  ResultRow, ResultsQuery, ResultsResponse,
  MarksheetQuery, MarksheetSubjectRow, MarksheetCoRow, Marksheet,
} from "./exams";

// --- promotion ---
export {
  PromotionStatusSchema, PromotionStudentSchema,
  PromotionOverviewSchema, PromotionSectionQuerySchema,
  PromoteOneSchema, PromoteSectionBulkSchema,
} from "./promotion";
export type {
  PromotionStatus, PromotionStudent, PromotionOverview, PromotionSectionQuery,
  PromoteOneInput, PromoteSectionBulk,
} from "./promotion";

// --- admissions ---
export {
  EnquirySourceSchema, EnquiryStatusSchema,
  AdmissionEnquirySchema, AdmissionFollowupSchema,
  EnquiryListQuerySchema, EnquiryListResponseSchema,
  EnquiryUpsertSchema, FollowupAddSchema,
} from "./admissions";
export type {
  EnquirySource, EnquiryStatus,
  AdmissionEnquiry, AdmissionFollowup,
  EnquiryListQuery, EnquiryListResponse,
  EnquiryUpsertInput, FollowupAddInput,
} from "./admissions";

// --- review history ---
export {
  ReviewDaySchema, ReviewHistoryQuerySchema, ReviewHistoryResponseSchema, ReviewCheckSchema,
} from "./review-history";
export type {
  ReviewDay, ReviewHistoryQuery, ReviewHistoryResponse, ReviewCheckInput,
} from "./review-history";

// --- approvals (edit requests) ---
export {
  EditRequestStatusSchema, EditFieldStatusSchema,
  EditRequestFieldSchema, EditRequestSchema,
  EditRequestListQuerySchema, ReviewDecisionFieldSchema, ReviewDecisionSchema,
} from "./approvals";
export type {
  EditRequestStatus, EditFieldStatus,
  EditRequestField, EditRequest,
  EditRequestListQuery, ReviewDecisionField, ReviewDecisionInput,
} from "./approvals";

// --- import ---
export {
  ImportTypeSchema, ImportRowStatusSchema, ImportPreviewRowSchema,
  ImportPreviewRequestSchema, ImportPreviewResponseSchema,
  ImportCommitRequestSchema, ImportCommitResponseSchema,
} from "./import";
export type {
  ImportType, ImportRowStatus, ImportPreviewRow,
  ImportPreviewRequest, ImportPreviewResponse,
  ImportCommitRequest, ImportCommitResponse,
} from "./import";

// --- vouchers ---
export {
  VoucherStatusSchema, VoucherPaymentStatusSchema, VoucherPaymentMethodSchema,
  VoucherApproverDecisionSchema, VoucherAttachmentSchema, VoucherApproverSchema,
  VoucherSchema, VoucherListQuerySchema, VoucherListResponseSchema,
  VoucherCreateSchema, VoucherApproveSchema, VoucherMarkPaidSchema,
} from "./vouchers";
export type {
  VoucherStatus, VoucherPaymentStatus, VoucherPaymentMethod,
  VoucherApproverDecision, VoucherAttachment, VoucherApprover,
  Voucher, VoucherListQuery, VoucherListResponse,
  VoucherCreateInput, VoucherApproveInput, VoucherMarkPaidInput,
} from "./vouchers";

// --- ledger ---
export {
  LedgerQuerySchema, LedgerCategoryRowSchema, LedgerOverviewSchema,
  StaffSalaryRowSchema, StaffSalaryQuerySchema, StaffSalaryResponseSchema,
} from "./ledger";
export type {
  LedgerQuery, LedgerCategoryRow, LedgerOverview,
  StaffSalaryRow, StaffSalaryQuery, StaffSalaryResponse,
} from "./ledger";

// --- hr ---
export { HrDashboardSchema } from "./hr";
export type { HrDashboard } from "./hr";

// --- salary ---
export {
  SalaryDayRowSchema, SalaryDayStateSchema,
  SalaryQuerySchema, SalaryResponseSchema,
} from "./salary";
export type {
  SalaryDayRow, SalaryDayState,
  SalaryQuery, SalaryResponse,
} from "./salary";

// --- leaves ---
export {
  LeaveStatusSchema, HalfDaySchema, LeaveTypeSchema, LeaveSchema,
  LeaveBalanceSchema, LeaveListQuerySchema, LeaveListResponseSchema,
  LeaveApplySchema, LeaveDecisionSchema,
} from "./leaves";
export type {
  LeaveStatus, HalfDay, LeaveType, Leave, LeaveBalance,
  LeaveListQuery, LeaveListResponse, LeaveApplyInput, LeaveDecisionInput,
} from "./leaves";

// --- shifts ---
export {
  ShiftRowSchema, ShiftListQuerySchema, ShiftListResponseSchema,
  ShiftUpsertSchema, SalaryBulkUpdateSchema, HoursBulkUpdateSchema,
} from "./shifts";
export type {
  ShiftRow, ShiftListQuery, ShiftListResponse,
  ShiftUpsertInput, SalaryBulkUpdate, HoursBulkUpdate,
} from "./shifts";

// --- hostel ---
export {
  HostelBlockSchema, HostelRoomTypeSchema, HostelOverviewSchema,
  HostelRoomSchema, HostelRoomsQuerySchema, HostelBoarderSchema,
  HostelBoardersQuerySchema, HostelFeesSchema, HostelScheduleSchema,
} from "./hostel";
export type {
  HostelBlock, HostelRoomType, HostelOverview,
  HostelRoom, HostelRoomsQuery, HostelBoarder,
  HostelBoardersQuery, HostelFees, HostelSchedule,
} from "./hostel";

// --- transport ---
export {
  PickupPointSchema, PickupPointListResponseSchema,
  PickupPointStudentSchema, PickupPointDetailSchema, PickupPointUpsertSchema,
} from "./transport";
export type {
  PickupPoint, PickupPointListResponse,
  PickupPointStudent, PickupPointDetail, PickupPointUpsertInput,
} from "./transport";

// --- whatsapp ---
export {
  WaSettingsSchema, WaSettingsUpdateSchema, WaTemplateSchema,
  WaActionBindingSchema, WaBindingUpsertSchema, WaTestInputSchema, WaLogEntrySchema,
  WaStatsSchema,
  WA_ACTIONS,
  WA_ACTION_CATALOG,
} from "./whatsapp";
export type {
  WaSettings, WaSettingsUpdate, WaTemplate,
  WaActionBinding, WaBindingUpsertInput, WaTestInput, WaLogEntry, WaActionKey,
  WaStats, WaActionDef,
} from "./whatsapp";

// --- features (platform + per-school catalog) ---
export {
  PlatformFeatureSchema, SchoolFeatureSchema, FeaturesCatalogResponseSchema,
  RazorpayOrderResponseSchema, RazorpayVerifyInputSchema,
  HdfcSettingsSchema, HdfcSettingsUpdateSchema,
} from "./features";
export type {
  PlatformFeature, SchoolFeature, FeaturesCatalogResponse,
  RazorpayOrderResponse, RazorpayVerifyInput,
  HdfcSettings, HdfcSettingsUpdate,
} from "./features";

// --- superadmin platform control plane ---
export {
  SuperLoginInputSchema, SuperLoginResponseSchema, SuperAdminProfileSchema,
  SuperAdminUpsertSchema, SuperAccountUpdateSchema, SuperChangePasswordSchema,
  PartnerSchoolStatusSchema, PartnerSchoolListItemSchema, SchoolListResponseSchema,
  PartnerSchoolDetailSchema, SchoolUpsertSchema, SchoolFeatureToggleSchema,
  CatalogUpsertSchema, PlatformBillingSchema, PlatformBillingUpdateSchema,
  FeaturePurchaseRowSchema, PlatformLedgerOverviewSchema,
  PricingTierSchema, PricingStrategySchema, MarketingLeadSchema,
  UpgradePlanSchema, ApplyUpgradeSchema, ApplyUpgradeResponseSchema,
} from "./superadmin";
export type {
  SuperLoginInput, SuperLoginResponse, SuperAdminProfile,
  SuperAdminUpsert, SuperAccountUpdate, SuperChangePassword,
  PartnerSchoolStatus, PartnerSchoolListItem, SchoolListResponse,
  PartnerSchoolDetail, SchoolUpsert, SchoolFeatureToggle,
  CatalogUpsertInput, PlatformBilling, PlatformBillingUpdate,
  FeaturePurchaseRow, PlatformLedgerOverview,
  PricingTier, PricingStrategy, MarketingLead,
  UpgradePlan, ApplyUpgradeInput, ApplyUpgradeResponse,
} from "./superadmin";
