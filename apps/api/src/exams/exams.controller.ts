import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UsePipes } from "@nestjs/common";
import { ExamTermsService } from "./terms.service";
import { ExamSubjectsService } from "./subjects.service";
import { ExamDatesheetService } from "./datesheet.service";
import { ExamMarksService } from "./marks.service";
import { ExamCoScholasticService } from "./co-scholastic.service";
import { ExamResultsService } from "./results.service";
import { ExamMarksheetService } from "./marksheet.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  CoGradeSaveSchema,
  ExamClassSubjectToggleSchema,
  ExamDatesheetUpsertSchema,
  ExamMarkSaveSchema,
  ExamMarksQuerySchema,
  ExamSubjectUpsertSchema,
  ExamTermUpsertSchema,
  MarksheetQuerySchema,
  ResultsQuerySchema,
} from "@crestly/shared";
import type {
  CoGradeSave, ExamClassSubjectToggle, ExamDatesheetUpsert,
  ExamMarkSave, ExamMarksQuery, ExamSubjectUpsert, ExamTermUpsert,
  MarksheetQuery, ResultsQuery, CurrentUser as User,
} from "@crestly/shared";

@Controller("exams")
export class ExamsController {
  constructor(
    private readonly terms: ExamTermsService,
    private readonly subjects: ExamSubjectsService,
    private readonly datesheet: ExamDatesheetService,
    private readonly marks: ExamMarksService,
    private readonly co: ExamCoScholasticService,
    private readonly resultsService: ExamResultsService,
    private readonly marksheet: ExamMarksheetService,
  ) {}

  // --- terms ---
  @Get("terms")
  @RequirePerm("exams.view")
  listTerms() { return this.terms.list(); }

  @Post("terms")
  @RequirePerm("exams.manage")
  @UsePipes(new ZodPipe(ExamTermUpsertSchema))
  createTerm(@Body() body: ExamTermUpsert) { return this.terms.create(body); }

  @Put("terms/:id")
  @RequirePerm("exams.manage")
  updateTerm(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(ExamTermUpsertSchema)) body: ExamTermUpsert) {
    return this.terms.update(id, body);
  }

  @Delete("terms/:id")
  @RequirePerm("exams.manage")
  deleteTerm(@Param("id", ParseIntPipe) id: number) { return this.terms.delete(id); }

  @Post("terms/:id/finalize")
  @RequirePerm("exams.manage")
  finalize(@Param("id", ParseIntPipe) id: number) { return this.terms.setFinalized(id, true); }

  @Post("terms/:id/unfinalize")
  @RequirePerm("exams.manage")
  unfinalize(@Param("id", ParseIntPipe) id: number) { return this.terms.setFinalized(id, false); }

  // --- subjects ---
  @Get("subjects")
  @RequirePerm("exams.view")
  listSubjects() { return this.subjects.list(); }

  @Post("subjects")
  @RequirePerm("exams.manage")
  @UsePipes(new ZodPipe(ExamSubjectUpsertSchema))
  createSubject(@Body() body: ExamSubjectUpsert) { return this.subjects.create(body); }

  @Put("subjects/:id")
  @RequirePerm("exams.manage")
  updateSubject(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(ExamSubjectUpsertSchema)) body: ExamSubjectUpsert) {
    return this.subjects.update(id, body);
  }

  @Delete("subjects/:id")
  @RequirePerm("exams.manage")
  deleteSubject(@Param("id", ParseIntPipe) id: number) { return this.subjects.delete(id); }

  @Post("subjects/class-toggle")
  @RequirePerm("exams.manage")
  @UsePipes(new ZodPipe(ExamClassSubjectToggleSchema))
  toggleSubjectClass(@Body() body: ExamClassSubjectToggle) { return this.subjects.toggleClass(body); }

  // --- datesheet ---
  @Get("datesheet")
  @RequirePerm("exams.view")
  datesheetList(@Query("termId", ParseIntPipe) termId: number, @Query("class") classSlug?: string) {
    return this.datesheet.list(termId, classSlug);
  }

  @Post("datesheet")
  @RequirePerm("exams.manage")
  @UsePipes(new ZodPipe(ExamDatesheetUpsertSchema))
  createDatesheet(@Body() body: ExamDatesheetUpsert) { return this.datesheet.create(body); }

  @Put("datesheet/:id")
  @RequirePerm("exams.manage")
  updateDatesheet(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(ExamDatesheetUpsertSchema)) body: ExamDatesheetUpsert) {
    return this.datesheet.update(id, body);
  }

  @Delete("datesheet/:id")
  @RequirePerm("exams.manage")
  deleteDatesheet(@Param("id", ParseIntPipe) id: number) { return this.datesheet.delete(id); }

  // --- marks ---
  @Get("marks")
  @RequirePerm("exams.view")
  loadMarks(@Query(new ZodPipe(ExamMarksQuerySchema)) query: ExamMarksQuery) {
    return this.marks.load(query);
  }

  @Post("marks")
  @RequirePerm("exams.enter_marks")
  saveMark(@Body(new ZodPipe(ExamMarkSaveSchema)) body: ExamMarkSave, @CurrentUser() user: User) {
    return this.marks.save(body, user);
  }

  // --- co-scholastic ---
  @Get("co-areas")
  @RequirePerm("exams.view")
  coAreas() { return this.co.areas(); }

  @Get("co-grid")
  @RequirePerm("exams.view")
  coGrid(
    @Query("termId", ParseIntPipe) termId: number,
    @Query("class") classSlug: string,
    @Query("section") section: string,
  ) {
    return this.co.grid(termId, classSlug, section);
  }

  @Post("co-grade")
  @RequirePerm("exams.enter_marks")
  saveCoGrade(@Body(new ZodPipe(CoGradeSaveSchema)) body: CoGradeSave, @CurrentUser() user: User) {
    return this.co.save(body, user);
  }

  // --- results ---
  @Get("results")
  @RequirePerm("exams.view")
  results(@Query(new ZodPipe(ResultsQuerySchema)) query: ResultsQuery) {
    return this.resultsService.results(query);
  }

  // --- marksheet (single-student print payload) ---
  @Get("marksheet/:sr")
  @RequirePerm("exams.view")
  marksheetForStudent(
    @Param("sr", ParseIntPipe) sr: number,
    @Query(new ZodPipe(MarksheetQuerySchema)) query: MarksheetQuery,
  ) {
    return this.marksheet.build(sr, query);
  }
}
