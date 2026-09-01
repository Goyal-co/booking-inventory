import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const EXCEL_PATH = resolve(__dirname, "../../../Riviera Uno.xlsx");
const buf = readFileSync(EXCEL_PATH);
const wb = XLSX.read(buf, { type: "buffer" });

console.log("Sheets:", wb.SheetNames);

for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  for (let i = 0; i < Math.min(8, rows.length); i++) {
    const row = rows[i] ?? [];
    console.log(`Row ${i + 1}:`, JSON.stringify(row.slice(0, 15)));
  }
}
