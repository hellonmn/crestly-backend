import { z } from "zod";

export const NotificationSchema = z.object({
  id: z.number().int(),
  type: z.string(),                 // e.g. 'voucher.pending_approval'
  title: z.string(),
  body: z.string().nullable(),
  linkUrl: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});
export type AppNotification = z.infer<typeof NotificationSchema>;

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  unread: z.number().int().nonnegative(),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;
