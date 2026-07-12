import { prisma, UnitStatus, AuditAction, BookingStatus } from "../index";
import { createAuditLog } from "./audit";
import { createActivity } from "./activity";

export class BlockError extends Error {
  constructor(
    message: string,
    public code:
      | "MAX_BLOCKS"
      | "NOT_AVAILABLE"
      | "NOT_OWNER"
      | "EXPIRED"
      | "NOT_FOUND"
      | "BLOCKING_DISABLED"
      | "PENDING_BOOKING"
      | "ALREADY_ATTACHED"
      | "CONFIG"
  ) {
    super(message);
  }
}


export async function getActiveBlocksForUser(
  userId: string,
  projectId?: string,
  search?: string,
  extra?: { tower?: string; bhk?: string }
) {
  const trimmed = search?.trim();
  const blocks = await prisma.block.findMany({
    where: {
      userId,
      expiresAt: { gt: new Date() },
      ...(projectId || extra?.tower || extra?.bhk
        ? {
            unit: {
              ...(extra?.bhk ? { bhkType: extra.bhk } : {}),
              floor: {
                tower: {
                  ...(projectId ? { projectId } : {}),
                  ...(extra?.tower ? { code: extra.tower } : {}),
                },
              },
            },
          }
        : {}),
      ...(trimmed
        ? {
            unit: {
              OR: [
                { unitNumber: { contains: trimmed, mode: "insensitive" } },
                { floor: { tower: { name: { contains: trimmed, mode: "insensitive" } } } },
              ],
            },
          }
        : {}),
    },
    include: {
      unit: {
        include: {
          floorPlanType: { select: { carpetArea: true, superArea: true } },
          floor: {
            include: {
              tower: {
                include: { project: { select: { id: true, name: true } } },
              },
            },
          },
          costSheetTemplate: true,
          bookings: {
            where: { userId, status: BookingStatus.PENDING },
            take: 1,
            select: { id: true, status: true },
          },
        },
      },
    },
    orderBy: { expiresAt: "asc" },
  });

  return blocks.map((b) => ({
    id: b.id,
    unitId: b.unitId,
    expiresAt: b.expiresAt.toISOString(),
    projectId: b.unit.floor.tower.project.id,
    projectName: b.unit.floor.tower.project.name,
    pendingApproval: b.unit.bookings.length > 0,
    unit: {
      id: b.unit.id,
      unitNumber: b.unit.unitNumber,
      towerName: b.unit.floor.tower.name,
      bhkType: b.unit.bhkType,
      carpetArea: b.unit.carpetArea ?? b.unit.floorPlanType?.carpetArea ?? null,
      superArea: b.unit.floorPlanType?.superArea ?? null,
      price: b.unit.costSheetTemplate ? Number(b.unit.costSheetTemplate.totalPrice) : null,
    },
  }));
}

export async function createBlock(unitId: string, userId: string, isAdmin = false) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  return prisma.$transaction(async (tx) => {
    const unit = await tx.unit.findUnique({
      where: { id: unitId },
      include: {
        floor: { include: { tower: { include: { project: true } } } },
        blocks: { where: { expiresAt: { gt: new Date() } } },
      },
    });

    if (!unit) throw new BlockError("Unit not found", "NOT_FOUND");

    const activeBooking = await tx.booking.findFirst({
      where: {
        unitId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });
    if (activeBooking) throw new BlockError("Unit is already booked", "NOT_AVAILABLE");

    if (unit.status === UnitStatus.BOOKED || unit.status === UnitStatus.SOLD) {
      throw new BlockError("Unit is not available", "NOT_AVAILABLE");
    }
    if (unit.status === UnitStatus.HOLD && !isAdmin) {
      throw new BlockError("Unit is on hold", "NOT_AVAILABLE");
    }

    const activeBlock = unit.blocks[0];
    if (activeBlock && activeBlock.userId !== userId && !isAdmin) {
      throw new BlockError("Unit is blocked by another user", "NOT_AVAILABLE");
    }
    if (activeBlock && activeBlock.userId === userId) {
      return { block: activeBlock, projectId: unit.floor.tower.projectId, unitNumber: unit.unitNumber };
    }

    const project = unit.floor.tower.project;

    if (!isAdmin && project.lifecycleStatus === "UPCOMING") {
      throw new BlockError("Blocking is disabled until launch day", "BLOCKING_DISABLED");
    }

    if (!isAdmin) {
      const activeCount = await tx.block.count({
        where: {
          userId,
          expiresAt: { gt: new Date() },
          unit: { floor: { tower: { projectId: project.id } } },
        },
      });

      if (activeCount >= project.maxBlocksPerUser) {
        throw new BlockError(
          `You can only block ${project.maxBlocksPerUser} units at a time`,
          "MAX_BLOCKS"
        );
      }
    }

    const expiresAt = new Date(Date.now() + project.blockDurationMs);

    const block = await tx.block.create({
      data: {
        unitId,
        userId,
        expiresAt,
        isAdmin,
      },
    });

    await tx.unit.update({
      where: { id: unitId },
      data: { status: UnitStatus.BLOCKED },
    });

    await createAuditLog(
      {
        action: AuditAction.UNIT_BLOCKED,
        entityType: "Unit",
        entityId: unitId,
        userId,
        metadata: { blockId: block.id, expiresAt: expiresAt.toISOString(), projectId: project.id },
      },
      tx
    );

    await createActivity(
      {
        projectId: project.id,
        userId,
        message: `${user?.name ?? "User"} blocked ${unit.unitNumber}`,
        unitId,
      },
      tx
    );

    return { block, projectId: project.id, unitNumber: unit.unitNumber, userName: user?.name };
  }, { timeout: 15000, maxWait: 10000 });
}

export async function releaseBlock(blockId: string, userId: string, force = false) {
  return prisma.$transaction(async (tx) => {
    const block = await tx.block.findUnique({
      where: { id: blockId },
      include: {
        unit: { include: { floor: { include: { tower: true } } } },
        user: { select: { name: true } },
      },
    });

    if (!block) throw new BlockError("Block not found", "NOT_FOUND");
    if (!force && block.userId !== userId) {
      throw new BlockError("You can only release your own blocks", "NOT_OWNER");
    }

    if (!force) {
      const pendingBooking = await tx.booking.findFirst({
        where: {
          unitId: block.unitId,
          userId: block.userId,
          status: BookingStatus.PENDING,
        },
      });
      if (pendingBooking) {
        throw new BlockError(
          "Cannot release while booking is pending admin approval",
          "PENDING_BOOKING"
        );
      }
    }

    await tx.block.delete({ where: { id: blockId } });

    const otherBlocks = await tx.block.count({
      where: { unitId: block.unitId, expiresAt: { gt: new Date() } },
    });

    const activeBooking = await tx.booking.findFirst({
      where: {
        unitId: block.unitId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    });

    if (!activeBooking && otherBlocks === 0) {
      await tx.unit.update({
        where: { id: block.unitId },
        data: { status: UnitStatus.AVAILABLE },
      });
    }

    await createAuditLog(
      {
        action: force ? AuditAction.FORCE_RELEASE : AuditAction.UNIT_RELEASED,
        entityType: "Unit",
        entityId: block.unitId,
        userId,
        metadata: { blockId },
      },
      tx
    );

    await createActivity(
      {
        projectId: block.unit.floor.tower.projectId,
        userId,
        message: `${block.user.name} released ${block.unit.unitNumber}`,
        unitId: block.unitId,
      },
      tx
    );

    return {
      unitId: block.unitId,
      unitNumber: block.unit.unitNumber,
      projectId: block.unit.floor.tower.projectId,
    };
  });
}

export async function expireBlocks() {
  const expired = await prisma.block.findMany({
    where: { expiresAt: { lte: new Date() } },
    include: {
      unit: { include: { floor: { include: { tower: true } } } },
      user: { select: { name: true } },
    },
  });

  for (const block of expired) {
    await prisma.$transaction(async (tx) => {
      const pendingBooking = await tx.booking.findFirst({
        where: { unitId: block.unitId, status: BookingStatus.PENDING },
      });
      if (pendingBooking) return;

      await tx.block.delete({ where: { id: block.id } });

      const remaining = await tx.block.count({
        where: { unitId: block.unitId, expiresAt: { gt: new Date() } },
      });

      const activeBooking = await tx.booking.findFirst({
        where: {
          unitId: block.unitId,
          status: { in: [BookingStatus.CONFIRMED] },
        },
      });

      if (!activeBooking && remaining === 0) {
        await tx.unit.update({
          where: { id: block.unitId },
          data: { status: UnitStatus.AVAILABLE },
        });
      }

      await createActivity(
        {
          projectId: block.unit.floor.tower.projectId,
          message: `Unit ${block.unit.unitNumber} has been released`,
          unitId: block.unitId,
        },
        tx
      );
    });
  }

  return expired.map((b) => ({
    unitId: b.unitId,
    unitNumber: b.unit.unitNumber,
    projectId: b.unit.floor.tower.projectId,
  }));
}
