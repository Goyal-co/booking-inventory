import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { inferAutoColumnMap } from "./cost-excel-auto-map";
import { extractRowsFromXlsxBuffer } from "./cost-excel-parse";
import { mapExcelRowToUnitPayload } from "./cost-excel-utils";

function buildTestWorkbook() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["", ""],
    [
      "Villa No.",
      "Wing",
      "Salable Area (Sq.ft.)",
      "BASE RATE/SFT",
      "Sale Value",
      "GST applicable on Basic Sale Value (5%)",
      "Basic Salevalue with GST",
      "E-stamping Charges",
      "Gross Apartment Value",
    ],
    ["V1", "Tower A", "2500", "11,300", "28,250,000", "1,412,500", "29,662,500", "1,200", "30,500,000"],
    ["V2", "Tower A", "3000", "12,000", "36,000,000", "1,800,000", "37,800,000", "1,500", "39,000,000"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MASTER SHEET");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("per-unit Excel cost sheet rows", () => {
  it("extracts different values for different villas from MASTER SHEET", () => {
    const buffer = buildTestWorkbook();
    const rows = extractRowsFromXlsxBuffer(buffer, "MASTER SHEET", 2);
    expect(rows.length).toBe(2);

    const headers = [
      "Villa No.",
      "Wing",
      "Salable Area (Sq.ft.)",
      "BASE RATE/SFT",
      "Sale Value",
      "GST applicable on Basic Sale Value (5%)",
      "Basic Salevalue with GST",
      "E-stamping Charges",
      "Gross Apartment Value",
    ];

    const lineDefs = [
      { id: "line-estamp", key: "e_stamping", label: "E-stamping Charges", systemField: null },
      { id: "line-sale", key: "sale_value", label: "Sale Value", systemField: null },
      { id: "line-gross", key: "gross_value", label: "Gross Apartment Value", systemField: null },
    ];

    const columnMap = inferAutoColumnMap(headers, lineDefs);

    const v1 = mapExcelRowToUnitPayload(rows[0], columnMap, lineDefs);
    const v2 = mapExcelRowToUnitPayload(rows[1], columnMap, lineDefs);

    expect(v1.unitNo).toBe("V1");
    expect(v2.unitNo).toBe("V2");
    expect(v1.saleableAreaSqft).toBe(2500);
    expect(v2.saleableAreaSqft).toBe(3000);
    expect(v1.baseRatePerSqft).toBe(11300);
    expect(v2.baseRatePerSqft).toBe(12000);
    expect(v1.importedValues["line-estamp"]).toBe(1200);
    expect(v2.importedValues["line-estamp"]).toBe(1500);
    expect(v1.importedValues["line-gross"]).toBe(30500000);
    expect(v2.importedValues["line-gross"]).toBe(39000000);
  });
});
