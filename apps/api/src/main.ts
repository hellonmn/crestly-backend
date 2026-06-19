import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  // Disable Nest's built-in body parser (default 100KB) so our 10MB
  // limit below is the only one in the chain. Otherwise oversized
  // payloads (base64 selfies, voucher attachments) get silently
  // truncated and arrive as `{}` at the controller's ZodPipe.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(ConfigService);

  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

  app.use(helmet());
  app.enableCors({
    origin: config.get<string>("CORS_ORIGIN", "http://localhost:5173").split(","),
    credentials: true,
  });
  app.setGlobalPrefix("api");
  // Global ValidationPipe handles class-validator DTOs. We DON'T set
  // `whitelist`/`forbidNonWhitelisted` because most of our endpoints validate
  // bodies via ZodPipe — those options would strip the entire payload when
  // the @Body metatype is a plain TS type alias (Object), leaving Zod to see
  // an empty `{}` and complain that every required field is missing.
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const port = Number(config.get<string>("PORT", "4000"));
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, "Bootstrap");
}

bootstrap();
