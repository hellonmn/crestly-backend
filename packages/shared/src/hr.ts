import { z } from "zod";

export const HrDashboardSchema = z.object({
  totals: z.object({
    activeStaff: z.number().int(),
    punchedInToday: z.number().int(),
    onLeaveToday: z.number().int(),
    salaryThisMonth: z.number().int(),
  }),
  pendingLeaves: z.array(z.object({
    id: z.number().int(),
    userName: z.string(),
    leaveType: z.string(),
    fromDate: z.string(),
    toDate: z.string(),
    days: z.number(),
  })),
  onLeaveToday: z.array(z.object({
    userId: z.number().int(),
    userName: z.string(),
    leaveType: z.string(),
    until: z.string(),
  })),
  upcomingHolidays: z.array(z.object({
    holidayDate: z.string(),
    name: z.string(),
    type: z.string(),
  })),
  leaveTaken: z.array(z.object({
    leaveType: z.string(),
    days: z.number(),
  })),
  headcountByDepartment: z.array(z.object({
    department: z.string(),
    count: z.number().int(),
  })),
});
export type HrDashboard = z.infer<typeof HrDashboardSchema>;
