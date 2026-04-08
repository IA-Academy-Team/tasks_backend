import { Prisma } from "../../../generated/prisma/client.js";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import prisma from "../../../prisma/prisma.client.js";
import { AppError } from "../../shared/http/app-error.js";
import type { NotificationsListQuery } from "./notifications.schemas.js";
import {
  emitNotificationCreatedRealtime,
  emitNotificationReadRealtime,
  emitNotificationsReadAllRealtime,
} from "./notifications.socket.js";

type DbClient = PrismaClient | Prisma.TransactionClient;

type NotificationRecord = Prisma.NotificationGetPayload<{
  include: {
    notificationType: {
      select: {
        id: true;
        code: true;
        name: true;
      };
    };
  };
}>;

export interface NotificationDto {
  id: number;
  userId: number;
  notificationTypeId: number;
  notificationTypeCode: string;
  notificationTypeName: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: number | null;
  metadata: Prisma.JsonValue | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsListResult {
  notifications: NotificationDto[];
  unreadCount: number;
}

export interface CreateNotificationInput {
  userId: number;
  typeCode: "area_assignment" | "project_assignment" | "task_assignment";
  title: string;
  message: string;
  resourceType?: "area" | "project" | "task" | null;
  resourceId?: number | null;
  metadata?: Prisma.InputJsonValue | null;
  createdAt?: Date;
}

const mapNotification = (notification: NotificationRecord): NotificationDto => ({
  id: notification.id,
  userId: notification.userId,
  notificationTypeId: notification.notificationTypeId,
  notificationTypeCode: notification.notificationType.code,
  notificationTypeName: notification.notificationType.name,
  title: notification.title,
  message: notification.message,
  resourceType: notification.resourceType ?? null,
  resourceId: notification.resourceId ?? null,
  metadata: notification.metadata,
  isRead: notification.isRead,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
  updatedAt: notification.updatedAt.toISOString(),
});

const countUnreadNotificationsForUser = async (
  userId: number,
  db: DbClient = prisma,
) => db.notification.count({
  where: {
    userId,
    isRead: false,
  },
});

const findNotificationTypeOrThrow = async (typeCode: string, db: DbClient) => {
  const notificationType = await db.notificationType.findUnique({
    where: { code: typeCode },
    select: { id: true, code: true },
  });

  if (!notificationType) {
    throw new AppError(
      500,
      "NOTIFICATION_TYPE_NOT_CONFIGURED",
      `Notification type '${typeCode}' is not configured`,
    );
  }

  return notificationType;
};

export const createNotificationRecord = async (
  payload: CreateNotificationInput,
  db: DbClient = prisma,
): Promise<NotificationDto> => {
  const notificationType = await findNotificationTypeOrThrow(payload.typeCode, db);

  const createdNotification = await db.notification.create({
    data: {
      userId: payload.userId,
      notificationTypeId: notificationType.id,
      title: payload.title,
      message: payload.message,
      resourceType: payload.resourceType ?? null,
      resourceId: payload.resourceId ?? null,
      ...(payload.metadata !== undefined
        ? { metadata: payload.metadata === null ? Prisma.JsonNull : payload.metadata }
        : {}),
      ...(payload.createdAt ? { createdAt: payload.createdAt } : {}),
    },
    include: {
      notificationType: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  const notification = mapNotification(createdNotification as NotificationRecord);
  const unreadCount = await countUnreadNotificationsForUser(payload.userId, db);

  emitNotificationCreatedRealtime(payload.userId, {
    notification,
    unreadCount,
    issuedAt: new Date().toISOString(),
  });

  return notification;
};

export const listNotificationsForUser = async (
  userId: number,
  query: NotificationsListQuery,
): Promise<NotificationsListResult> => {
  const where: Prisma.NotificationWhereInput = { userId };

  if (query.status === "unread") {
    where.isRead = false;
  }

  if (query.status === "read") {
    where.isRead = true;
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
      include: {
        notificationType: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ]);

  return {
    notifications: notifications.map((notification) =>
      mapNotification(notification as NotificationRecord)),
    unreadCount,
  };
};

export const markNotificationAsRead = async (
  userId: number,
  notificationId: number,
): Promise<NotificationDto> => {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: {
      notificationType: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!existing || existing.userId !== userId) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }

  if (existing.isRead) {
    return mapNotification(existing as NotificationRecord);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
    include: {
      notificationType: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  const mappedNotification = mapNotification(updated as NotificationRecord);
  const unreadCount = await countUnreadNotificationsForUser(userId);
  const readAt = mappedNotification.readAt ?? new Date().toISOString();

  emitNotificationReadRealtime(userId, {
    notificationId: mappedNotification.id,
    readAt,
    unreadCount,
    issuedAt: new Date().toISOString(),
  });

  return mappedNotification;
};

export const markAllNotificationsAsRead = async (userId: number): Promise<{ updatedCount: number }> => {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: now,
    },
  });

  emitNotificationsReadAllRealtime(userId, {
    readAt: now.toISOString(),
    unreadCount: 0,
    issuedAt: new Date().toISOString(),
  });

  return { updatedCount: result.count };
};
