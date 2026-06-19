import { Module } from "@nestjs/common";
import { DiaryController } from "./diary.controller";
import { DiaryService } from "./diary.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [DiaryController],
  providers: [DiaryService],
})
export class DiaryModule {}
