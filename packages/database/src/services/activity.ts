import { prisma, Prisma } from "../index";

export async function createActivity(
  data: {
    projectId: string;
    userId?: string;
    message: string;
    unitId?: string;
    metadata?: Prisma.InputJsonValue;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return client.activityEvent.create({ data });
}

export async function getActivities(projectId: string, limit = 30) {
  return prisma.activityEvent.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getHeatmapData(projectId: string, minutes = 15) {
  const since = new Date(Date.now() - minutes * 60 * 1000);

  const activities = await prisma.activityEvent.findMany({
    where: {
      projectId,
      createdAt: { gte: since },
      unitId: { not: null },
    },
  });

  const unitIds = [...new Set(activities.map((a) => a.unitId).filter(Boolean))] as string[];
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds } },
    include: { floor: { include: { tower: { select: { code: true } } } } },
  });

  const unitTowerMap = new Map(units.map((u) => [u.id, u.floor.tower.code]));

  const heatmap: Record<string, number> = {};
  for (const activity of activities) {
    if (!activity.unitId) continue;
    const code = unitTowerMap.get(activity.unitId);
    if (code) {
      heatmap[code] = (heatmap[code] ?? 0) + 1;
    }
  }

  const max = Math.max(...Object.values(heatmap), 1);
  const normalized: Record<string, number> = {};
  for (const [code, count] of Object.entries(heatmap)) {
    normalized[code] = count / max;
  }

  return normalized;
}
