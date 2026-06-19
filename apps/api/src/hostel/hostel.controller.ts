import { Controller, Get, Query } from "@nestjs/common";
import { HostelService } from "./hostel.service";
import { ZodPipe } from "../common/zod.pipe";
import { HostelBoardersQuerySchema, HostelRoomsQuerySchema } from "@crestly/shared";
import type { HostelBoardersQuery, HostelRoomsQuery } from "@crestly/shared";

@Controller("hostel")
export class HostelController {
  constructor(private readonly hostel: HostelService) {}

  @Get()
  overview() { return this.hostel.overview(); }

  @Get("rooms")
  rooms(@Query(new ZodPipe(HostelRoomsQuerySchema)) query: HostelRoomsQuery) {
    return this.hostel.rooms(query);
  }

  @Get("boarders")
  boarders(@Query(new ZodPipe(HostelBoardersQuerySchema)) query: HostelBoardersQuery) {
    return this.hostel.boarders(query);
  }

  @Get("fees")
  fees() { return this.hostel.fees(); }

  @Get("schedule")
  schedule() { return this.hostel.schedule(); }
}
