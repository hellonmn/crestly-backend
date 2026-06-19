import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { ImportService } from "./import.service";
import { ZodPipe } from "../common/zod.pipe";
import { ImportCommitRequestSchema, ImportPreviewRequestSchema } from "@crestly/shared";
import type { ImportCommitRequest, ImportPreviewRequest } from "@crestly/shared";

@Controller("import")
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Post("preview")
  @UsePipes(new ZodPipe(ImportPreviewRequestSchema))
  preview(@Body() body: ImportPreviewRequest) {
    return this.importer.preview(body);
  }

  @Post("commit")
  @UsePipes(new ZodPipe(ImportCommitRequestSchema))
  commit(@Body() body: ImportCommitRequest) {
    return this.importer.commit(body.token);
  }
}
