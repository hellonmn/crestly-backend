import { Module } from "@nestjs/common";
import { SchoolInfoController } from "./school-info.controller";
import { SchoolInfoService } from "./school-info.service";

@Module({
  controllers: [SchoolInfoController],
  providers: [SchoolInfoService],
  exports: [SchoolInfoService],
})
export class SchoolInfoModule {}
