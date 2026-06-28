import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../index";

export async function createNotification(
  data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Prisma.InputJsonValue;
  },
  tx: Prisma.TransactionClient = prisma
) {
  return tx.notification.create({ data });
}

export async function getNotifications(
  userId: string,
  options?: {
    tab?: string;
    page?: number;
    limit?: number;
  }
) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.NotificationWhereInput = { userId };

  if (options?.tab === "unread") {
    where.readAt = null;
  } else if (options?.tab === "announcements") {
    where.type = { in: [NotificationType.ANNOUNCEMENT, NotificationType.ADMIN_MESSAGE] };
  } else if (options?.tab === "booking") {
    where.type = {
      in: [
        NotificationType.BOOKING_APPROVED,
        NotificationType.BOOKING_REJECTED,
      ],
    };
  } else if (options?.tab === "system") {
    where.type = NotificationType.SYSTEM;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total, page, limit };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function getNotificationStats(userId: string) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [unread, announcementsThisWeek, lastAdminMessage] = await Promise.all([
    prisma.notification.count({ where: { userId, readAt: null } }),
    prisma.notification.count({
      where: {
        userId,
        type: { in: [NotificationType.ANNOUNCEMENT, NotificationType.ADMIN_MESSAGE] },
        createdAt: { gte: weekAgo },
      },
    }),
    prisma.notification.findFirst({
      where: {
        userId,
        type: { in: [NotificationType.ANNOUNCEMENT, NotificationType.ADMIN_MESSAGE] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { unread, announcementsThisWeek, lastAdminMessage };
}
