import { CostExcelPricingMode } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../index";
import { inferAutoColumnMap } from "./cost-excel-auto-map";
import { extractRowsFromXlsxBuffer } from "./cost-excel-parse";
import {
  buildExcelColumnDescriptors,
  mapExcelRowToUnitPayload,
  pickUnitPricingRow,
  type ColumnMapTarget,
  type MappedUnitRowPayload,
} from "./cost-excel-utils";

const WORKBOOK_CACHE_TTL_MS = 60_000;

interface WorkbookCacheEntry {
  buffer: Buffer;
  fetchedAt: number;
}

const workbookCache = new Map<string, WorkbookCacheEntry>();

/** Normalize common OneDrive / SharePoint share links to a direct-download URL. */
export function normalizeExcelSourceUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);

    if (parsed.hostname.includes("1drv.ms")) {
      return trimmed;
    }

    const isSharePointShare =
      parsed.hostname.includes("sharepoint.com") &&
      /:(x|w|u|b|f):/i.test(parsed.pathname);

    if (isSharePointShare || parsed.hostname.includes("sharepoint.com")) {
      if (!parsed.searchParams.has("download")) {
        parsed.searchParams.set("download", "1");
      }
      return parsed.toString();
    }
  } catch {
    return trimmed;
  }
  return trimmed;
}

async function fetchWorkbookBuffer(sourceUrl: string): Promise<Buffer> {
  const url = normalizeExcelSourceUrl(sourceUrl);
  const res = await fetch(url, {
    headers: {
      Accept:
        "application/octet-stream, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        "SharePoint denied access (403). Set the link to “Anyone with the link can view”, or upload the .xlsx file directly below."
      );
    }
    throw new Error(
      `Failed to fetch Excel (${res.status}). For SharePoint "Copy link" URLs, sync auto-adds download=1 — ensure the link is still valid.`
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    const head = buffer.slice(0, 120).toString("utf8").toLowerCase();
    if (head.includes("<!doctype") || head.includes("<html")) {
      throw new Error(
        "SharePoint returned a web page instead of the Excel file. Use “Copy link” from OneDrive and paste that URL — we append download=1 automatically."
      );
    }
    throw new Error("Fetched file is not a valid .xlsx workbook — check the source URL");
  }
  return buffer;
}

/** Fetch workbook bypassing cache (for admin sync). */
export async function fetchWorkbookBufferForSync(sourceUrl: string): Promise<Buffer> {
  return fetchWorkbookBuffer(sourceUrl);
}

async function getCachedWorkbook(projectId: string, sourceUrl: string): Promise<Buffer> {
  const key = `${projectId}::${sourceUrl}`;
  const cached = workbookCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < WORKBOOK_CACHE_TTL_MS) {
    return cached.buffer;
  }
  const buffer = await fetchWorkbookBuffer(sourceUrl);
  workbookCache.set(key, { buffer, fetchedAt: Date.now() });
  return buffer;
}

export function clearLiveExcelCache(projectId?: string) {
  if (!projectId) {
    workbookCache.clear();
    return;
  }
  for (const key of workbookCache.keys()) {
    if (key.startsWith(`${projectId}::`)) workbookCache.delete(key);
  }
}

export interface LiveUnitPricingData extends MappedUnitRowPayload {
  source: "live_excel";
  fetchedAt: string;
}

/**
 * Fetch pricing for one villa/flat from the configured live Excel source.
 * Reads the latest saved cell values (formulas must already be calculated in Excel).
 */
export async function fetchLiveUnitPricing(
  projectId: string,
  tower: string,
  unitNo: string
): Promise<LiveUnitPricingData | null> {
  const mapping = await prisma.projectCostExcelMapping.findUnique({
    where: { projectId },
  });
  if (
    !mapping ||
    mapping.pricingMode !== CostExcelPricingMode.LIVE ||
    !mapping.excelSourceUrl?.trim()
  ) {
    return null;
  }

  let columnMap = mapping.columnMap as Record<string, ColumnMapTarget>;
  const lineDefinitions = await prisma.costSheetLineDefinition.findMany({
    where: { projectId },
    select: { id: true, key: true, label: true, role: true, systemField: true },
  });

  const buffer = await getCachedWorkbook(projectId, mapping.excelSourceUrl);
  const rows = extractRowsFromXlsxBuffer(buffer, mapping.sheetName, mapping.headerRowIndex);

  if (!columnMap || Object.keys(columnMap).length === 0) {
    const headerIdx = mapping.headerRowIndex - 1;
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[mapping.sheetName];
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet!, { header: 1, defval: "" }) as unknown[][];
    const rawHeaders = (rawRows[headerIdx] ?? []).map((h) => String(h ?? "").trim());
    columnMap = inferAutoColumnMap(rawHeaders, lineDefinitions);
  }

  const payloads = rows.map((row) => mapExcelRowToUnitPayload(row, columnMap, lineDefinitions));
  const payload = pickUnitPricingRow(
    payloads,
    (p) => p.tower,
    (p) => p.unitNo,
    tower,
    unitNo
  );

  if (!payload?.tower || !payload.unitNo) return null;

  return {
    ...payload,
    source: "live_excel",
    fetchedAt: new Date().toISOString(),
  };
}

/** Virtual master shape used by the cost sheet engine (DB row or live Excel). */
export interface UnitPricingMasterData {
  floor?: number;
  configuration?: string;
  saleableAreaSqft?: number;
  saleableAreaSqm?: number | null;
  carpetAreaSqft?: number | null;
  carpetAreaSqm?: number | null;
  balconyAreaSqft?: number | null;
  balconyAreaSqm?: number | null;
  baseRatePerSqft?: number | null;
  premiumCharges?: number | null;
  importedValues?: Record<string, number | string> | null;
  source: "database" | "live_excel";
}

async function findUnitMasterRow(projectId: string, tower: string, unitNo: string) {
  const exact = await prisma.unitMasterRow.findUnique({
    where: {
      projectId_tower_unitNo: { projectId, tower, unitNo },
    },
  });
  if (exact) return exact;

  const rows = await prisma.unitMasterRow.findMany({ where: { projectId } });
  return pickUnitPricingRow(
    rows,
    (r) => r.tower,
    (r) => r.unitNo,
    tower,
    unitNo
  );
}

export async function resolveUnitPricingMaster(
  projectId: string,
  tower: string,
  unitNo: string
): Promise<UnitPricingMasterData | null> {
  const mapping = await prisma.projectCostExcelMapping.findUnique({
    where: { projectId },
    select: { pricingMode: true, excelSourceUrl: true },
  });

  if (mapping?.pricingMode === CostExcelPricingMode.LIVE && mapping.excelSourceUrl) {
    const live = await fetchLiveUnitPricing(projectId, tower, unitNo);
    if (live) {
      return {
        floor: live.floor,
        configuration: live.configuration,
        saleableAreaSqft: live.saleableAreaSqft,
        saleableAreaSqm: live.saleableAreaSqm,
        carpetAreaSqft: live.carpetAreaSqft,
        carpetAreaSqm: live.carpetAreaSqm,
        balconyAreaSqft: live.balconyAreaSqft,
        balconyAreaSqm: live.balconyAreaSqm,
        baseRatePerSqft: live.baseRatePerSqft,
        premiumCharges: live.premiumCharges,
        importedValues: live.importedValues,
        source: "live_excel",
      };
    }
  }

  const master = await findUnitMasterRow(projectId, tower, unitNo);
  if (!master) return null;

  return {
    floor: master.floor,
    configuration: master.configuration,
    saleableAreaSqft: Number(master.saleableAreaSqft),
    saleableAreaSqm: master.saleableAreaSqm ? Number(master.saleableAreaSqm) : null,
    carpetAreaSqft: master.carpetAreaSqft ? Number(master.carpetAreaSqft) : null,
    carpetAreaSqm: master.carpetAreaSqm ? Number(master.carpetAreaSqm) : null,
    balconyAreaSqft: master.balconyAreaSqft ? Number(master.balconyAreaSqft) : null,
    balconyAreaSqm: master.balconyAreaSqm ? Number(master.balconyAreaSqm) : null,
    baseRatePerSqft: master.baseRatePerSqft ? Number(master.baseRatePerSqft) : null,
    premiumCharges: master.premiumCharges ? Number(master.premiumCharges) : null,
    importedValues: master.importedValues as Record<string, number | string> | null,
    source: "database",
  };
}
