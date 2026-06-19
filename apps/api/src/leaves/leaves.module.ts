import { Module } from "@nestjs/common";
import { LeavesController } from "./leaves.controller";
import { LeavesService } from "./leaves.service";
import { UploadsModule } from "../uploads/uploads.module";

@Module({
  imports: [UploadsModule],
  controllers: [LeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
