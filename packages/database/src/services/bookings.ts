import {
  prisma,
  UnitStatus,
  AuditAction,
  BookingStatus,
  Prisma,
} from "../index";
import { BlockError } from "./blocks";
import { createAuditLog } from "./audit";
import { createActivity } from "./activity";

export class BookingError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

const PENDING_BLOCK_EXTENSION_MS = 48 * 60 * 60 * 1000;

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

async function getActiveBookingForUnit(
  tx: Prisma.TransactionClient,
  unitId: string
) {
  return tx.booking.findFirst({
    where: { unitId, status: { in: ACTIVE_BOOKING_STATUSES } },
  });
}

function buildCostSheetSnapshot(
  costSheet: { name: string; lineItems: unknown; totalPrice: Prisma.Decimal } | null
): Prisma.InputJsonValue {
  return costSheet
    ? {
        name: costSheet.name,
        lineItems: costSheet.lineItems as Prisma.InputJsonValue,
        totalPrice: Number(costSheet.totalPrice),
      }
    : { name: "Default", lineItems: [], totalPrice: 0 };
}

export async function submitBooking(
  blockId: string,
  userId: string,
  customerName: string,
  customerPhone: string
) {
  return prisma.$transaction(async (tx) => {
    const block = await tx.block.findUnique({
      where: { id: blockId },
      include: {
        unit: {
          include: {
            floor: { include: { tower: { include: { project: true } } } },
            costSheetTemplate: true,
          },
        },
        user: { select: { name: true } },
      },
    });

    if (!block) throw new BookingError("Block not found", "NOT_FOUND");
    if (block.userId !== userId) throw new BookingError("Not your block", "NOT_OWNER");
    if (block.expiresAt <= new Date()) throw new BookingError("Block has expired", "EXPIRED");

    const existingActive = await getActiveBookingForUnit(tx, block.unitId);
    if (existingActive) {
      throw new BookingError("Unit already booked or pending approval", "ALREADY_BOOKED");
    }

    const projectId = block.unit.floor.tower.projectId;
    const projectSettings = await tx.project.findUnique({
      where: { id: projectId },
      select: { requiresBookingApproval: true, name: true },
    });
    if (!projectSettings) throw new BookingError("Project not found", "NOT_FOUND");

    const costSheet = block.unit.costSheetTemplate;
    const costSheetSnapshot = buildCostSheetSnapshot(costSheet);
    const requiresApproval = projectSettings.requiresBookingApproval === true;

    if (requiresApproval) {
      const booking = await tx.booking.create({
        data: {
          unitId: block.unitId,
          userId,
          customerName,
          customerPhone,
          costSheetSnapshot,
          totalPrice: costSheet?.totalPrice ?? 0,
          status: BookingStatus.PENDING,
          submittedAt: new Date(),
        },
      });

      await tx.block.update({
        where: { id: blockId },
        data: {
          expiresAt: new Date(Date.now() + PENDING_BLOCK_EXTENSION_MS),
        },
      });

      // Unit must stay BLOCKED until admin approves — never BOOKED while pending.
      await tx.unit.update({
        where: { id: block.unitId },
        data: { status: UnitStatus.BLOCKED },
      });

      await createAuditLog(
        {
          action: AuditAction.BOOKING_SUBMITTED,
          entityType: "Booking",
          entityId: booking.id,
          userId,
          metadata: { unitId: block.unitId, customerName, projectId },
        },
        tx
      );

      await createActivity(
        {
          projectId,
          userId,
          message: `${block.user.name} submitted booking for ${block.unit.unitNumber} (pending approval)`,
          unitId: block.unitId,
        },
        tx
      );

      return {
        booking,
        pending: true as const,
        unitId: block.unitId,
        unitNumber: block.unit.unitNumber,
        projectId,
      };
    }

    const booking = await tx.booking.create({
      data: {
        unitId: block.unitId,
        userId,
        customerName,
        customerPhone,
        costSheetSnapshot,
        totalPrice: costSheet?.totalPrice ?? 0,
        status: BookingStatus.CONFIRMED,
      },
    });

    await tx.unit.update({
      where: { id: block.unitId },
      data: { status: UnitStatus.BOOKED },
    });

    await tx.block.deleteMany({ where: { unitId: block.unitId } });

    await createAuditLog(
      {
        action: AuditAction.UNIT_BOOKED,
        entityType: "Booking",
        entityId: booking.id,
        userId,
        metadata: { unitId: block.unitId, customerName },
      },
      tx
    );

    await createActivity(
      {
        projectId: block.unit.floor.tower.projectId,
        userId,
        message: `${block.user.name} booked ${block.unit.unitNumber}`,
        unitId: block.unitId,
      },
      tx
    );

    return {
      booking,
      pending: false as const,
      unitId: block.unitId,
      unitNumber: block.unit.unitNumber,
      projectId: block.unit.floor.tower.projectId,
    };
  });
}

/** @deprecated Use submitBooking */
export const createBooking = submitBooking;

export async function approveBooking(bookingId: string, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { include: { floor: { include: { tower: true } } } },
        user: { select: { name: true } },
      },
    });

    if (!booking) throw new BookingError("Booking not found", "NOT_FOUND");
    if (booking.status !== BookingStatus.PENDING) {
      throw new BookingError("Only pending bookings can be approved", "INVALID_STATUS");
    }

    const projectId = booking.unit.floor.tower.projectId;
    const now = new Date();

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CONFIRMED,
        reviewedById: adminUserId,
        reviewedAt: now,
        bookedAt: now,
      },
    });

    await tx.unit.update({
      where: { id: booking.unitId },
      data: { status: UnitStatus.BOOKED },
    });

    await tx.block.deleteMany({ where: { unitId: booking.unitId } });

    await createAuditLog(
      {
        action: AuditAction.BOOKING_APPROVED,
        entityType: "Booking",
        entityId: bookingId,
        userId: adminUserId,
        metadata: {
          unitId: booking.unitId,
          customerName: booking.customerName,
          salesUserId: booking.userId,
        },
      },
      tx
    );

    await createActivity(
      {
        projectId,
        userId: adminUserId,
        message: `Booking approved for ${booking.unit.unitNumber} (${booking.customerName})`,
        unitId: booking.unitId,
      },
      tx
    );

    return {
      booking: updated,
      unitId: booking.unitId,
      unitNumber: booking.unit.unitNumber,
      projectId,
    };
  });
}

export async function rejectBooking(
  bookingId: string,
  adminUserId: string,
  comment: string
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { include: { floor: { include: { tower: true } } } },
        user: { select: { name: true } },
      },
    });

    if (!booking) throw new BookingError("Booking not found", "NOT_FOUND");
    if (booking.status !== BookingStatus.PENDING) {
      throw new BookingError("Only pending bookings can be rejected", "INVALID_STATUS");
    }

    const projectId = booking.unit.floor.tower.projectId;
    const now = new Date();

    const updated = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.REJECTED,
        adminComment: comment,
        reviewedById: adminUserId,
        reviewedAt: now,
      },
    });

    await tx.unit.update({
      where: { id: booking.unitId },
      data: { status: UnitStatus.AVAILABLE },
    });

    await tx.block.deleteMany({ where: { unitId: booking.unitId } });

    await createAuditLog(
      {
        action: AuditAction.BOOKING_REJECTED,
        entityType: "Booking",
        entityId: bookingId,
        userId: adminUserId,
        metadata: {
          unitId: booking.unitId,
          customerName: booking.customerName,
          salesUserId: booking.userId,
          comment,
        },
      },
      tx
    );

    await createActivity(
      {
        projectId,
        userId: adminUserId,
        message: `Booking rejected for ${booking.unit.unitNumber} (${booking.customerName})`,
        unitId: booking.unitId,
      },
      tx
    );

    return {
      booking: updated,
      unitId: booking.unitId,
      unitNumber: booking.unit.unitNumber,
      projectId,
    };
  });
}

export async function getBookingsForUser(userId: string, projectId?: string, search?: string) {
  const trimmed = search?.trim();
  return prisma.booking.findMany({
    where: {
      userId,
      ...(projectId ? { unit: { floor: { tower: { projectId } } } } : {}),
      ...(trimmed
        ? {
            OR: [
              { customerName: { contains: trimmed, mode: "insensitive" } },
              { customerPhone: { contains: trimmed, mode: "insensitive" } },
              { unit: { unitNumber: { contains: trimmed, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      unit: {
        include: {
          floor: {
            include: {
              tower: {
                include: { project: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getAllBookings(
  projectId?: string,
  organizationId?: string,
  status?: BookingStatus,
  search?: string,
  projectIds?: string[]
) {
  const trimmed = search?.trim();
  const projectFilter = projectId
    ? { unit: { floor: { tower: { projectId } } } }
    : projectIds && projectIds.length > 0
      ? { unit: { floor: { tower: { projectId: { in: projectIds } } } } }
      : organizationId
        ? { unit: { floor: { tower: { project: { organizationId } } } } }
        : {};

  return prisma.booking.findMany({
    where: {
      ...(status ? { status } : {}),
      ...projectFilter,
      ...(trimmed
        ? {
            OR: [
              { customerName: { contains: trimmed, mode: "insensitive" } },
              { customerPhone: { contains: trimmed, mode: "insensitive" } },
              { unit: { unitNumber: { contains: trimmed, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      unit: {
        include: {
          floor: {
            include: {
              tower: {
                include: { project: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { submittedAt: "desc" },
  });
}

export async function countPendingBookings(
  organizationId: string,
  projectId?: string
) {
  return prisma.booking.count({
    where: {
      status: BookingStatus.PENDING,
      ...(projectId
        ? { unit: { floor: { tower: { projectId } } } }
        : { unit: { floor: { tower: { project: { organizationId } } } } }),
    },
  });
}

export async function cancelBooking(
  bookingId: string,
  adminUserId: string,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        unit: { include: { floor: { include: { tower: true } } } },
        user: { select: { name: true } },
      },
    });

    if (!booking) throw new BookingError("Booking not found", "NOT_FOUND");
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BookingError("Only confirmed bookings can be cancelled", "INVALID_STATUS");
    }

    const projectId = booking.unit.floor.tower.projectId;

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    await tx.unit.update({
      where: { id: booking.unitId },
      data: { status: UnitStatus.AVAILABLE },
    });

    await createAuditLog(
      {
        action: AuditAction.BOOKING_CANCELLED,
        entityType: "Booking",
        entityId: bookingId,
        userId: adminUserId,
        metadata: {
          unitId: booking.unitId,
          customerName: booking.customerName,
          salesUserId: booking.userId,
          reason: reason ?? null,
        },
      },
      tx
    );

    await createActivity(
      {
        projectId,
        userId: adminUserId,
        message: `Admin cancelled booking for ${booking.unit.unitNumber}`,
        unitId: booking.unitId,
      },
      tx
    );

    return {
      unitId: booking.unitId,
      unitNumber: booking.unit.unitNumber,
      projectId,
    };
  });
}
