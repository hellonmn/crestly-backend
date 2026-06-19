import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
