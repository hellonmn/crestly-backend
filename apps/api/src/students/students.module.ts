import { Module } from "@nestjs/common";
import { StudentsController } from "./students.controller";
import { StudentsService } from "./students.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
