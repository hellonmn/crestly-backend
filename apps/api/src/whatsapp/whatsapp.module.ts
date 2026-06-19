import { Module } from "@nestjs/common";
import { WhatsappController } from "./whatsapp.controller";
import { WhatsappService } from "./whatsapp.service";
import { WhatsappDispatcher } from "./dispatcher.service";
import { WhatsappEvents } from "./events.service";

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappDispatcher, WhatsappEvents],
  exports: [WhatsappDispatcher, WhatsappEvents],
})
export class WhatsappModule {}
