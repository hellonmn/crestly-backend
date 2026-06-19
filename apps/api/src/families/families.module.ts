import { Module } from "@nestjs/common";
import { FamiliesController } from "./families.controller";
import { FamiliesService } from "./families.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [FamiliesController],
  providers: [FamiliesService],
})
export class FamiliesModule {}
