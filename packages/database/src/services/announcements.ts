import {
  AnnouncementAudience,
  AnnouncementPriority,
  AnnouncementStatus,
  NotificationType,
  Prisma,
  UserRole,
} from "@prisma/client";
import { prisma } from "../index";

export interface CreateAnnouncementInput {
  title: string;
  message: string;
  type?: string;
  priority?: AnnouncementPriority;
  audience?: AnnouncementAudience;
  projectId?: string | null;
  scheduledAt?: Date | null;
  expiresAt?: Date | null;
  publishNow?: boolean;
}

export type AnnouncementWithMeta = Awaited<ReturnType<typeof createAnnouncement>>;

function orgAnnouncementsWhere(organizationId: string, projectIds?: string[]) {
  return {
    organizationId,
    ...(projectIds?.length
      ? { OR: [{ projectId: null }, { projectId: { in: projectIds } }] }
      : {}),
  };
}

export async function getAnnouncements(
  organizationId: string,
  options?: {
    search?: string;
    status?: AnnouncementStatus;
    priority?: AnnouncementPriority;
    projectId?: string;
    page?: number;
    limit?: number;
    projectIds?: string[];
  }
) {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AnnouncementWhereInput = {
    AND: [
      orgAnnouncementsWhere(organizationId, options?.projectIds),
      ...(options?.search
        ? [
            {
              OR: [
                { title: { contains: options.search, mode: "insensitive" as const } },
                { message: { contains: options.search, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
      ...(options?.status ? [{ status: options.status }] : []),
      ...(options?.priority ? [{ priority: options.priority }] : []),
      ...(options?.projectId ? [{ projectId: options.projectId }] : []),
    ],
  };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.announcement.count({ where }),
  ]);

  return { announcements, total, page, limit };
}

export async function getAnnouncementStats(organizationId: string, projectIds?: string[]) {
  const base = orgAnnouncementsWhere(organizationId, projectIds);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [active, scheduled, drafts, sentToday] = await Promise.all([
    prisma.announcement.count({ where: { ...base, status: AnnouncementStatus.ACTIVE } }),
    prisma.announcement.count({ where: { ...base, status: AnnouncementStatus.SCHEDULED } }),
    prisma.announcement.count({ where: { ...base, status: AnnouncementStatus.DRAFT } }),
    prisma.notification.count({
      where: {
        type: NotificationType.ANNOUNCEMENT,
        createdAt: { gte: todayStart },
        user: { organizationId },
      },
    }),
  ]);

  return { active, scheduled, drafts, sentToday };
}

async function getTargetUserIds(
  organizationId: string,
  audience: AnnouncementAudience,
  projectId?: string | null
) {
  if (audience === AnnouncementAudience.PROJECT_SALES && projectId) {
    const access = await prisma.userProjectAccess.findMany({
      where: { projectId, user: { organizationId, isActive: true } },
      select: { userId: true },
    });
    return access.map((a) => a.userId);
  }

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      isActive: true,
      role: { in: [UserRole.SALES_EXEC, UserRole.SALES_MANAGER] },
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function fanOutAnnouncementNotifications(
  announcement: {
    id: string;
    title: string;
    message: string;
    audience: AnnouncementAudience;
    projectId: string | null;
    organizationId: string;
  },
  tx: Prisma.TransactionClient = prisma
): Promise<{ count: number }> {
  const userIds = await getTargetUserIds(
    announcement.organizationId,
    announcement.audience,
    announcement.projectId
  );

  if (userIds.length === 0) return { count: 0 };

  const existing = await tx.notification.findMany({
    where: {
      userId: { in: userIds },
      type: NotificationType.ANNOUNCEMENT,
    },
    select: { userId: true, metadata: true },
  });

  const alreadyNotified = new Set(
    existing
      .filter((n) => {
        const meta = n.metadata as { announcementId?: string } | null;
        return meta?.announcementId === announcement.id;
      })
      .map((n) => n.userId)
  );

  const newUserIds = userIds.filter((id) => !alreadyNotified.has(id));
  if (newUserIds.length === 0) return { count: 0 };

  await tx.notification.createMany({
    data: newUserIds.map((userId) => ({
      userId,
      type: NotificationType.ANNOUNCEMENT,
      title: announcement.title,
      message: announcement.message,
      metadata: {
        announcementId: announcement.id,
        projectId: announcement.projectId,
      },
    })),
  });

  return { count: newUserIds.length };
}

export async function createAnnouncement(
  organizationId: string,
  createdById: string,
  input: CreateAnnouncementInput
) {
  const publishNow = input.publishNow ?? false;
  const status = publishNow
    ? AnnouncementStatus.ACTIVE
    : input.scheduledAt
      ? AnnouncementStatus.SCHEDULED
      : AnnouncementStatus.DRAFT;

  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.create({
      data: {
        title: input.title,
        message: input.message,
        type: input.type ?? "GENERAL",
        priority: input.priority ?? AnnouncementPriority.MEDIUM,
        audience: input.audience ?? AnnouncementAudience.ALL_SALES,
        projectId: input.projectId ?? null,
        scheduledAt: input.scheduledAt ?? null,
        expiresAt: input.expiresAt ?? null,
        status,
        publishedAt: publishNow ? new Date() : null,
        organizationId,
        createdById,
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    let notifiedCount = 0;
    if (publishNow) {
      const result = await fanOutAnnouncementNotifications(announcement, tx);
      notifiedCount = result.count;
    }

    return { announcement, notifiedCount };
  });
}

export async function updateAnnouncement(
  id: string,
  organizationId: string,
  input: Partial<CreateAnnouncementInput>
) {
  const existing = await prisma.announcement.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.message !== undefined ? { message: input.message } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.scheduledAt !== undefined ? { scheduledAt: input.scheduledAt } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return { announcement, notifiedCount: 0 };
}

export async function publishAnnouncement(id: string, organizationId: string) {
  const existing = await prisma.announcement.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;
  if (existing.status === AnnouncementStatus.ACTIVE) {
    return {
      announcement: await prisma.announcement.findFirst({
        where: { id },
        include: {
          project: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      notifiedCount: 0,
    };
  }

  return prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.ACTIVE,
        publishedAt: new Date(),
      },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    const { count } = await fanOutAnnouncementNotifications(announcement, tx);
    return { announcement, notifiedCount: count };
  });
}

export async function deleteAnnouncement(id: string, organizationId: string) {
  const existing = await prisma.announcement.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return false;

  await prisma.announcement.delete({ where: { id } });
  return true;
}
