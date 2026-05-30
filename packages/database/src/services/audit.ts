import { prisma, AuditAction, Prisma } from "../index";

export async function createAuditLog(
  data: {
    action: AuditAction;
    entityType: string;
    entityId: string;
    userId?: string;
    metadata?: Prisma.InputJsonValue;
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma;
  return client.auditLog.create({ data });
}

export async function getAuditLogs(filters: {
  entityType?: string;
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
  if (filters.dateTo) {
    const end = new Date(filters.dateTo);
    end.setHours(23, 59, 59, 999);
    dateFilter.lte = end;
  }

  return prisma.auditLog.findMany({
    where: {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action as AuditAction } : {}),
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}
