import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inferAutoColumnMap } from "../src/services/cost-excel-auto-map";
import { extractRowsFromXlsxBuffer } from "../src/services/cost-excel-parse";
import {
  buildExcelColumnDescriptors,
  mapExcelRowToUnitPayload,
  mergeExcelColumnMaps,
  normalizeExcelHeader,
} from "../src/services/cost-excel-utils";
import { prisma } from "../src/index";

const EXCEL_PATH = resolve(__dirname, "../../../Riviera Uno.xlsx");
const projectId = "cmth4mfeu0007dg1s05jtvmbz";

async function main() {
const buffer = readFileSync(EXCEL_PATH);
const rows = extractRowsFromXlsxBuffer(buffer, "MASTER SHEET", 2);
const lineDefinitions = await prisma.costSheetLineDefinition.findMany({
  where: { projectId },
  select: { id: true, key: true, label: true, role: true, systemField: true },
});

const headerRow = Object.keys(rows[0] ?? {});
console.log("Row keys:", headerRow);
console.log("First row values:", rows[0]);

const rawHeaders = headerRow.map((k) => normalizeExcelHeader(k));
const autoMap = inferAutoColumnMap(rawHeaders, lineDefinitions);
console.log("Auto map:", autoMap);

const columnMap = mergeExcelColumnMaps(autoMap, null);
const payload = mapExcelRowToUnitPayload(rows[0], columnMap, lineDefinitions);
console.log("Payload:", payload);

await prisma.$disconnect();
}

main();
