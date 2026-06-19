import { Module } from "@nestjs/common";
import { ExamsController } from "./exams.controller";
import { ExamTermsService } from "./terms.service";
import { ExamSubjectsService } from "./subjects.service";
import { ExamDatesheetService } from "./datesheet.service";
import { ExamMarksService } from "./marks.service";
import { ExamCoScholasticService } from "./co-scholastic.service";
import { ExamResultsService } from "./results.service";
import { ExamMarksheetService } from "./marksheet.service";
import { SessionsModule } from "../sessions/sessions.module";
import { SchoolInfoModule } from "../school-info/school-info.module";

@Module({
  imports: [SessionsModule, SchoolInfoModule],
  controllers: [ExamsController],
  providers: [
    ExamTermsService,
    ExamSubjectsService,
    ExamDatesheetService,
    ExamMarksService,
    ExamCoScholasticService,
    ExamResultsService,
    ExamMarksheetService,
  ],
})
export class ExamsModule {}
