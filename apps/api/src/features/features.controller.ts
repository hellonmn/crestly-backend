import { Body, Controller, Get, Param, Post, UsePipes } from "@nestjs/common";
import { FeaturesService } from "./features.service";
import { RazorpayService } from "./razorpay.service";
import { ZodPipe } from "../common/zod.pipe";
import { RazorpayVerifyInputSchema } from "@crestly/shared";
import type { RazorpayVerifyInput } from "@crestly/shared";

@Controller("features")
export class FeaturesController {
  constructor(
    private readonly features: FeaturesService,
    private readonly razorpay: RazorpayService,
  ) {}

  @Get()
  catalog() { return this.features.catalog(); }

  @Post(":key/order")
  createOrder(@Param("key") key: string) {
    return this.razorpay.createOrder(key);
  }

  @Post("verify")
  @UsePipes(new ZodPipe(RazorpayVerifyInputSchema))
  verify(@Body() body: RazorpayVerifyInput) {
    return this.razorpay.verify(body);
  }
}
