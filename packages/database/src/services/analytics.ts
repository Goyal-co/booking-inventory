import { prisma } from "../index";
import { BookingStatus } from "@prisma/client";

export interface ProjectAnalytics {
  activeBlocks: number;
  bookingsToday: number;
  bookingsTotal: number;
  pendingBookings: number;
  myBookingsTotal: number;
  totalBlocksEver: number;
  conversionRate: number;
}

export async function getSalesAnalytics(
  userId: string,
  projectId: string
): Promise<ProjectAnalytics> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const unitIds = await prisma.unit.findMany({
    where: { floor: { tower: { projectId } } },
    select: { id: true },
  });
  const unitIdList = unitIds.map((u) => u.id);

  const [activeBlocks, bookingsToday, bookingsTotal, pendingBookings, totalBlocksEver] =
    await Promise.all([
    prisma.block.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        unit: { floor: { tower: { projectId } } },
      },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        bookedAt: { gte: todayStart },
        unit: { floor: { tower: { projectId } } },
      },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        unit: { floor: { tower: { projectId } } },
      },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.PENDING,
        unit: { floor: { tower: { projectId } } },
      },
    }),
    unitIdList.length > 0
      ? prisma.auditLog.count({
          where: {
            userId,
            action: "UNIT_BLOCKED",
            entityId: { in: unitIdList },
          },
        })
      : Promise.resolve(0),
  ]);

  const conversionRate =
    totalBlocksEver > 0 ? Math.round((bookingsTotal / totalBlocksEver) * 100) : 0;

  return {
    activeBlocks,
    bookingsToday,
    bookingsTotal,
    pendingBookings,
    myBookingsTotal: bookingsTotal,
    totalBlocksEver,
    conversionRate,
  };
}

export async function getSalesAnalyticsForProjects(userId: string, projectIds: string[]) {
  const entries = await Promise.all(
    projectIds.map(async (projectId) => [projectId, await getSalesAnalytics(userId, projectId)] as const)
  );
  return Object.fromEntries(entries) as Record<string, ProjectAnalytics>;
}
