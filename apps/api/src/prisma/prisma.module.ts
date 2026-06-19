import { Module, Global } from "@nestjs/common";
import { RequestPrismaService } from "./request-prisma.service";

@Global()
@Module({
  providers: [RequestPrismaService],
  exports: [RequestPrismaService],
})
export class PrismaModule {}
