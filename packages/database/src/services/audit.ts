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
  limit?: number;
  offset?: number;
}) {
  return prisma.auditLog.findMany({
    where: {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 50,
    skip: filters.offset ?? 0,
  });
}
