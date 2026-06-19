import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UploadedFile, UseInterceptors, UsePipes } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { VouchersService } from "./vouchers.service";
import { RequirePerm } from "../auth/require-perm.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodPipe } from "../common/zod.pipe";
import {
  VoucherApproveSchema, VoucherCreateSchema, VoucherListQuerySchema, VoucherMarkPaidSchema,
} from "@crestly/shared";
import type {
  VoucherApproveInput, VoucherCreateInput, VoucherListQuery, VoucherMarkPaidInput,
  CurrentUser as User,
} from "@crestly/shared";

@Controller("vouchers")
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Get()
  list(@Query(new ZodPipe(VoucherListQuerySchema)) query: VoucherListQuery, @CurrentUser() user: User) {
    return this.vouchers.list(query, user);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.vouchers.findOne(id, user);
  }

  @Post()
  @RequirePerm("vouchers.create")
  @UsePipes(new ZodPipe(VoucherCreateSchema))
  create(@Body() body: VoucherCreateInput, @CurrentUser() user: User) {
    return this.vouchers.create(body, user);
  }

  @Put(":id")
  @RequirePerm("vouchers.create")
  update(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(VoucherCreateSchema)) body: VoucherCreateInput, @CurrentUser() user: User) {
    return this.vouchers.update(id, body, user);
  }

  @Post(":id/decide")
  approve(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(VoucherApproveSchema)) body: VoucherApproveInput, @CurrentUser() user: User) {
    return this.vouchers.approve(id, body, user);
  }

  @Post(":id/pay")
  markPaid(@Param("id", ParseIntPipe) id: number, @Body(new ZodPipe(VoucherMarkPaidSchema)) body: VoucherMarkPaidInput, @CurrentUser() user: User) {
    return this.vouchers.markPaid(id, body, user);
  }

  @Post(":id/cancel")
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.vouchers.cancel(id, user);
  }

  @Post(":id/attachments")
  @UseInterceptors(FileInterceptor("file"))
  attach(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    return this.vouchers.attach(id, { originalname: file.originalname, buffer: file.buffer, mimetype: file.mimetype }, user);
  }

  @Delete(":id/attachments/:attId")
  removeAttachment(
    @Param("id", ParseIntPipe) id: number,
    @Param("attId", ParseIntPipe) attId: number,
    @CurrentUser() user: User,
  ) {
    return this.vouchers.removeAttachment(id, attId, user);
  }
}
