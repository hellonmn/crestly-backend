import { z } from "zod";

export const LedgerQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type LedgerQuery = z.infer<typeof LedgerQuerySchema>;

export const LedgerCategoryRowSchema = z.object({
  category: z.string(),
  count: z.number().int(),
  total: z.number().int(),
  paid: z.number().int(),
  due: z.number().int(),
});
export type LedgerCategoryRow = z.infer<typeof LedgerCategoryRowSchema>;

export const LedgerOverviewSchema = z.object({
  from: z.string(),
  to: z.string(),
  totalExpense: z.number().int(),
  paid: z.number().int(),
  due: z.number().int(),
  staffSalaryThisMonth: z.number().int(),
  byCategory: z.array(LedgerCategoryRowSchema),
});
export type LedgerOverview = z.infer<typeof LedgerOverviewSchema>;

// --- staff salary view ---

export const StaffSalaryRowSchema = z.object({
  userId: z.number().int(),
  name: z.string(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  monthlySalary: z.number().int(),
  computed: z.number().int(),
  paid: z.number().int(),
  due: z.number().int(),
  pendingVouchers: z.number().int(),
  presentDays: z.number(),
  absentDays: z.number(),
  monthDays: z.number().int(),
});
export type StaffSalaryRow = z.infer<typeof StaffSalaryRowSchema>;

export const StaffSalaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  q: z.string().optional(),
  department: z.string().optional(),
});
export type StaffSalaryQuery = z.infer<typeof StaffSalaryQuerySchema>;

export const StaffSalaryResponseSchema = z.object({
  month: z.string(),
  totalComputed: z.number().int(),
  totalPaid: z.number().int(),
  totalDue: z.number().int(),
  pendingVouchers: z.number().int(),
  staffCount: z.number().int(),
  rows: z.array(StaffSalaryRowSchema),
});
export type StaffSalaryResponse = z.infer<typeof StaffSalaryResponseSchema>;
