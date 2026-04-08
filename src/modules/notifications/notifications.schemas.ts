import { z } from "zod";

export const notificationsListQuerySchema = z.object({
  status: z.enum(["all", "unread", "read"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export const notificationIdParamsSchema = z.object({
  notificationId: z.coerce.number().int().positive(),
});

export type NotificationsListQuery = z.infer<typeof notificationsListQuerySchema>;
