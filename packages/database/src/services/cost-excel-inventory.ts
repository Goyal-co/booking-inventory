import { UnitStatus } from "@prisma/client";
import { prisma } from "../index";
import type { MappedUnitRowPayload } from "./cost-excel-utils";
import { inventoryUnitMatches, resolveSaleableAreaSqft } from "./cost-excel-utils";

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

/** Create towers, floors, and units from parsed MASTER SHEET rows. */
export async function createInventoryFromExcelRows(
  projectId: string,
  payloads: MappedUnitRowPayload[]
): Promise<{ createdUnits: number; towersCreated: number; skipped: number }> {
  const towerGroups = new Map<string, MappedUnitRowPayload[]>();

  for (const payload of payloads) {
    if (!payload.tower?.trim() || !payload.unitNo?.trim()) continue;
    const saleableSqft = resolveSaleableAreaSqft(payload);
    if (!saleableSqft || saleableSqft <= 0) continue;
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

      const saleableSqft = resolveSaleableAreaSqft(payload) ?? 0;
      const carpetSqft = payload.carpetAreaSqft ?? saleableSqft;
      const baseRate = payload.baseRatePerSqft ?? 0;
      const basePrice =
        baseRate > 0 && saleableSqft > 0 ? Math.round(baseRate * saleableSqft) : null;

      await prisma.unit.create({
        data: {
          unitNumber: unitNo,
          floorId: floor.id,
          bhkType: payload.configuration?.trim() || null,
          carpetArea: Math.round(carpetSqft),
          basePrice,
          status: UnitStatus.AVAILABLE,
        },
      });
      createdUnits += 1;
    }
  }

  return { createdUnits, towersCreated, skipped };
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
