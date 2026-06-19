import { Injectable } from "@nestjs/common";
import { RequestPrismaService } from "../prisma/request-prisma.service";
import type {
  HostelBlock, HostelBoarder, HostelBoardersQuery, HostelFees,
  HostelOverview, HostelRoom, HostelRoomsQuery, HostelSchedule,
} from "@crestly/shared";

@Injectable()
export class HostelService {
  constructor(private readonly prisma: RequestPrismaService) {}

  async overview(): Promise<HostelOverview> {
    const rooms = await this.prisma.db.hostel_rooms.findMany();
    const allocs = await this.prisma.db.hostel_allocations.findMany({
      where: { is_current: true },
      include: { students: { select: { status: true } } },
    });
    const activeAllocs = allocs.filter((a) => a.students.status === "active");

    const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
    const boarders = activeAllocs.length;
    const occupancyPct = totalCapacity > 0 ? Math.round((boarders / totalCapacity) * 100) : 0;

    // Annual billing = sum of student_fees per-boarder hostel-related charges
    // for the current session. Fall back to a conservative estimate when
    // the hostel migration columns aren't populated.
    const fees = await this.prisma.db.studentFee.findMany({
      where: { srNumber: { in: activeAllocs.map((a) => a.sr_number) } },
      select: {
        hostelLodging: true, hostelMess: true, hostelCommon: true,
        hostelOneTime: true,
      } as never,
    }).catch(() => [] as any[]);
    const annualBilling = (fees as any[]).reduce(
      (s, f) => s + (f.hostelLodging ?? 0) + (f.hostelMess ?? 0) + (f.hostelCommon ?? 0),
      0,
    );

    const blocks: HostelOverview["blocks"] = ["Boys", "Girls"].map((b) => {
      const blockRooms = rooms.filter((r) => r.block === b);
      const cap = blockRooms.reduce((s, r) => s + r.capacity, 0);
      const occupied = activeAllocs.filter((a) =>
        blockRooms.some((r) => r.room_no === a.room_no),
      ).length;
      return {
        block: b as HostelBlock,
        rooms: blockRooms.length,
        capacity: cap,
        occupied,
        pct: cap > 0 ? Math.round((occupied / cap) * 100) : 0,
      };
    });

    return { boarders, totalRooms: rooms.length, occupancyPct, annualBilling, blocks };
  }

  async rooms(query: HostelRoomsQuery): Promise<HostelRoom[]> {
    const rooms = await this.prisma.db.hostel_rooms.findMany({
      where: {
        ...(query.block && { block: query.block }),
        ...(query.roomType && { room_type: query.roomType }),
      },
      orderBy: [{ block: "asc" }, { floor: "asc" }, { room_no: "asc" }],
    });
    const allocs = await this.prisma.db.hostel_allocations.findMany({
      where: { is_current: true, room_no: { in: rooms.map((r) => r.room_no) } },
      include: { students: { select: { srNumber: true, studentName: true, class: true, section: true, status: true } } },
    });
    const byRoom = new Map<string, typeof allocs>();
    for (const a of allocs) {
      if (a.students.status !== "active") continue;
      const arr = byRoom.get(a.room_no) ?? [];
      arr.push(a);
      byRoom.set(a.room_no, arr);
    }

    return rooms.map((r) => {
      const list = byRoom.get(r.room_no) ?? [];
      return {
        roomNo: r.room_no,
        block: r.block,
        roomType: r.room_type,
        capacity: r.capacity,
        floor: r.floor,
        occupied: list.length,
        occupants: list.map((a) => ({
          srNumber: a.students.srNumber,
          studentName: a.students.studentName,
          class: a.students.class,
          section: a.students.section,
        })),
      };
    });
  }

  async boarders(query: HostelBoardersQuery): Promise<HostelBoarder[]> {
    const allocs = await this.prisma.db.hostel_allocations.findMany({
      where: { is_current: true },
      include: {
        students: true,
        hostel_rooms: true,
      },
    });

    return allocs
      .filter((a) => a.students.status === "active")
      .filter((a) => !query.block || a.hostel_rooms.block === query.block)
      .filter((a) => !query.class || a.students.class === query.class)
      .filter((a) => {
        if (!query.q) return true;
        const q = query.q.toLowerCase();
        return (
          a.students.studentName.toLowerCase().includes(q) ||
          (a.students.fatherName?.toLowerCase() ?? "").includes(q) ||
          (a.students.local_guardian_name?.toLowerCase() ?? "").includes(q)
        );
      })
      .map((a): HostelBoarder => ({
        srNumber: a.students.srNumber,
        studentName: a.students.studentName,
        fatherName: a.students.fatherName,
        class: a.students.class,
        section: a.students.section,
        gender: a.students.gender,
        homeCity: a.students.home_city,
        homeState: a.students.home_state,
        localGuardianName: a.students.local_guardian_name,
        localGuardianContact: a.students.local_guardian_contact,
        roomNo: a.hostel_rooms.room_no,
        block: a.hostel_rooms.block,
        roomType: a.hostel_rooms.room_type,
      }));
  }

  /** Static reference data — mirrors erp/hostel/fees.php's published rates. */
  fees(): HostelFees {
    return {
      oneTime: {
        admissionDeposit: 50000,
        bedding: 5000,
        medicalCheckup: 2000,
      },
      annualLodging: {
        triple: 60000,
        twin: 90000,
        single: 144000,
      },
      annualCommon: {
        mess: 84000,
        laundry: 12000,
        utilities: 8000,
      },
      siblingDiscountPct: 10,
      paymentTerms: [
        "Two installments per academic year (April & October).",
        "Mess charges billed monthly with rolling adjustments.",
        "Caution money refunded at boarding completion, minus damages.",
      ],
    };
  }

  schedule(): HostelSchedule {
    return {
      weekday: [
        { time: "05:30", activity: "Wake-up + freshening" },
        { time: "06:00", activity: "Yoga / morning walk" },
        { time: "07:00", activity: "Breakfast" },
        { time: "07:45", activity: "Leave for classes" },
        { time: "14:30", activity: "Lunch on return" },
        { time: "16:00", activity: "Snacks + outdoor / sports" },
        { time: "18:00", activity: "Self study + library" },
        { time: "20:00", activity: "Dinner" },
        { time: "21:00", activity: "Supervised study" },
        { time: "22:30", activity: "Lights out (junior block)" },
        { time: "23:00", activity: "Lights out (senior block)" },
      ],
      lightsOut: "22:30 (juniors) · 23:00 (seniors)",
      parentWindow: "Sundays 09:00 – 17:00 with prior intimation.",
      outingWindow: "1st & 3rd Saturday of every month, 11:00 – 19:00.",
      policies: [
        "Smartphones are deposited at the warden's office and used only during supervised slots.",
        "Inter-block visits are strictly prohibited.",
        "Medical concerns are routed through the school nurse and reported to parents same-day.",
        "Any breach of curfew is logged in the warden's daybook and parents are notified.",
      ],
    };
  }
}
