import { prisma, UnitStatus, BookingStatus } from "../index";

export type DashboardRange = "7d" | "30d" | "90d";

function rangeStart(range: DashboardRange): Date {
  const d = new Date();
  if (range === "7d") d.setDate(d.getDate() - 7);
  else if (range === "30d") d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  d.setHours(0, 0, 0, 0);
  return d;
}

function unitScope(projectId?: string, organizationId?: string, projectIds?: string[]) {
  if (projectId) return { floor: { tower: { projectId } } };
  if (projectIds?.length) return { floor: { tower: { projectId: { in: projectIds } } } };
  if (organizationId) return { floor: { tower: { project: { organizationId } } } };
  return {};
}

function bookingScope(projectId?: string, organizationId?: string, projectIds?: string[]) {
  if (projectId) return { unit: { floor: { tower: { projectId } } } };
  if (projectIds?.length) return { unit: { floor: { tower: { projectId: { in: projectIds } } } } };
  if (organizationId) return { unit: { floor: { tower: { project: { organizationId } } } } };
  return {};
}

export interface AdminAnalyticsCharts {
  inventoryByStatus: Array<{ name: string; value: number; color: string }>;
  bookingsTrend: Array<{ date: string; count: number; revenue: number }>;
  byTower: Array<{ name: string; available: number; blocked: number; booked: number }>;
  byBhk: Array<{ name: string; count: number }>;
  salesLeaderboard: Array<{ name: string; blocks: number; bookings: number; conversion: number }>;
  expiringBlocks24h: number;
  avgApprovalHours: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  BLOCKED: "#f59e0b",
  BOOKED: "#ef4444",
  SOLD: "#6366f1",
  HOLD: "#94a3b8",
};

export async function getAdminAnalyticsCharts(
  organizationId: string,
  range: DashboardRange = "30d",
  projectId?: string,
  projectIds?: string[]
): Promise<AdminAnalyticsCharts> {
  const since = rangeStart(range);
  const uScope = unitScope(projectId, organizationId, projectIds);
  const bScope = bookingScope(projectId, organizationId, projectIds);

  const [statusCounts, towers, bhkGroups, bookingsInRange, blocksByUser, expiringBlocks, approvedBookings] =
    await Promise.all([
      prisma.unit.groupBy({
        by: ["status"],
        where: uScope,
        _count: { id: true },
      }),
      prisma.tower.findMany({
        where: projectId
          ? { projectId }
          : projectIds?.length
            ? { projectId: { in: projectIds } }
            : { project: { organizationId } },
        select: { id: true, name: true },
      }),
      prisma.unit.groupBy({
        by: ["bhkType"],
        where: { ...uScope, bhkType: { not: null } },
        _count: { id: true },
      }),
      prisma.booking.findMany({
        where: {
          ...bScope,
          status: BookingStatus.CONFIRMED,
          bookedAt: { gte: since },
        },
        select: { bookedAt: true, totalPrice: true },
        orderBy: { bookedAt: "asc" },
      }),
      prisma.booking.groupBy({
        by: ["userId"],
        where: { ...bScope, status: BookingStatus.CONFIRMED, bookedAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.block.count({
        where: {
          expiresAt: { gt: new Date(), lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
          unit: uScope,
        },
      }),
      prisma.booking.findMany({
        where: {
          ...bScope,
          status: BookingStatus.CONFIRMED,
          reviewedAt: { not: null },
          submittedAt: { gte: since },
        },
        select: { submittedAt: true, reviewedAt: true },
      }),
    ]);

  const inventoryByStatus = statusCounts.map((s) => ({
    name: s.status,
    value: s._count.id,
    color: STATUS_COLORS[s.status] ?? "#64748b",
  }));

  const trendMap = new Map<string, { count: number; revenue: number }>();
  for (const b of bookingsInRange) {
    const key = b.bookedAt.toISOString().slice(0, 10);
    const cur = trendMap.get(key) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += Number(b.totalPrice);
    trendMap.set(key, cur);
  }
  const bookingsTrend = [...trendMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const byTower: AdminAnalyticsCharts["byTower"] = [];
  for (const tower of towers) {
    const [available, blocked, booked] = await Promise.all([
      prisma.unit.count({ where: { floor: { towerId: tower.id }, status: UnitStatus.AVAILABLE } }),
      prisma.unit.count({ where: { floor: { towerId: tower.id }, status: UnitStatus.BLOCKED } }),
      prisma.unit.count({ where: { floor: { towerId: tower.id }, status: UnitStatus.BOOKED } }),
    ]);
    byTower.push({ name: tower.name, available, blocked, booked });
  }

  const byBhk = bhkGroups
    .filter((g) => g.bhkType)
    .map((g) => ({ name: g.bhkType!, count: g._count.id }))
    .sort((a, b) => b.count - a.count);

  const userIds = blocksByUser.map((b) => b.userId);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  const blockCounts = await prisma.block.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: since }, unit: uScope },
    _count: { id: true },
  });
  const blockMap = new Map(blockCounts.map((b) => [b.userId, b._count.id]));

  const salesLeaderboard = blocksByUser
    .map((b) => {
      const blocks = blockMap.get(b.userId) ?? 0;
      const bookings = b._count.id;
      return {
        name: userNameMap.get(b.userId) ?? "Unknown",
        blocks,
        bookings,
        conversion: blocks > 0 ? Math.round((bookings / blocks) * 100) : 0,
      };
    })
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10);

  let avgApprovalHours: number | null = null;
  if (approvedBookings.length > 0) {
    const totalMs = approvedBookings.reduce((sum, b) => {
      if (!b.reviewedAt) return sum;
      return sum + (b.reviewedAt.getTime() - b.submittedAt.getTime());
    }, 0);
    avgApprovalHours = Math.round(totalMs / approvedBookings.length / 3600000);
  }

  return {
    inventoryByStatus,
    bookingsTrend,
    byTower,
    byBhk,
    salesLeaderboard,
    expiringBlocks24h: expiringBlocks,
    avgApprovalHours,
  };
}

export interface SalesAnalyticsCharts {
  bookingsTrend: Array<{ date: string; count: number; revenue: number }>;
  byBhk: Array<{ name: string; count: number }>;
  byTower: Array<{ name: string; count: number }>;
  funnel: { blocks: number; bookings: number; conversionRate: number };
}

export async function getSalesAnalyticsCharts(
  userId: string,
  projectId: string,
  range: DashboardRange = "30d"
): Promise<SalesAnalyticsCharts> {
  const since = rangeStart(range);

  const [bookingsInRange, bhkGroups, towerBookings, totalBlocks, totalBookings] = await Promise.all([
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        bookedAt: { gte: since },
        unit: { floor: { tower: { projectId } } },
      },
      select: {
        bookedAt: true,
        totalPrice: true,
        unit: { select: { bhkType: true, floor: { select: { tower: { select: { name: true } } } } } },
      },
      orderBy: { bookedAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        unit: { floor: { tower: { projectId } } },
      },
      select: { unit: { select: { bhkType: true } } },
    }),
    prisma.booking.findMany({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        unit: { floor: { tower: { projectId } } },
      },
      select: { unit: { select: { floor: { select: { tower: { select: { name: true } } } } } } },
    }),
    prisma.block.count({
      where: { userId, createdAt: { gte: since }, unit: { floor: { tower: { projectId } } } },
    }),
    prisma.booking.count({
      where: {
        userId,
        status: BookingStatus.CONFIRMED,
        bookedAt: { gte: since },
        unit: { floor: { tower: { projectId } } },
      },
    }),
  ]);

  const trendMap = new Map<string, { count: number; revenue: number }>();
  for (const b of bookingsInRange) {
    const key = b.bookedAt.toISOString().slice(0, 10);
    const cur = trendMap.get(key) ?? { count: 0, revenue: 0 };
    cur.count++;
    cur.revenue += Number(b.totalPrice);
    trendMap.set(key, cur);
  }

  const bhkMap = new Map<string, number>();
  for (const b of bhkGroups) {
    const k = b.unit.bhkType ?? "Unknown";
    bhkMap.set(k, (bhkMap.get(k) ?? 0) + 1);
  }

  const towerMap = new Map<string, number>();
  for (const b of towerBookings) {
    const k = b.unit.floor.tower.name;
    towerMap.set(k, (towerMap.get(k) ?? 0) + 1);
  }

  return {
    bookingsTrend: [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    byBhk: [...bhkMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    byTower: [...towerMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    funnel: {
      blocks: totalBlocks,
      bookings: totalBookings,
      conversionRate: totalBlocks > 0 ? Math.round((totalBookings / totalBlocks) * 100) : 0,
    },
  };
}
