import { Controller, Get, Param } from "@nestjs/common";
import { StreamsService } from "./streams.service";
import { RequirePerm } from "../auth/require-perm.decorator";

@Controller("streams")
export class StreamsController {
  constructor(private readonly streams: StreamsService) {}

  @Get()
  @RequirePerm("students.view")
  summary() {
    return this.streams.summary();
  }

  @Get(":stream/roster")
  @RequirePerm("students.view")
  roster(@Param("stream") stream: string) {
    return this.streams.roster(stream);
  }
}
