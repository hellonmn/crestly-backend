import { z } from "zod";

/**
 * Per-user daily salary ledger. Each row = one day; "cut" reflects late /
 * early-out deductions and unmarked days. Mirrors erp/salary/index.php.
 */

/**
 * Per-day state for the daily ledger pill. Mirrors PHP's salary_state_label():
 *   holiday       — holidays table hit
 *   weekend       — Sun (school week off)
 *   no_shift      — schedule not set for the user on this day
 *   no_salary     — monthly_salary is 0/unset
 *   sunday        — alias of weekend; kept for legacy data
 *   pending       — punched in but not yet out
 *   computed      — full day calculated (net populated)
 *   absent        — no punch + working day → full cut
 *   future        — date is in the future
 */
export const SalaryDayStateSchema = z.enum([
  "holiday", "weekend", "no_shift", "no_salary", "sunday",
  "pending", "computed", "absent", "future",
]);
export type SalaryDayState = z.infer<typeof SalaryDayStateSchema>;

export const SalaryDayRowSchema = z.object({
  date: z.string(),
  marked: z.boolean(),
  punchIn: z.string().nullable(),
  punchOut: z.string().nullable(),
  lateMinutes: z.number().int(),
  earlyMinutes: z.number().int(),
  cut: z.number().int(),
  net: z.number().int(),
  isHoliday: z.boolean(),
  isWeekend: z.boolean(),
  state: SalaryDayStateSchema,
});
export type SalaryDayRow = z.infer<typeof SalaryDayRowSchema>;

export const SalaryQuerySchema = z.object({
  userId: z.coerce.number().int().optional(),     // omit = self
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
export type SalaryQuery = z.infer<typeof SalaryQuerySchema>;

export const SalaryResponseSchema = z.object({
  userId: z.number().int(),
  userName: z.string(),
  userDesignation: z.string().nullable(),
  userDepartment: z.string().nullable(),
  month: z.string(),
  monthlySalary: z.number().int(),
  dailyGross: z.number().int(),
  daysInMonth: z.number().int(),
  daysMarked: z.number().int(),
  daysPresent: z.number().int(),
  daysAbsent: z.number().int(),
  daysPending: z.number().int(),
  totalCut: z.number().int(),
  netEarned: z.number().int(),
  paidViaVoucher: z.number().int(),
  due: z.number().int(),
  pendingVouchers: z.number().int(),
  rows: z.array(SalaryDayRowSchema),
});
export type SalaryResponse = z.infer<typeof SalaryResponseSchema>;
