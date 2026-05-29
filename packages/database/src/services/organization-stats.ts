import { prisma } from "../index";
import { BookingStatus } from "@prisma/client";

export interface OrganizationDashboardStats {
  totalUnits: number;
  available: number;
  blocked: number;
  booked: number;
  activeBlocks: number;
  todayBookings: number;
  totalBookings: number;
  pendingBookings: number;
}

export async function getOrganizationDashboardStats(
  organizationId: string,
  projectId?: string,
  projectIds?: string[]
): Promise<OrganizationDashboardStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const unitWhere = projectId
    ? { floor: { tower: { projectId } } }
    : projectIds && projectIds.length > 0
      ? { floor: { tower: { projectId: { in: projectIds } } } }
      : { floor: { tower: { project: { organizationId } } } };

  const bookingWhere = projectId
    ? { unit: { floor: { tower: { projectId } } } }
    : projectIds && projectIds.length > 0
      ? { unit: { floor: { tower: { projectId: { in: projectIds } } } } }
      : { unit: { floor: { tower: { project: { organizationId } } } } };

  const [totalUnits, available, blocked, booked, activeBlocks, todayBookings, totalBookings, pendingBookings] =
    await Promise.all([
      prisma.unit.count({ where: unitWhere }),
      prisma.unit.count({ where: { ...unitWhere, status: "AVAILABLE" } }),
      prisma.unit.count({ where: { ...unitWhere, status: "BLOCKED" } }),
      prisma.unit.count({ where: { ...unitWhere, status: "BOOKED" } }),
      prisma.block.count({
        where: {
          expiresAt: { gt: new Date() },
          unit: unitWhere,
        },
      }),
      prisma.booking.count({
        where: { ...bookingWhere, status: BookingStatus.CONFIRMED, bookedAt: { gte: todayStart } },
      }),
      prisma.booking.count({ where: { ...bookingWhere, status: BookingStatus.CONFIRMED } }),
      prisma.booking.count({ where: { ...bookingWhere, status: BookingStatus.PENDING } }),
    ]);

  return {
    totalUnits,
    available,
    blocked,
    booked,
    activeBlocks,
    todayBookings,
    totalBookings,
    pendingBookings,
  };
}
