import { z } from "zod";

export const HostelBlockSchema = z.enum(["Boys", "Girls"]);
export type HostelBlock = z.infer<typeof HostelBlockSchema>;

export const HostelRoomTypeSchema = z.enum(["Triple", "Twin", "Single"]);
export type HostelRoomType = z.infer<typeof HostelRoomTypeSchema>;

export const HostelOverviewSchema = z.object({
  boarders: z.number().int(),
  totalRooms: z.number().int(),
  occupancyPct: z.number(),
  annualBilling: z.number().int(),
  blocks: z.array(z.object({
    block: HostelBlockSchema,
    rooms: z.number().int(),
    capacity: z.number().int(),
    occupied: z.number().int(),
    pct: z.number(),
  })),
});
export type HostelOverview = z.infer<typeof HostelOverviewSchema>;

export const HostelRoomSchema = z.object({
  roomNo: z.string(),
  block: HostelBlockSchema,
  roomType: HostelRoomTypeSchema,
  capacity: z.number().int(),
  floor: z.string().nullable(),
  occupied: z.number().int(),
  occupants: z.array(z.object({
    srNumber: z.number().int(),
    studentName: z.string(),
    class: z.string(),
    section: z.string(),
  })),
});
export type HostelRoom = z.infer<typeof HostelRoomSchema>;

export const HostelRoomsQuerySchema = z.object({
  block: HostelBlockSchema.optional(),
  roomType: HostelRoomTypeSchema.optional(),
});
export type HostelRoomsQuery = z.infer<typeof HostelRoomsQuerySchema>;

export const HostelBoarderSchema = z.object({
  srNumber: z.number().int(),
  studentName: z.string(),
  fatherName: z.string().nullable(),
  class: z.string(),
  section: z.string(),
  gender: z.string().nullable(),
  homeCity: z.string().nullable(),
  homeState: z.string().nullable(),
  localGuardianName: z.string().nullable(),
  localGuardianContact: z.string().nullable(),
  roomNo: z.string().nullable(),
  block: HostelBlockSchema.nullable(),
  roomType: HostelRoomTypeSchema.nullable(),
});
export type HostelBoarder = z.infer<typeof HostelBoarderSchema>;

export const HostelBoardersQuerySchema = z.object({
  q: z.string().optional(),
  block: HostelBlockSchema.optional(),
  class: z.string().optional(),
});
export type HostelBoardersQuery = z.infer<typeof HostelBoardersQuerySchema>;

/** Reference fee schedule — read-only, sourced from school_info KV or hard-coded defaults. */
export const HostelFeesSchema = z.object({
  oneTime: z.object({
    admissionDeposit: z.number().int(),
    bedding: z.number().int(),
    medicalCheckup: z.number().int(),
  }),
  annualLodging: z.object({
    triple: z.number().int(),
    twin: z.number().int(),
    single: z.number().int(),
  }),
  annualCommon: z.object({
    mess: z.number().int(),
    laundry: z.number().int(),
    utilities: z.number().int(),
  }),
  siblingDiscountPct: z.number(),
  paymentTerms: z.array(z.string()),
});
export type HostelFees = z.infer<typeof HostelFeesSchema>;

export const HostelScheduleSchema = z.object({
  weekday: z.array(z.object({
    time: z.string(),
    activity: z.string(),
  })),
  lightsOut: z.string(),
  parentWindow: z.string(),
  outingWindow: z.string(),
  policies: z.array(z.string()),
});
export type HostelSchedule = z.infer<typeof HostelScheduleSchema>;
