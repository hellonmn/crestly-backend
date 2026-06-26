import { Module } from "@nestjs/common";
import { CallingController } from "./calling.controller";
import { CallingService } from "./calling.service";

@Module({
  controllers: [CallingController],
  providers: [CallingService],
})
export class CallingModule {}
