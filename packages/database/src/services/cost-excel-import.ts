import { Prisma } from "@prisma/client";
import { prisma } from "../index";
import {
  inventoryUnitMatches,
  mapExcelRowToUnitPayload,
  normalizeExcelHeader,
  resolveSaleableAreaSqft,
  validateRequiredMappings,
  type ColumnMapTarget,
  type MappedUnitRowPayload,
} from "./cost-excel-utils";

export interface ImportRowError {
  rowIndex: number;
  message: string;
  tower?: string;
  unitNo?: string;
}

export interface CostExcelImportResult {
  imported: number;
  skipped: number;
  errors: ImportRowError[];
  batchId: string;
  warnings: string[];
}

function buildUnitMasterData(
  projectId: string,
  payload: MappedUnitRowPayload,
  batchId: string,
  fileName: string,
  existingImported?: Record<string, number | string> | null
): Prisma.UnitMasterRowCreateInput | null {
  if (!payload.tower?.trim() || !payload.unitNo?.trim()) return null;
  const saleableSqft = resolveSaleableAreaSqft(payload);
  if (!saleableSqft || saleableSqft <= 0) return null;

  const mergedImported = {
    ...(existingImported && typeof existingImported === "object" ? existingImported : {}),
    ...payload.importedValues,
  };

  return {
    project: { connect: { id: projectId } },
    tower: payload.tower.trim(),
    unitNo: payload.unitNo.trim(),
    floor: payload.floor ?? 0,
    configuration: payload.configuration?.trim() ?? "",
    saleableAreaSqft: saleableSqft,
    saleableAreaSqm: payload.saleableAreaSqm ?? null,
    carpetAreaSqft: payload.carpetAreaSqft ?? null,
    carpetAreaSqm: payload.carpetAreaSqm ?? null,
    balconyAreaSqft: payload.balconyAreaSqft ?? null,
    balconyAreaSqm: payload.balconyAreaSqm ?? null,
    baseRatePerSqft: payload.baseRatePerSqft ?? null,
    premiumCharges: payload.premiumCharges ?? null,
    status: payload.status ?? null,
    importedValues: Object.keys(mergedImported).length ? mergedImported : Prisma.JsonNull,
    sourceFileName: fileName,
    importedAt: new Date(),
    importBatch: { connect: { id: batchId } },
  };
}

export async function executeCostExcelImport(params: {
  projectId: string;
  fileName: string;
  createdById?: string;
  columnMap: Record<string, ColumnMapTarget>;
  mappingSnapshot: Record<string, unknown>;
  rows: Array<Record<string, unknown>>;
  headerRowIndex: number;
  skipInventoryCheck?: boolean;
}): Promise<CostExcelImportResult> {
  const {
    projectId,
    fileName,
    createdById,
    columnMap,
    mappingSnapshot,
    rows,
    headerRowIndex,
    skipInventoryCheck = false,
  } = params;

  const lineDefinitions = await prisma.costSheetLineDefinition.findMany({
    where: { projectId },
    select: { id: true, label: true, role: true, systemField: true, isRequired: true },
  });

  const mappingErrors = validateRequiredMappings(columnMap, lineDefinitions);
  if (mappingErrors.length > 0) {
    throw new Error(mappingErrors.join("; "));
  }

  const batch = await prisma.costExcelImportBatch.create({
    data: {
      projectId,
      fileName,
      rowCount: 0,
      mappingSnapshot: mappingSnapshot as Prisma.InputJsonValue,
      createdById,
      errors: Prisma.JsonNull,
    },
  });

  const errors: ImportRowError[] = [];
  const warnings: string[] = [];
  let imported = 0;
  let skipped = 0;

  const inventoryUnits = skipInventoryCheck
    ? []
    : await prisma.unit.findMany({
        where: { floor: { tower: { projectId } } },
        select: {
          unitNumber: true,
          floor: { select: { tower: { select: { name: true } } } },
        },
      });
  const inventoryKeys = inventoryUnits.map((u) => ({
    tower: u.floor.tower.name,
    unitNumber: u.unitNumber,
  }));

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const normalizedCells: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      normalizedCells[normalizeExcelHeader(k)] = v;
    }

    const payload = mapExcelRowToUnitPayload(normalizedCells, columnMap, lineDefinitions);

    if (!payload.tower || !payload.unitNo) {
      skipped++;
      errors.push({
        rowIndex: headerRowIndex + i + 1,
        message: "Missing tower or unit number after mapping",
        tower: payload.tower,
        unitNo: payload.unitNo,
      });
      continue;
    }

    const saleableSqft = resolveSaleableAreaSqft(payload);
    if (!saleableSqft || saleableSqft <= 0) {
      skipped++;
      errors.push({
        rowIndex: headerRowIndex + i + 1,
        message: "Missing or invalid saleable area",
        tower: payload.tower,
        unitNo: payload.unitNo,
      });
      continue;
    }

    if (!skipInventoryCheck && payload.tower && payload.unitNo) {
      const hasInventory = inventoryKeys.some((u) =>
        inventoryUnitMatches(payload.tower!, payload.unitNo!, u.tower, u.unitNumber)
      );
      if (!hasInventory) {
        warnings.push(`Row ${headerRowIndex + i + 1}: no inventory unit for ${payload.tower} / ${payload.unitNo}`);
      }
    }

    const existing = await prisma.unitMasterRow.findUnique({
      where: {
        projectId_tower_unitNo: {
          projectId,
          tower: payload.tower.trim(),
          unitNo: payload.unitNo.trim(),
        },
      },
      select: { importedValues: true },
    });

    const createData = buildUnitMasterData(
      projectId,
      payload,
      batch.id,
      fileName,
      existing?.importedValues as Record<string, number | string> | null
    );

    if (!createData) {
      skipped++;
      continue;
    }

    await prisma.unitMasterRow.upsert({
      where: {
        projectId_tower_unitNo: {
          projectId,
          tower: payload.tower.trim(),
          unitNo: payload.unitNo.trim(),
        },
      },
      create: createData,
      update: {
        floor: createData.floor,
        configuration: createData.configuration,
        saleableAreaSqft: createData.saleableAreaSqft,
        saleableAreaSqm: createData.saleableAreaSqm,
        carpetAreaSqft: createData.carpetAreaSqft,
        carpetAreaSqm: createData.carpetAreaSqm,
        balconyAreaSqft: createData.balconyAreaSqft,
        balconyAreaSqm: createData.balconyAreaSqm,
        baseRatePerSqft: createData.baseRatePerSqft,
        premiumCharges: createData.premiumCharges,
        status: createData.status,
        importedValues: createData.importedValues,
        sourceFileName: fileName,
        importedAt: new Date(),
        importBatchId: batch.id,
      },
    });

    imported++;
  }

  await prisma.costExcelImportBatch.update({
    where: { id: batch.id },
    data: {
      rowCount: imported,
      errors: errors.length ? (errors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return {
    imported,
    skipped,
    errors,
    batchId: batch.id,
    warnings: warnings.slice(0, 50),
  };
}
