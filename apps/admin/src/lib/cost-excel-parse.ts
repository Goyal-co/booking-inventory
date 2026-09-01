import * as XLSX from "xlsx";
import {
  buildExcelColumnDescriptors,
  extractRowsFromXlsxBuffer,
} from "@booking/database";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface ExcelPreviewResult {
  sheetNames: string[];
  sheetName: string;
  headerRowIndex: number;
  headers: string[];
  normalizedHeaders: string[];
  columns: Array<{
    index: number;
    mapKey: string;
    label: string;
    normalized: string;
    sampleValue?: string;
  }>;
  sampleRows: Array<Record<string, unknown>>;
  previewToken: string;
  fileName: string;
}

interface PreviewCacheEntry {
  buffer: Buffer;
  fileName: string;
  expiresAt: number;
}

const previewCache = new Map<string, PreviewCacheEntry>();
const PREVIEW_TTL_MS = 30 * 60 * 1000;

function cacheKey(projectId: string, token: string) {
  return `${projectId}::${token}`;
}

export function putPreviewCache(projectId: string, token: string, buffer: Buffer, fileName: string) {
  previewCache.set(cacheKey(projectId, token), {
    buffer,
    fileName,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  });
}

export function getPreviewCache(projectId: string, token: string): PreviewCacheEntry | null {
  const entry = previewCache.get(cacheKey(projectId, token));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    previewCache.delete(cacheKey(projectId, token));
    return null;
  }
  return entry;
}

export function validateExcelFile(file: File | { size: number; name: string }) {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds 10MB limit");
  }
}

export async function readExcelBuffer(file: File): Promise<{ buffer: Buffer; fileName: string }> {
  validateExcelFile(file);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return { buffer, fileName: file.name };
}

export function parseWorkbookSheet(
  buffer: Buffer,
  sheetName: string,
  headerRowIndex: number,
  sampleLimit = 10
): {
  headers: string[];
  normalizedHeaders: string[];
  sampleRows: Array<Record<string, unknown>>;
  columns: ReturnType<typeof buildExcelColumnDescriptors>;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const headerIdx = headerRowIndex - 1;
  if (headerIdx < 0 || headerIdx >= rawRows.length) {
    throw new Error(`Header row ${headerRowIndex} is out of range`);
  }

  const headerRow = rawRows[headerIdx] ?? [];
  const headers = headerRow.map((h) => String(h ?? "").trim());
  const columns = buildExcelColumnDescriptors(headers);
  const normalizedHeaders = columns.map((c) => c.normalized);

  const sampleRows: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < rawRows.length && sampleRows.length < sampleLimit; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const record: Record<string, unknown> = {};
    columns.forEach((col) => {
      record[col.mapKey] = row[col.index] ?? "";
    });
    sampleRows.push(record);
  }

  return { headers, normalizedHeaders, sampleRows, columns };
}

export function suggestHeaderRow(buffer: Buffer, sheetName: string): number {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return 1;
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i] ?? [];
    const text = row.map((c) => String(c ?? "").toLowerCase()).join(" ");
    if (
      text.includes("villa") ||
      text.includes("wing") ||
      text.includes("unit") ||
      text.includes("saleable") ||
      text.includes("salable")
    ) {
      return i + 1;
    }
  }
  return 1;
}

export function previewExcelWorkbook(
  buffer: Buffer,
  fileName: string,
  options?: { sheetName?: string; headerRowIndex?: number; previewToken?: string; projectId?: string }
): ExcelPreviewResult {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames;
  const sheetName = options?.sheetName ?? sheetNames[0] ?? "";
  const suggested = suggestHeaderRow(buffer, sheetName);
  const headerRowIndex = options?.headerRowIndex ?? suggested;
  const { headers, normalizedHeaders, sampleRows, columns } = parseWorkbookSheet(buffer, sheetName, headerRowIndex);

  const columnsWithSamples = columns.map((col) => ({
    ...col,
    sampleValue: String(sampleRows[0]?.[col.mapKey] ?? ""),
  }));

  const previewToken =
    options?.previewToken ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `prev_${Date.now()}`);

  if (options?.projectId) {
    putPreviewCache(options.projectId, previewToken, buffer, fileName);
  }

  return {
    sheetNames,
    sheetName,
    headerRowIndex,
    headers,
    normalizedHeaders,
    columns: columnsWithSamples,
    sampleRows,
    previewToken,
    fileName,
  };
}

export function extractAllRowsFromSheet(
  buffer: Buffer,
  sheetName: string,
  headerRowIndex: number
): Array<Record<string, unknown>> {
  return extractRowsFromXlsxBuffer(buffer, sheetName, headerRowIndex);
}
