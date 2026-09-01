import * as XLSX from "xlsx";
import { buildExcelColumnDescriptors, normalizeExcelHeader } from "./cost-excel-utils";

/** Column count from sheet range and scanned rows (handles trailing empty header cells). */
export function getSheetUsedColumnCount(
  sheet: XLSX.WorkSheet,
  rawRows: unknown[][]
): number {
  let max = 0;
  const ref = sheet["!ref"];
  if (ref) {
    try {
      max = XLSX.utils.decode_range(ref).e.c + 1;
    } catch {
      /* ignore invalid range */
    }
  }
  const scan = Math.min(rawRows.length, 30);
  for (let i = 0; i < scan; i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      max = Math.max(max, row.length);
    }
  }
  return max;
}

export function expandHeaderCells(headerRow: unknown[], columnCount: number): string[] {
  const headers: string[] = [];
  for (let i = 0; i < columnCount; i++) {
    headers.push(String(headerRow[i] ?? "").trim());
  }
  return headers;
}

/** Extract all data rows from a sheet as normalized-header records. */
export function extractRowsFromXlsxBuffer(
  buffer: Buffer,
  sheetName: string,
  headerRowIndex: number
): Array<Record<string, unknown>> {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const headerIdx = headerRowIndex - 1;
  const headerRow = rawRows[headerIdx] ?? [];
  const columnCount = getSheetUsedColumnCount(sheet, rawRows);
  const headers = expandHeaderCells(headerRow, columnCount);
  const columns = buildExcelColumnDescriptors(headers);

  const rows: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === "")) continue;
    const record: Record<string, unknown> = {};
    columns.forEach((col) => {
      record[col.mapKey] = row[col.index] ?? "";
    });
    rows.push(record);
  }
  return rows;
}

export function listSheetNames(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  return workbook.SheetNames;
}
