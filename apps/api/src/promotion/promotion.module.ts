import { Module } from "@nestjs/common";
import { PromotionController } from "./promotion.controller";
import { PromotionService } from "./promotion.service";
import { SessionsModule } from "../sessions/sessions.module";

@Module({
  imports: [SessionsModule],
  controllers: [PromotionController],
  providers: [PromotionService],
})
export class PromotionModule {}
