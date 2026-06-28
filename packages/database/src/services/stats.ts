import { BookingStatus, UserRole } from "@prisma/client";
import { prisma } from "../index";

export async function getBookingStats(options: {
  organizationId?: string;
  projectId?: string;
  projectIds?: string[];
  userId?: string;
}) {
  const projectFilter = options.projectId
    ? { unit: { floor: { tower: { projectId: options.projectId } } } }
    : options.projectIds && options.projectIds.length > 0
      ? { unit: { floor: { tower: { projectId: { in: options.projectIds } } } } }
      : options.organizationId
        ? { unit: { floor: { tower: { project: { organizationId: options.organizationId } } } } }
        : {};

  const baseWhere = {
    ...projectFilter,
    ...(options.userId ? { userId: options.userId } : {}),
  };

  const [total, pending, confirmed, revenueAgg] = await Promise.all([
    prisma.booking.count({ where: baseWhere }),
    prisma.booking.count({ where: { ...baseWhere, status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { ...baseWhere, status: BookingStatus.CONFIRMED } }),
    prisma.booking.aggregate({
      where: { ...baseWhere, status: BookingStatus.CONFIRMED },
      _sum: { totalPrice: true },
    }),
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const thisMonth = await prisma.booking.count({
    where: {
      ...baseWhere,
      status: BookingStatus.CONFIRMED,
      bookedAt: { gte: monthStart },
    },
  });

  return {
    total,
    pending,
    confirmed,
    rejected: await prisma.booking.count({
      where: { ...baseWhere, status: BookingStatus.REJECTED },
    }),
    cancelled: await prisma.booking.count({
      where: { ...baseWhere, status: BookingStatus.CANCELLED },
    }),
    totalRevenue: Number(revenueAgg._sum.totalPrice ?? 0),
    thisMonth,
  };
}

export async function getUserStats(organizationId: string) {
  const [total, active, admins] = await Promise.all([
    prisma.user.count({ where: { organizationId } }),
    prisma.user.count({ where: { organizationId, isActive: true } }),
    prisma.user.count({
      where: {
        organizationId,
        role: { in: [UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN] },
      },
    }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    admins,
  };
}

export async function getAuditStats(organizationId: string) {
  const logs = await prisma.auditLog.findMany({
    where: {
      user: { organizationId },
    },
    select: { action: true, userId: true },
  });

  const blockedActions = ["UNIT_BLOCKED", "BOOKING_REJECTED"];
  const successful = logs.filter((l) => !blockedActions.includes(l.action)).length;
  const failed = logs.length - successful;
  const uniqueAdmins = new Set(logs.map((l) => l.userId).filter(Boolean)).size;

  return {
    total: logs.length,
    successful,
    failed,
    uniqueAdmins,
  };
}
