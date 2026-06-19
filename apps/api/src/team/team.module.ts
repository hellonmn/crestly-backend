import { Module } from "@nestjs/common";
import { TeamController } from "./team.controller";
import { TeamService } from "./team.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  controllers: [TeamController, RolesController],
  providers: [TeamService, RolesService],
})
export class TeamModule {}
