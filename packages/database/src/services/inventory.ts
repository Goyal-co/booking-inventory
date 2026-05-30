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
      floorPlanTypes: {
        select: {
          id: true,
          name: true,
          bhkType: true,
          carpetArea: true,
          superArea: true,
          balconyArea: true,
          sizeType: true,
          imageUrl: true,
          pdfUrl: true,
          amenities: true,
        },
      },
      costSheetTemplates: {
        select: { id: true, name: true, totalPrice: true, floorPlanTypeId: true },
      },
      towers: {
        orderBy: { sortOrder: "asc" },
        include: {
          unitStackTemplates: {
            orderBy: { stackNumber: "asc" },
            include: {
              floorPlanType: { select: { id: true, name: true, bhkType: true, superArea: true } },
              costSheetTemplate: { select: { id: true, name: true, totalPrice: true } },
            },
          },
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
      unitStackTemplates: t.unitStackTemplates.map((s) => ({
        id: s.id,
        stackNumber: s.stackNumber,
        floorPlanTypeId: s.floorPlanTypeId,
        costSheetTemplateId: s.costSheetTemplateId,
        sizeType: s.sizeType,
        activeFromFloor: s.activeFromFloor,
        activeToFloor: s.activeToFloor,
        floorPlanType: s.floorPlanType,
        costSheetTemplate: {
          ...s.costSheetTemplate,
          totalPrice: s.costSheetTemplate.totalPrice.toString(),
        },
      })),
      floors: t.floors.map((f) => ({
        id: f.id,
        number: f.number,
        label: f.label,
        unitCount: f.units.length,
        units: f.units.map((u) => {
          const plan = project.floorPlanTypes.find((p) => p.id === u.floorPlanTypeId);
          return {
            ...u,
            priceOverride: u.priceOverride ? Number(u.priceOverride) : null,
            superArea: plan?.superArea ?? null,
          };
        }),
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

export function formatUnitNumber(towerCode: string, floorNum: number, stackNumber: number) {
  return `${towerCode}-${floorNum}-${String(stackNumber).padStart(2, "0")}`;
}

export async function generateInventory(input: {
  towerId: string;
  fromFloor: number;
  toFloor: number;
  stacks: Array<{
    stackNumber: number;
    floorPlanTypeId: string;
    costSheetTemplateId: string;
    sizeType: string;
    activeFromFloor: number;
    activeToFloor: number;
  }>;
  saveTemplate?: boolean;
}) {
  const tower = await prisma.tower.findUnique({
    where: { id: input.towerId },
    include: { project: true },
  });
  if (!tower) throw new InventoryError("Tower not found", "NOT_FOUND");

  const planIds = [...new Set(input.stacks.map((s) => s.floorPlanTypeId))];
  const costIds = [...new Set(input.stacks.map((s) => s.costSheetTemplateId))];
  const [plans, costSheets] = await Promise.all([
    prisma.floorPlanType.findMany({ where: { id: { in: planIds }, projectId: tower.projectId } }),
    prisma.costSheetTemplate.findMany({ where: { id: { in: costIds }, projectId: tower.projectId } }),
  ]);
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const costMap = new Map(costSheets.map((c) => [c.id, c]));

  for (const stack of input.stacks) {
    if (!planMap.has(stack.floorPlanTypeId) || !costMap.has(stack.costSheetTemplateId)) {
      throw new InventoryError("Invalid floor plan or cost sheet for this project", "NOT_FOUND");
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (let floorNum = input.fromFloor; floorNum <= input.toFloor; floorNum++) {
    const floor = await prisma.floor.upsert({
      where: { towerId_number: { towerId: input.towerId, number: floorNum } },
      update: {},
      create: { number: floorNum, label: `Floor ${floorNum}`, towerId: input.towerId },
    });

    for (const stack of input.stacks) {
      if (floorNum < stack.activeFromFloor || floorNum > stack.activeToFloor) continue;

      const plan = planMap.get(stack.floorPlanTypeId)!;
      const costSheet = costMap.get(stack.costSheetTemplateId)!;
      const unitNumber = formatUnitNumber(tower.code, floorNum, stack.stackNumber);

      const existing = await prisma.unit.findUnique({
        where: { floorId_unitNumber: { floorId: floor.id, unitNumber } },
      });

      if (existing && existing.status !== UnitStatus.AVAILABLE) {
        skipped++;
        continue;
      }

      const unitData = {
        floorPlanTypeId: stack.floorPlanTypeId,
        costSheetTemplateId: stack.costSheetTemplateId,
        bhkType: plan.bhkType,
        carpetArea: plan.carpetArea,
        basePrice: costSheet.totalPrice,
      };

      if (existing) {
        await prisma.unit.update({ where: { id: existing.id }, data: unitData });
        updated++;
      } else {
        await prisma.unit.create({
          data: {
            unitNumber,
            floorId: floor.id,
            status: UnitStatus.AVAILABLE,
            ...unitData,
          },
        });
        created++;
      }
    }
  }

  if (input.saveTemplate) {
    await prisma.unitStackTemplate.deleteMany({ where: { towerId: input.towerId } });
    await prisma.unitStackTemplate.createMany({
      data: input.stacks.map((s, idx) => ({
        towerId: input.towerId,
        stackNumber: s.stackNumber,
        floorPlanTypeId: s.floorPlanTypeId,
        costSheetTemplateId: s.costSheetTemplateId,
        sizeType: s.sizeType,
        activeFromFloor: s.activeFromFloor,
        activeToFloor: s.activeToFloor,
        sortOrder: idx,
      })),
    });
  }

  return { created, updated, skipped };
}

export async function deleteFloorPlanType(planId: string, projectId: string, organizationId: string) {
  const plan = await prisma.floorPlanType.findFirst({
    where: { id: planId, projectId, project: { organizationId } },
    include: { _count: { select: { units: true } } },
  });
  if (!plan) throw new InventoryError("Floor plan not found", "NOT_FOUND");
  if (plan._count.units > 0) {
    throw new InventoryError("Cannot delete floor plan assigned to units", "IN_USE");
  }
  await prisma.floorPlanType.delete({ where: { id: planId } });
  return { success: true };
}
