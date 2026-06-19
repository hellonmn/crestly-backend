import { Controller, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUser as User } from "@crestly/shared";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  inbox(@CurrentUser() user: User) {
    return this.notifications.inbox(user.id);
  }

  @Post("mark-all-read")
  markAllRead(@CurrentUser() user: User) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(":id/read")
  markRead(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.notifications.markRead(user.id, id);
  }
}
