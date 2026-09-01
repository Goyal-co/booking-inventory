import { CostExcelPricingMode, CostSheetLineCalcMode, Prisma, type CostSheetLineRole } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../index";
import { inferAutoColumnMap, pickMasterSheetName, RIVIERA_FULL_LINE_DEFINITIONS } from "./cost-excel-auto-map";
import { executeCostExcelImport } from "./cost-excel-import";
import {
  clearProjectInventory,
  createInventoryFromExcelRows,
  linkMasterRowsToInventoryUnits,
} from "./cost-excel-inventory";
import { extractRowsFromXlsxBuffer, listSheetNames, getSheetUsedColumnCount, expandHeaderCells } from "./cost-excel-parse";
import { clearLiveExcelCache, fetchWorkbookBufferForSync } from "./cost-excel-live";
import {
  buildExcelColumnDescriptors,
  buildExcelColumnMappingRows,
  columnMapCoversSystemField,
  mapExcelRowToUnitPayload,
  mergeExcelColumnMaps,
  remapColumnMapToHeaders,
  normalizeExcelHeader,
  parseSystemFieldTarget,
  resolveColumnMapTargetLabel,
  resolveSaleableAreaSqft,
  type ExcelColumnMappingRow,
  type MappedUnitRowPayload,
} from "./cost-excel-utils";
import {
  calculateCostSheet,
  getUnitPricingContext,
  type CostSheetResult,
} from "./cost-sheet-engine";

export interface ExcelSyncPreviewColumn {
  key: string;
  label: string;
  kind: "system" | "line";
}

export interface ExcelSyncPreviewRow {
  tower: string;
  unitNo: string;
  values: Record<string, number | string | null>;
}

export interface InventoryPreviewUnit {
  id: string;
  unitNumber: string;
  towerName: string;
  towerCode: string;
  status: string;
  configuration: string;
  floor: number;
  saleableAreaSqft: number;
  baseRatePerSqft: number | null;
  hasMasterRow: boolean;
}

export interface ExcelSyncPreview {
  rowCount: number;
  sampleRows: ExcelSyncPreviewRow[];
  previewColumns: ExcelSyncPreviewColumn[];
  inventoryUnits: InventoryPreviewUnit[];
  sampleUnit?: { id: string; unitNumber: string; towerName: string };
  costSheet?: CostSheetResult | null;
}

export interface ExcelColumnMappingPreview {
  rows: ExcelColumnMappingRow[];
  columnMap: Record<string, string>;
  mappedCount: number;
  unmappedCount: number;
  autoMappedCount: number;
  adminMappedCount: number;
}

export interface ExcelSyncResult {
  imported: number;
  skipped: number;
  sheetName: string;
  sheetNames?: string[];
  headerRowIndex: number;
  columnMapCount: number;
  batchId: string;
  errors: Array<{ rowIndex: number; message: string }>;
  warnings: string[];
  inventory?: {
    deletedUnits: number;
    deletedTowers: number;
    createdUnits: number;
    towersCreated: number;
    inventorySkipped: number;
    masterRowsLinked: number;
  };
  preview?: ExcelSyncPreview;
  columnMapping?: ExcelColumnMappingPreview;
  /** Wing / Villa No not mapped yet — map columns then sync again */
  mappingRequired?: boolean;
}

function suggestHeaderRow(
  buffer: Buffer,
  sheetName: string,
  lineDefinitions: Array<{ label: string; systemField?: string | null }>
): number {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 2;
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  const keywords = new Set<string>();
  for (const def of lineDefinitions) {
    const label = normalizeExcelHeader(def.label).toLowerCase();
    if (label) keywords.add(label);
    if (def.systemField) keywords.add(def.systemField.toLowerCase());
  }
  keywords.add("villa");
  keywords.add("wing");
  keywords.add("tower");
  keywords.add("unit");
  keywords.add("salable");
  keywords.add("saleable");
  keywords.add("area");
  keywords.add("rate");

  const unitHintLabels = lineDefinitions
    .filter((d) => d.systemField === "unitNo")
    .map((d) => normalizeExcelHeader(d.label).toLowerCase())
    .filter(Boolean);
  const towerHintLabels = lineDefinitions
    .filter((d) => d.systemField === "tower")
    .map((d) => normalizeExcelHeader(d.label).toLowerCase())
    .filter(Boolean);

  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    const row = rawRows[i] ?? [];
    const cells = row.map((c) => normalizeExcelHeader(String(c ?? "")));
    const nonEmpty = cells.filter((c) => c.length > 0);
    if (nonEmpty.length < 3) continue;

    const text = cells.join(" ").toLowerCase();
    const keywordHits = [...keywords].filter((k) => text.includes(k)).length;
    const hasUnit =
      unitHintLabels.some((l) => text.includes(l)) ||
      /\b(villa|unit|apartment|flat)\b/.test(text);
    const hasTower =
      towerHintLabels.some((l) => text.includes(l)) ||
      /\b(wing|tower|block)\b/.test(text);
    const hasArea = /salable|saleable|super built|builtup|sq\.?ft|sq\.?mt|area/.test(text);

    if (hasUnit && hasTower && (keywordHits >= 2 || hasArea)) {
      return i + 1;
    }
    if (nonEmpty.length >= 5 && hasUnit && hasArea) {
      return i + 1;
    }
  }
  return 2;
}

async function prepareExcelColumnMapping(
  projectId: string,
  buffer: Buffer,
  lineDefinitions: Array<{ id: string; key: string; label: string; role: string; systemField?: string | null }>,
  sheetName?: string,
  headerRowIndex?: number,
  columnMapOverride?: Record<string, string> | null
) {
  const sheetNames = listSheetNames(buffer);
  const resolvedSheet = sheetName ?? pickMasterSheetName(sheetNames);
  const resolvedHeaderRow =
    headerRowIndex ?? suggestHeaderRow(buffer, resolvedSheet, lineDefinitions);

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[resolvedSheet]!;
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  }) as unknown[][];
  const headerRow = rawRows[resolvedHeaderRow - 1] ?? [];
  const columnCount = getSheetUsedColumnCount(sheet, rawRows);
  const rawHeaders = expandHeaderCells(headerRow, columnCount);

  const existing = await prisma.projectCostExcelMapping.findUnique({ where: { projectId } });
  const rawSavedMap =
    columnMapOverride ??
    ((existing?.columnMap as Record<string, string> | null) ?? null);
  const savedMap = remapColumnMapToHeaders(rawSavedMap, rawHeaders);
  const autoMap = inferAutoColumnMap(rawHeaders, lineDefinitions);
  const columnMap = mergeExcelColumnMaps(autoMap, savedMap);
  const rows = extractRowsFromXlsxBuffer(buffer, resolvedSheet, resolvedHeaderRow);
  const sampleRow = rows[0];
  const mappingRows = buildExcelColumnMappingRows(
    rawHeaders,
    columnMap,
    autoMap,
    savedMap,
    lineDefinitions,
    sampleRow
  );

  const mappedCount = mappingRows.filter((r) => r.mappedTo).length;
  const unmappedCount = mappingRows.length - mappedCount;
  const autoMappedCount = mappingRows.filter((r) => r.source === "auto").length;
  const adminMappedCount = mappingRows.filter((r) => r.source === "admin").length;

  return {
    resolvedSheet,
    resolvedHeaderRow,
    sheetNames,
    rawHeaders,
    rows,
    columnMap,
    autoMap,
    savedMap,
    mappingRows,
    columnMapping: {
      rows: mappingRows,
      columnMap,
      mappedCount,
      unmappedCount,
      autoMappedCount,
      adminMappedCount,
    },
  };
}


function buildPreviewColumns(
  columnMap: Record<string, string>,
  lineDefinitions: Array<{ id: string; key: string; label: string; systemField?: string | null }>
): ExcelSyncPreviewColumn[] {
  const columns: ExcelSyncPreviewColumn[] = [
    { key: "tower", label: "Tower / Wing", kind: "system" },
    { key: "unitNo", label: "Unit No", kind: "system" },
  ];
  const seen = new Set<string>(["tower", "unitNo"]);
  const targets = new Set(Object.values(columnMap));

  for (const target of targets) {
    const sf = parseSystemFieldTarget(target);
    if (sf && !seen.has(sf)) {
      seen.add(sf);
      columns.push({ key: sf, label: resolveColumnMapTargetLabel(`systemField:${sf}`, lineDefinitions), kind: "system" });
      continue;
    }
    const line = lineDefinitions.find((d) => d.id === target);
    if (line && !seen.has(line.id)) {
      seen.add(line.id);
      columns.push({ key: line.id, label: line.label, kind: "line" });
    }
  }

  return columns;
}

function payloadPreviewValue(
  payload: MappedUnitRowPayload,
  column: ExcelSyncPreviewColumn,
  lineDefinitions: Array<{ id: string; key: string }>
): number | string | null {
  if (column.kind === "system") {
    const sf = column.key;
    if (sf === "tower") return payload.tower ?? null;
    if (sf === "unitNo") return payload.unitNo ?? null;
    if (sf === "floor") return payload.floor ?? null;
    if (sf === "configuration") return payload.configuration ?? null;
    if (sf === "status") return payload.status ?? null;
    if (sf === "saleableAreaSqft") return resolveSaleableAreaSqft(payload) ?? null;
    if (sf === "saleableAreaSqm") return payload.saleableAreaSqm ?? null;
    if (sf === "carpetAreaSqft") return payload.carpetAreaSqft ?? null;
    if (sf === "carpetAreaSqm") return payload.carpetAreaSqm ?? null;
    if (sf === "balconyAreaSqft") return payload.balconyAreaSqft ?? null;
    if (sf === "balconyAreaSqm") return payload.balconyAreaSqm ?? null;
    if (sf === "baseRatePerSqft") return payload.baseRatePerSqft ?? null;
    if (sf === "premiumCharges") return payload.premiumCharges ?? null;
    return null;
  }
  const v = payload.importedValues[column.key];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

async function buildExcelSyncPreview(
  projectId: string,
  payloads: MappedUnitRowPayload[],
  lineDefinitions: Array<{ id: string; key: string; label: string; systemField?: string | null }>,
  columnMap: Record<string, string>
): Promise<ExcelSyncPreview> {
  const previewColumns = buildPreviewColumns(columnMap, lineDefinitions);
  const validPayloads = payloads.filter((p) => p.tower && p.unitNo);

  const sampleRows: ExcelSyncPreviewRow[] = validPayloads.slice(0, 25).map((p) => {
    const values: Record<string, number | string | null> = {};
    for (const col of previewColumns) {
      values[col.key] = payloadPreviewValue(p, col, lineDefinitions);
    }
    return {
      tower: p.tower ?? "",
      unitNo: p.unitNo ?? "",
      values,
    };
  });

  const inventoryUnits = await listProjectInventoryPreviewUnits(projectId);
  const defaultUnit =
    inventoryUnits.find((u) => u.status === "AVAILABLE") ?? inventoryUnits[0];

  let costSheet: CostSheetResult | null = null;
  if (defaultUnit) {
    costSheet = await previewProjectCostSheet(defaultUnit.id);
  }

  return {
    rowCount: validPayloads.length,
    sampleRows,
    previewColumns,
    inventoryUnits,
    sampleUnit: defaultUnit
      ? {
          id: defaultUnit.id,
          unitNumber: defaultUnit.unitNumber,
          towerName: defaultUnit.towerName,
        }
      : undefined,
    costSheet,
  };
}

/** Parse Excel URL and return row preview without importing (for link testing). */
export async function previewExcelFromUrl(params: {
  projectId: string;
  excelSourceUrl: string;
  sheetName?: string;
  headerRowIndex?: number;
  columnMapOverride?: Record<string, string> | null;
}): Promise<
  ExcelSyncPreview & {
    sheetName: string;
    headerRowIndex: number;
    columnMapCount: number;
    columnMapping: ExcelColumnMappingPreview;
    mappingRequired?: boolean;
  }
> {
  const result = await extractProjectExcelFromUrl({
    projectId: params.projectId,
    excelSourceUrl: params.excelSourceUrl,
    sheetName: params.sheetName,
    headerRowIndex: params.headerRowIndex,
    columnMapOverride: params.columnMapOverride,
  });
  if (!result.preview || !result.columnMapping) {
    throw new Error("Failed to build Excel preview");
  }
  return {
    ...result.preview,
    sheetName: result.sheetName,
    headerRowIndex: result.headerRowIndex,
    columnMapCount: result.columnMapCount,
    columnMapping: result.columnMapping,
    mappingRequired: result.mappingRequired,
  };
}

export async function ensureProjectLineDefinitionsIfEmpty(projectId: string) {
  const count = await prisma.costSheetLineDefinition.count({ where: { projectId } });
  if (count > 0) return;

  await prisma.$transaction(
    RIVIERA_FULL_LINE_DEFINITIONS.map((row) => {
      const r = row as {
        key: string;
        label: string;
        role: string;
        systemField?: string;
        calcMode?: string;
        includeInGross?: boolean;
        isRequired?: boolean;
        sortOrder: number;
      };
      return prisma.costSheetLineDefinition.upsert({
        where: { projectId_key: { projectId, key: r.key } },
        create: {
          projectId,
          key: r.key,
          label: r.label,
          role: r.role as CostSheetLineRole,
          systemField: r.systemField ?? null,
          calcMode: (r.calcMode as CostSheetLineCalcMode | undefined) ?? null,
          includeInGross: r.includeInGross ?? false,
          isRequired: r.isRequired ?? false,
          sortOrder: r.sortOrder,
        },
        update: {
          label: r.label,
          role: r.role as CostSheetLineRole,
          systemField: r.systemField ?? null,
          calcMode: (r.calcMode as CostSheetLineCalcMode | undefined) ?? null,
          includeInGross: r.includeInGross ?? false,
          isRequired: r.isRequired ?? false,
          sortOrder: r.sortOrder,
        },
      });
    })
  );
}

/** @deprecated Use ensureProjectLineDefinitionsIfEmpty — kept for existing imports */
export async function ensureRivieraLineDefinitions(projectId: string) {
  return ensureProjectLineDefinitionsIfEmpty(projectId);
}

/**
 * Load Excel preview + column mapping only (no import, no inventory changes).
 */
export async function extractProjectExcelWorkbook(params: {
  projectId: string;
  buffer: Buffer;
  sourceLabel: string;
  excelSourceUrl?: string | null;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  const {
    projectId,
    buffer,
    sourceLabel,
    excelSourceUrl,
    createdById,
    sheetName,
    headerRowIndex,
    columnMapOverride,
  } = params;

  await ensureProjectLineDefinitionsIfEmpty(projectId);

  const lineDefinitions = await prisma.costSheetLineDefinition.findMany({
    where: { projectId },
    select: { id: true, key: true, label: true, role: true, systemField: true },
  });

  const prepared = await prepareExcelColumnMapping(
    projectId,
    buffer,
    lineDefinitions,
    sheetName,
    headerRowIndex,
    columnMapOverride
  );
  const { columnMap, rows, resolvedSheet, resolvedHeaderRow, columnMapping, sheetNames } = prepared;

  const hasUnit = columnMapCoversSystemField(columnMap, "unitNo", lineDefinitions);
  const hasTower = columnMapCoversSystemField(columnMap, "tower", lineDefinitions);
  const mappingComplete = hasUnit && hasTower;
  const warnings: string[] = [];

  if (!hasUnit) {
    warnings.push("Map an Excel column to Unit No (tower + unit identity).");
  }
  if (!hasTower) {
    warnings.push("Map an Excel column to Tower / Wing (tower + unit identity).");
  }
  if (!mappingComplete) {
    warnings.push("After mapping, click Sync to inventory to import units and pricing.");
  }

  const liveUrl = excelSourceUrl?.trim() || null;
  const pricingMode = liveUrl ? CostExcelPricingMode.LIVE : CostExcelPricingMode.IMPORT;

  await prisma.projectCostExcelMapping.upsert({
    where: { projectId },
    create: {
      projectId,
      sheetName: resolvedSheet,
      headerRowIndex: resolvedHeaderRow,
      columnMap: columnMap as Prisma.InputJsonValue,
      pricingMode,
      excelSourceUrl: liveUrl,
      updatedById: createdById,
    },
    update: {
      sheetName: resolvedSheet,
      headerRowIndex: resolvedHeaderRow,
      columnMap: columnMap as Prisma.InputJsonValue,
      pricingMode,
      excelSourceUrl: liveUrl,
      updatedById: createdById,
    },
  });

  const payloads = rows.map((row) => mapExcelRowToUnitPayload(row, columnMap, lineDefinitions));
  const preview = await buildExcelSyncPreview(projectId, payloads, lineDefinitions, columnMap);

  return {
    imported: 0,
    skipped: rows.length,
    sheetName: resolvedSheet,
    sheetNames,
    headerRowIndex: resolvedHeaderRow,
    columnMapCount: Object.keys(columnMap).length,
    batchId: "",
    errors: [],
    warnings,
    preview,
    columnMapping,
    mappingRequired: !mappingComplete,
  };
}

export async function extractProjectExcelFromBuffer(params: {
  projectId: string;
  buffer: Buffer;
  fileName: string;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  return extractProjectExcelWorkbook({
    projectId: params.projectId,
    buffer: params.buffer,
    sourceLabel: params.fileName,
    excelSourceUrl: null,
    createdById: params.createdById,
    sheetName: params.sheetName,
    headerRowIndex: params.headerRowIndex,
    columnMapOverride: params.columnMapOverride,
  });
}

export async function extractProjectExcelFromUrl(params: {
  projectId: string;
  excelSourceUrl: string;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  clearLiveExcelCache(params.projectId);
  const buffer = await fetchWorkbookBufferForSync(params.excelSourceUrl);
  return extractProjectExcelWorkbook({
    projectId: params.projectId,
    buffer,
    sourceLabel: params.excelSourceUrl,
    excelSourceUrl: params.excelSourceUrl,
    createdById: params.createdById,
    sheetName: params.sheetName,
    headerRowIndex: params.headerRowIndex,
    columnMapOverride: params.columnMapOverride,
  });
}

/**
 * Sync workbook buffer — import pricing + inventory (requires Wing + Villa No mapped).
 */
export async function syncProjectExcelWorkbook(params: {
  projectId: string;
  buffer: Buffer;
  sourceLabel: string;
  excelSourceUrl?: string | null;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  replaceInventory?: boolean;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  const {
    projectId,
    buffer,
    sourceLabel,
    excelSourceUrl,
    createdById,
    sheetName,
    headerRowIndex,
    replaceInventory = true,
    columnMapOverride,
  } = params;

  await ensureProjectLineDefinitionsIfEmpty(projectId);

  const lineDefinitions = await prisma.costSheetLineDefinition.findMany({
    where: { projectId },
    select: { id: true, key: true, label: true, role: true, systemField: true },
  });

  const prepared = await prepareExcelColumnMapping(
    projectId,
    buffer,
    lineDefinitions,
    sheetName,
    headerRowIndex,
    columnMapOverride
  );
  const { columnMap, rows, resolvedSheet, resolvedHeaderRow, columnMapping, sheetNames } = prepared;
  const columns = buildExcelColumnDescriptors(prepared.rawHeaders);

  const hasUnit = columnMapCoversSystemField(columnMap, "unitNo", lineDefinitions);
  const hasTower = columnMapCoversSystemField(columnMap, "tower", lineDefinitions);
  const mappingComplete = hasUnit && hasTower;

  if (!mappingComplete) {
    throw new Error(
      "Map Wing and Villa/Unit No columns first: click Load preview, map columns below, then Sync to inventory."
    );
  }

  const syncWarnings: string[] = [];
  const effectiveReplaceInventory = replaceInventory;

  const liveUrl = excelSourceUrl?.trim() || null;
  const pricingMode = liveUrl ? CostExcelPricingMode.LIVE : CostExcelPricingMode.IMPORT;

  await prisma.projectCostExcelMapping.upsert({
    where: { projectId },
    create: {
      projectId,
      sheetName: resolvedSheet,
      headerRowIndex: resolvedHeaderRow,
      columnMap: columnMap as Prisma.InputJsonValue,
      pricingMode,
      excelSourceUrl: liveUrl,
      updatedById: createdById,
    },
    update: {
      sheetName: resolvedSheet,
      headerRowIndex: resolvedHeaderRow,
      columnMap: columnMap as Prisma.InputJsonValue,
      pricingMode,
      excelSourceUrl: liveUrl,
      updatedById: createdById,
    },
  });

  const payloads = rows.map((row) => mapExcelRowToUnitPayload(row, columnMap, lineDefinitions));

  let inventoryStats: ExcelSyncResult["inventory"] | undefined;
  if (effectiveReplaceInventory) {
    const cleared = await clearProjectInventory(projectId);
    const created = await createInventoryFromExcelRows(projectId, payloads);
    inventoryStats = {
      deletedUnits: cleared.deletedUnits,
      deletedTowers: cleared.deletedTowers,
      createdUnits: created.createdUnits,
      towersCreated: created.towersCreated,
      inventorySkipped: created.skipped,
      masterRowsLinked: 0,
    };
  }

  const importResult = await executeCostExcelImport({
    projectId,
    fileName: sourceLabel,
    createdById,
    columnMap,
    mappingSnapshot: {
      sheetName: resolvedSheet,
      headerRowIndex: resolvedHeaderRow,
      columnMap,
      autoMapped: true,
      replaceInventory,
      columns: columns.map((c) => c.label),
    },
    rows,
    headerRowIndex: resolvedHeaderRow,
    skipInventoryCheck: effectiveReplaceInventory,
  });

  const allWarnings = [...syncWarnings, ...importResult.warnings];

  if (effectiveReplaceInventory) {
    const linked = await linkMasterRowsToInventoryUnits(projectId);
    if (inventoryStats) inventoryStats.masterRowsLinked = linked.linked;
  }

  const preview = await buildExcelSyncPreview(projectId, payloads, lineDefinitions, columnMap);

  return {
    imported: importResult.imported,
    skipped: importResult.skipped,
    sheetName: resolvedSheet,
    sheetNames,
    headerRowIndex: resolvedHeaderRow,
    columnMapCount: Object.keys(columnMap).length,
    batchId: importResult.batchId,
    errors: importResult.errors,
    warnings: allWarnings,
    inventory: inventoryStats,
    preview,
    columnMapping,
    mappingRequired: false,
  };
}

/** Sync from uploaded .xlsx bytes (no live URL). */
export async function syncProjectExcelFromBuffer(params: {
  projectId: string;
  buffer: Buffer;
  fileName: string;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  replaceInventory?: boolean;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  return syncProjectExcelWorkbook({
    projectId: params.projectId,
    buffer: params.buffer,
    sourceLabel: params.fileName,
    excelSourceUrl: null,
    createdById: params.createdById,
    sheetName: params.sheetName,
    headerRowIndex: params.headerRowIndex,
    replaceInventory: params.replaceInventory,
    columnMapOverride: params.columnMapOverride,
  });
}

/**
 * Sync all unit pricing from Excel URL — auto-detect MASTER SHEET columns (no manual mapping).
 */
export async function syncProjectExcelFromUrl(params: {
  projectId: string;
  excelSourceUrl: string;
  createdById?: string;
  sheetName?: string;
  headerRowIndex?: number;
  /** Replace all project inventory with units from Excel MASTER SHEET */
  replaceInventory?: boolean;
  columnMapOverride?: Record<string, string> | null;
}): Promise<ExcelSyncResult> {
  const {
    projectId,
    excelSourceUrl,
    createdById,
    sheetName,
    headerRowIndex,
    replaceInventory = true,
    columnMapOverride,
  } = params;

  clearLiveExcelCache(projectId);
  const buffer = await fetchWorkbookBufferForSync(excelSourceUrl);
  return syncProjectExcelWorkbook({
    projectId,
    buffer,
    sourceLabel: excelSourceUrl,
    excelSourceUrl,
    createdById,
    sheetName,
    headerRowIndex,
    replaceInventory,
    columnMapOverride,
  });
}

/** List inventory units with pricing context for admin preview. */
export async function listProjectInventoryPreviewUnits(
  projectId: string
): Promise<InventoryPreviewUnit[]> {
  const units = await prisma.unit.findMany({
    where: { floor: { tower: { projectId } } },
    orderBy: [{ floor: { tower: { name: "asc" } } }, { unitNumber: "asc" }],
    select: {
      id: true,
      unitNumber: true,
      status: true,
      bhkType: true,
      basePrice: true,
      floor: { select: { number: true, tower: { select: { name: true, code: true } } } },
    },
  });

  const masterRows = await prisma.unitMasterRow.findMany({
    where: { projectId },
    select: { tower: true, unitNo: true },
  });
  const masterKeys = new Set(
    masterRows.map((r) => `${r.tower.trim().toLowerCase()}::${r.unitNo.trim().toLowerCase()}`)
  );

  const results: InventoryPreviewUnit[] = [];
  for (const unit of units) {
    const ctx = await getUnitPricingContext(unit.id);
    const towerName = unit.floor.tower.name;
    const hasMasterRow = masterKeys.has(
      `${towerName.trim().toLowerCase()}::${unit.unitNumber.trim().toLowerCase()}`
    );
    let baseRate = ctx?.saleablePricePerSqft ?? null;
    if (!baseRate || baseRate <= 0) {
      const saleable = ctx?.saleableAreaSqft ?? 0;
      if (unit.basePrice && saleable > 0) {
        baseRate = Number(unit.basePrice) / saleable;
      }
    }

    results.push({
      id: unit.id,
      unitNumber: unit.unitNumber,
      towerName,
      towerCode: unit.floor.tower.code,
      status: unit.status,
      configuration: ctx?.configuration ?? unit.bhkType ?? "",
      floor: ctx?.floor ?? unit.floor.number,
      saleableAreaSqft: ctx?.saleableAreaSqft ?? 0,
      baseRatePerSqft: baseRate != null && baseRate > 0 ? round2(baseRate) : null,
      hasMasterRow,
    });
  }
  return results;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Calculate cost sheet for a unit using master Excel pricing when available. */
export async function previewProjectCostSheet(unitId: string): Promise<CostSheetResult | null> {
  const ctx = await getUnitPricingContext(unitId);
  if (!ctx || ctx.saleableAreaSqft <= 0) return null;

  let price = ctx.saleablePricePerSqft;
  if (price <= 0) {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: { basePrice: true },
    });
    if (unit?.basePrice) {
      price = Number(unit.basePrice) / ctx.saleableAreaSqft;
    }
  }
  if (price <= 0) return null;

  return calculateCostSheet(unitId, price);
}
