import { Module } from "@nestjs/common";
import { ReviewHistoryController } from "./review-history.controller";
import { ReviewHistoryService } from "./review-history.service";

@Module({
  controllers: [ReviewHistoryController],
  providers: [ReviewHistoryService],
})
export class ReviewHistoryModule {}
