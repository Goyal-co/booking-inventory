import { prisma, UnitStatus, AuditAction, BookingStatus } from "../index";
import { createAuditLog } from "./audit";
import { createActivity } from "./activity";
import { createBlock, releaseBlock } from "./blocks";

export class InventoryError extends Error {
  constructor(
    message: string,
    public code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "IN_USE"
  ) {
    super(message);
  }
}

async function resolvePlanAndCost(floorPlanTypeId: string, costSheetTemplateId: string) {
  const [plan, costSheet] = await Promise.all([
    prisma.floorPlanType.findUnique({ where: { id: floorPlanTypeId } }),
    prisma.costSheetTemplate.findUnique({ where: { id: costSheetTemplateId } }),
  ]);
  if (!plan || !costSheet) {
    throw new InventoryError("Floor plan or cost sheet not found", "NOT_FOUND");
  }
  return { plan, costSheet };
}


export async function getInventoryStructure(projectId: string, organizationId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
    include: {
      floorPlanTypes: { select: { id: true, name: true, bhkType: true, carpetArea: true } },
      costSheetTemplates: {
        select: { id: true, name: true, totalPrice: true, floorPlanTypeId: true },
      },
      towers: {
        orderBy: { sortOrder: "asc" },
        include: {
          floors: {
            orderBy: { number: "asc" },
            include: {
              units: {
                orderBy: { unitNumber: "asc" },
                select: {
                  id: true,
                  unitNumber: true,
                  status: true,
                  bhkType: true,
                  facing: true,
                  remarks: true,
                  priceOverride: true,
                  floorPlanTypeId: true,
                  costSheetTemplateId: true,
                  carpetArea: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) throw new InventoryError("Project not found", "NOT_FOUND");

  return {
    floorPlanTypes: project.floorPlanTypes,
    costSheetTemplates: project.costSheetTemplates.map((c) => ({
      ...c,
      totalPrice: c.totalPrice.toString(),
    })),
    towers: project.towers.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      floors: t.floors.map((f) => ({
        id: f.id,
        number: f.number,
        label: f.label,
        unitCount: f.units.length,
        units: f.units.map((u) => ({
          ...u,
          priceOverride: u.priceOverride ? Number(u.priceOverride) : null,
        })),
      })),
    })),
  };
}

export async function createUnit(
  input: {
    towerId: string;
    floorNumber: number;
    unitNumber: string;
    floorPlanTypeId: string;
    costSheetTemplateId: string;
    facing?: string;
    remarks?: string;
    priceOverride?: number;
  },
  userId: string,
  organizationId: string
) {
  const tower = await prisma.tower.findFirst({
    where: { id: input.towerId, project: { organizationId } },
    include: { project: true },
  });
  if (!tower) throw new InventoryError("Tower not found", "NOT_FOUND");

  const { plan, costSheet } = await resolvePlanAndCost(
    input.floorPlanTypeId,
    input.costSheetTemplateId
  );

  const floor = await prisma.floor.upsert({
    where: { towerId_number: { towerId: input.towerId, number: input.floorNumber } },
    update: {},
    create: {
      number: input.floorNumber,
      label: `Floor ${input.floorNumber}`,
      towerId: input.towerId,
    },
  });

  const existing = await prisma.unit.findUnique({
    where: { floorId_unitNumber: { floorId: floor.id, unitNumber: input.unitNumber } },
  });
  if (existing) {
    throw new InventoryError("Unit number already exists on this floor", "CONFLICT");
  }

  const unit = await prisma.unit.create({
    data: {
      unitNumber: input.unitNumber,
      floorId: floor.id,
      floorPlanTypeId: input.floorPlanTypeId,
      costSheetTemplateId: input.costSheetTemplateId,
      bhkType: plan.bhkType,
      carpetArea: plan.carpetArea,
      basePrice: costSheet.totalPrice,
      facing: input.facing,
      remarks: input.remarks,
      priceOverride: input.priceOverride,
      status: UnitStatus.AVAILABLE,
    },
  });

  await createAuditLog({
    action: AuditAction.INVENTORY_UPDATED,
    entityType: "Unit",
    entityId: unit.id,
    userId,
    metadata: { action: "create", unitId: unit.id, unitNumber: unit.unitNumber },
  });

  await createActivity({
    projectId: tower.projectId,
    userId,
    message: `Admin added unit ${unit.unitNumber}`,
    unitId: unit.id,
  });

  return { unit, projectId: tower.projectId };
}

export async function updateUnit(
  unitId: string,
  input: {
    unitNumber?: string;
    floorPlanTypeId?: string;
    costSheetTemplateId?: string;
    facing?: string;
    remarks?: string;
    priceOverride?: number | null;
    status?: UnitStatus;
  },
  userId: string,
  organizationId: string
) {
  const existing = await prisma.unit.findFirst({
    where: {
      id: unitId,
      floor: { tower: { project: { organizationId } } },
    },
    include: { floor: { include: { tower: true } } },
  });
  if (!existing) throw new InventoryError("Unit not found", "NOT_FOUND");

  if (input.unitNumber && input.unitNumber !== existing.unitNumber) {
    const dup = await prisma.unit.findUnique({
      where: {
        floorId_unitNumber: { floorId: existing.floorId, unitNumber: input.unitNumber },
      },
    });
    if (dup) throw new InventoryError("Unit number already exists on this floor", "CONFLICT");
  }

  const updateData: Record<string, unknown> = {};
  if (input.unitNumber !== undefined) updateData.unitNumber = input.unitNumber;
  if (input.facing !== undefined) updateData.facing = input.facing;
  if (input.remarks !== undefined) updateData.remarks = input.remarks;
  if (input.priceOverride !== undefined) updateData.priceOverride = input.priceOverride;
  if (input.status !== undefined) updateData.status = input.status;

  if (input.floorPlanTypeId) {
    const plan = await prisma.floorPlanType.findUnique({ where: { id: input.floorPlanTypeId } });
    if (!plan) throw new InventoryError("Floor plan not found", "NOT_FOUND");
    updateData.floorPlanTypeId = input.floorPlanTypeId;
    updateData.bhkType = plan.bhkType;
    updateData.carpetArea = plan.carpetArea;
  }

  if (input.costSheetTemplateId) {
    const costSheet = await prisma.costSheetTemplate.findUnique({
      where: { id: input.costSheetTemplateId },
    });
    if (!costSheet) throw new InventoryError("Cost sheet not found", "NOT_FOUND");
    updateData.costSheetTemplateId = input.costSheetTemplateId;
    if (input.priceOverride === undefined) updateData.basePrice = costSheet.totalPrice;
  }

  const unit = await prisma.unit.update({
    where: { id: unitId },
    data: updateData,
  });

  await createAuditLog({
    action: AuditAction.INVENTORY_UPDATED,
    entityType: "Unit",
    entityId: unitId,
    userId,
    metadata: { action: "update", unitId, ...input },
  });

  return { unit, projectId: existing.floor.tower.projectId };
}

export async function deleteUnit(
  unitId: string,
  userId: string,
  organizationId: string,
  reason?: string
) {
  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      floor: { tower: { project: { organizationId } } },
    },
    include: {
      floor: { include: { tower: true } },
      blocks: { where: { expiresAt: { gt: new Date() } } },
    },
  });
  if (!unit) throw new InventoryError("Unit not found", "NOT_FOUND");

  if (unit.status === UnitStatus.BOOKED || unit.status === UnitStatus.SOLD) {
    throw new InventoryError(`Cannot delete unit with status ${unit.status}`, "IN_USE");
  }

  const activeBooking = await prisma.booking.findFirst({
    where: {
      unitId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
  });
  if (activeBooking) {
    throw new InventoryError("Cannot delete unit with an active booking", "IN_USE");
  }

  if (unit.blocks.length > 0) {
    throw new InventoryError("Cannot delete unit with an active block", "IN_USE");
  }

  const floorId = unit.floorId;
  const projectId = unit.floor.tower.projectId;
  const unitNumber = unit.unitNumber;

  await prisma.unit.delete({ where: { id: unitId } });

  const remainingUnits = await prisma.unit.count({ where: { floorId } });
  if (remainingUnits === 0) {
    await prisma.floor.delete({ where: { id: floorId } });
  }

  await createAuditLog({
    action: AuditAction.INVENTORY_UPDATED,
    entityType: "Unit",
    entityId: unitId,
    userId,
    metadata: { action: "delete", unitId, unitNumber, reason: reason ?? null },
  });

  await createActivity({
    projectId,
    userId,
    message: `Admin removed unit ${unitNumber}`,
  });

  return { unitId, projectId, unitNumber };
}

export async function suggestNextUnitNumber(towerCode: string, floorNumber: number, floorId: string) {
  const units = await prisma.unit.findMany({
    where: { floorId },
    select: { unitNumber: true },
    orderBy: { unitNumber: "desc" },
  });
  const prefix = `${towerCode}-${floorNumber}`;
  let maxIndex = 0;
  for (const u of units) {
    const match = u.unitNumber.match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
  }
  return `${prefix}${String(maxIndex + 1).padStart(2, "0")}`;
}

export async function massBlockAction(
  projectId: string,
  unitIds: string[],
  action: "block" | "unblock" | "hold" | "release_hold",
  userId: string,
  durationMs?: number
) {
  const results = [];

  for (const unitId of unitIds) {
    if (action === "block") {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (project && durationMs) {
        await prisma.project.update({
          where: { id: projectId },
          data: { blockDurationMs: durationMs },
        });
      }
      const result = await createBlock(unitId, userId, true);
      results.push(result);
    } else if (action === "unblock") {
      const block = await prisma.block.findFirst({
        where: { unitId, expiresAt: { gt: new Date() } },
      });
      if (block) {
        await releaseBlock(block.id, userId, true);
      }
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.AVAILABLE },
      });
      results.push({ unitId });
    } else if (action === "hold") {
      await prisma.block.deleteMany({ where: { unitId } });
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.HOLD },
      });
      results.push({ unitId });
    } else if (action === "release_hold") {
      await prisma.unit.update({
        where: { id: unitId },
        data: { status: UnitStatus.AVAILABLE },
      });
      results.push({ unitId });
    }
  }

  await createAuditLog({
    action: action === "block" ? AuditAction.MASS_BLOCK : AuditAction.MASS_UNBLOCK,
    entityType: "Project",
    entityId: projectId,
    userId,
    metadata: { unitIds, action },
  });

  await createActivity({
    projectId,
    userId,
    message: `Admin performed mass ${action} on ${unitIds.length} units`,
  });

  return results;
}

export async function bulkAssignInventory(
  unitIds: string[],
  data: {
    floorPlanTypeId?: string;
    costSheetTemplateId?: string;
    status?: UnitStatus;
  },
  userId: string
) {
  const updateData: Record<string, unknown> = {};
  if (data.floorPlanTypeId) updateData.floorPlanTypeId = data.floorPlanTypeId;
  if (data.costSheetTemplateId) {
    updateData.costSheetTemplateId = data.costSheetTemplateId;
    const costSheet = await prisma.costSheetTemplate.findUnique({
      where: { id: data.costSheetTemplateId },
    });
    if (costSheet) updateData.basePrice = costSheet.totalPrice;
  }
  if (data.status) updateData.status = data.status;

  if (data.floorPlanTypeId) {
    const plan = await prisma.floorPlanType.findUnique({ where: { id: data.floorPlanTypeId } });
    if (plan) {
      updateData.bhkType = plan.bhkType;
      updateData.carpetArea = plan.carpetArea;
    }
  }

  await prisma.unit.updateMany({
    where: { id: { in: unitIds } },
    data: updateData,
  });

  await createAuditLog({
    action: AuditAction.INVENTORY_UPDATED,
    entityType: "Unit",
    entityId: unitIds.join(","),
    userId,
    metadata: { unitIds, ...data },
  });

  return { updated: unitIds.length };
}

export async function generateInventory(input: {
  towerId: string;
  fromFloor: number;
  toFloor: number;
  unitsPerFloor: number;
  floorPlanTypeId: string;
  costSheetTemplateId: string;
}) {
  const tower = await prisma.tower.findUnique({
    where: { id: input.towerId },
    include: { project: true },
  });
  if (!tower) throw new Error("Tower not found");

  const plan = await prisma.floorPlanType.findUnique({ where: { id: input.floorPlanTypeId } });
  const costSheet = await prisma.costSheetTemplate.findUnique({ where: { id: input.costSheetTemplateId } });
  if (!plan || !costSheet) throw new Error("Plan or cost sheet not found");

  let created = 0;

  for (let floorNum = input.fromFloor; floorNum <= input.toFloor; floorNum++) {
    const floor = await prisma.floor.upsert({
      where: { towerId_number: { towerId: input.towerId, number: floorNum } },
      update: {},
      create: { number: floorNum, label: `Floor ${floorNum}`, towerId: input.towerId },
    });

    for (let i = 1; i <= input.unitsPerFloor; i++) {
      const unitNumber = `${tower.code}-${floorNum}${String(i).padStart(2, "0")}`;
      await prisma.unit.upsert({
        where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
        update: {
          floorPlanTypeId: input.floorPlanTypeId,
          costSheetTemplateId: input.costSheetTemplateId,
          bhkType: plan.bhkType,
          carpetArea: plan.carpetArea,
          basePrice: costSheet.totalPrice,
        },
        create: {
          unitNumber,
          floorId: floor.id,
          floorPlanTypeId: input.floorPlanTypeId,
          costSheetTemplateId: input.costSheetTemplateId,
          bhkType: plan.bhkType,
          carpetArea: plan.carpetArea,
          basePrice: costSheet.totalPrice,
          status: UnitStatus.AVAILABLE,
        },
      });
      created++;
    }
  }

  return { created };
}
