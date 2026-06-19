import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { TeamService } from "./team.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { TeamListQuerySchema, TeamUpsertSchema, SetPasswordSchema } from "@crestly/shared";
import type { TeamListQuery, TeamUpsert, SetPasswordInput } from "@crestly/shared";

@Controller("team")
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @RequirePerm("team.view")
  list(@Query(new ZodPipe(TeamListQuerySchema)) query: TeamListQuery) {
    return this.team.list(query);
  }

  /**
   * Lightweight picker list — id, name, designation, department,
   * roleSlug, classTeacherOf. Used by the Classes section-edit
   * teacher picker, the Admissions assign-to dropdown, the
   * Timetable teacher filter, etc.
   *
   * Open to every logged-in user (NOT gated by team.view) because
   * many roles need to PICK a teammate even when they shouldn't
   * see the full HR record — e.g. a class teacher assigning
   * another teacher to a section.
   */
  @Get("pickable")
  pickable() { return this.team.pickable(); }

  @Get(":id")
  @RequirePerm("team.view")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.team.findOne(id);
  }

  @Post()
  @RequirePerm("team.manage")
  @UsePipes(new ZodPipe(TeamUpsertSchema))
  create(@Body() body: TeamUpsert) {
    return this.team.create(body);
  }

  @Put(":id")
  @RequirePerm("team.manage")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(TeamUpsertSchema)) body: TeamUpsert,
  ) {
    return this.team.update(id, body);
  }

  @Post(":id/password")
  @RequirePerm("team.manage")
  setPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodPipe(SetPasswordSchema)) body: SetPasswordInput,
  ) {
    return this.team.setPassword(id, body.password);
  }

  @Delete(":id")
  @RequirePerm("team.manage")
  deactivate(@Param("id", ParseIntPipe) id: number) {
    return this.team.deactivate(id);
  }
}
