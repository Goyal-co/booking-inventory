import { UnitStatus } from "@prisma/client";
import { prisma } from "../index";
import type { MappedUnitRowPayload } from "./cost-excel-utils";
import {
  inventoryUnitMatches,
  normalizeUnitStatus,
  resolveSaleableAreaSqft,
} from "./cost-excel-utils";

export function towerCodeFromName(name: string): string {
  const trimmed = name.trim();
  const wingMatch = trimmed.match(/^(?:wing|tower|block|phase|building)\s*[-:]?\s*(.+)$/i);
  const core = wingMatch ? wingMatch[1] : trimmed;
  const code = core.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return code.slice(0, 12) || "T1";
}

/** Remove all towers, floors, units, and master rows for a project (bookings/blocks cascade). */
export async function clearProjectInventory(projectId: string) {
  const unitCount = await prisma.unit.count({
    where: { floor: { tower: { projectId } } },
  });

  const towerIds = (
    await prisma.tower.findMany({
      where: { projectId },
      select: { id: true },
    })
  ).map((t) => t.id);

  if (towerIds.length > 0) {
    await prisma.unitStackTemplate.deleteMany({ where: { towerId: { in: towerIds } } });
  }

  await prisma.unit.deleteMany({ where: { floor: { tower: { projectId } } } });
  await prisma.floor.deleteMany({ where: { tower: { projectId } } });
  await prisma.tower.deleteMany({ where: { projectId } });
  await prisma.unitMasterRow.deleteMany({ where: { projectId } });

  return { deletedUnits: unitCount, deletedTowers: towerIds.length };
}

async function findInventoryUnitId(projectId: string, tower: string, unitNo: string) {
  const units = await prisma.unit.findMany({
    where: {
      unitNumber: unitNo.trim(),
      floor: { tower: { projectId } },
    },
    select: {
      id: true,
      unitNumber: true,
      floor: { select: { tower: { select: { name: true } } } },
    },
  });

  const match = units.find((u) =>
    inventoryUnitMatches(tower, unitNo, u.floor.tower.name, u.unitNumber)
  );
  return match?.id ?? null;
}

function unitFieldsFromPayload(payload: MappedUnitRowPayload) {
  const saleableSqft = resolveSaleableAreaSqft(payload);
  // Carpet stays carpet; saleable / SBA goes to superArea — never copy saleable into carpet.
  const carpetSqft =
    payload.carpetAreaSqft != null && Number.isFinite(Number(payload.carpetAreaSqft))
      ? Number(payload.carpetAreaSqft)
      : null;
  const baseRate = payload.baseRatePerSqft ?? 0;
  const basePrice =
    baseRate > 0 && saleableSqft != null && saleableSqft > 0
      ? Math.round(baseRate * saleableSqft)
      : null;
  const status = normalizeUnitStatus(payload.status);

  return {
    bhkType: payload.configuration?.trim() || null,
    carpetArea: carpetSqft != null ? Math.round(carpetSqft) : null,
    superArea: saleableSqft != null && saleableSqft > 0 ? Math.round(saleableSqft) : null,
    basePrice,
    status,
  };
}

/** Create towers, floors, and units from parsed MASTER SHEET rows. Saleable/SBA is optional. */
export async function createInventoryFromExcelRows(
  projectId: string,
  payloads: MappedUnitRowPayload[]
): Promise<{ createdUnits: number; towersCreated: number; skipped: number }> {
  const towerGroups = new Map<string, MappedUnitRowPayload[]>();

  for (const payload of payloads) {
    if (!payload.tower?.trim() || !payload.unitNo?.trim()) continue;
    const towerName = payload.tower.trim();
    if (!towerGroups.has(towerName)) towerGroups.set(towerName, []);
    towerGroups.get(towerName)!.push(payload);
  }

  let createdUnits = 0;
  let towersCreated = 0;
  let skipped = 0;
  const usedCodes = new Set<string>();

  const towerNames = [...towerGroups.keys()].sort();
  for (const towerName of towerNames) {
    const rows = towerGroups.get(towerName)!;
    let code = towerCodeFromName(towerName);
    let suffix = 1;
    while (usedCodes.has(code)) {
      code = `${towerCodeFromName(towerName)}${suffix}`;
      suffix += 1;
    }
    usedCodes.add(code);

    const tower = await prisma.tower.create({
      data: {
        projectId,
        name: towerName,
        code,
        sortOrder: towersCreated,
      },
    });
    towersCreated += 1;

    for (const payload of rows) {
      const unitNo = payload.unitNo!.trim();
      const floorNum = payload.floor != null && Number.isFinite(payload.floor) ? payload.floor : 1;

      const floor = await prisma.floor.upsert({
        where: { towerId_number: { towerId: tower.id, number: floorNum } },
        update: {},
        create: {
          number: floorNum,
          label: floorNum === 0 ? "Ground" : `Floor ${floorNum}`,
          towerId: tower.id,
        },
      });

      const existing = await prisma.unit.findUnique({
        where: { floorId_unitNumber: { floorId: floor.id, unitNumber: unitNo } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const fields = unitFieldsFromPayload(payload);

      await prisma.unit.create({
        data: {
          unitNumber: unitNo,
          floorId: floor.id,
          bhkType: fields.bhkType,
          carpetArea: fields.carpetArea,
          superArea: fields.superArea,
          basePrice: fields.basePrice,
          status: fields.status ?? UnitStatus.AVAILABLE,
        },
      });
      createdUnits += 1;
    }
  }

  return { createdUnits, towersCreated, skipped };
}

/**
 * Update existing inventory units from Excel payloads:
 * - saleable → Unit.superArea (SBA)
 * - carpet → Unit.carpetArea
 * - status → Unit.status when a known alias is present
 */
export async function updateInventoryFromExcelRows(
  projectId: string,
  payloads: MappedUnitRowPayload[]
): Promise<{ updated: number; skipped: number }> {
  let updated = 0;
  let skipped = 0;

  for (const payload of payloads) {
    if (!payload.tower?.trim() || !payload.unitNo?.trim()) {
      skipped += 1;
      continue;
    }

    const unitId = await findInventoryUnitId(projectId, payload.tower, payload.unitNo);
    if (!unitId) {
      skipped += 1;
      continue;
    }

    const fields = unitFieldsFromPayload(payload);
    const data: {
      bhkType?: string | null;
      carpetArea?: number | null;
      superArea?: number | null;
      basePrice?: number | null;
      status?: UnitStatus;
    } = {};

    if (payload.configuration != null && String(payload.configuration).trim() !== "") {
      data.bhkType = fields.bhkType;
    }
    if (payload.carpetAreaSqft != null || payload.carpetAreaSqm != null) {
      data.carpetArea = fields.carpetArea;
    }
    if (payload.saleableAreaSqft != null || payload.saleableAreaSqm != null) {
      data.superArea = fields.superArea;
    }
    if (fields.basePrice != null) {
      data.basePrice = fields.basePrice;
    }
    if (fields.status) {
      data.status = fields.status;
    }

    if (Object.keys(data).length === 0) {
      skipped += 1;
      continue;
    }

    await prisma.unit.update({ where: { id: unitId }, data });
    updated += 1;
  }

  return { updated, skipped };
}

export async function linkMasterRowsToInventoryUnits(projectId: string) {
  const masters = await prisma.unitMasterRow.findMany({
    where: { projectId },
    select: { id: true, tower: true, unitNo: true },
  });

  let linked = 0;
  for (const row of masters) {
    const unitId = await findInventoryUnitId(projectId, row.tower, row.unitNo);
    if (!unitId) continue;
    await prisma.unitMasterRow.update({
      where: { id: row.id },
      data: { unitId },
    });
    linked += 1;
  }
  return { linked };
}
