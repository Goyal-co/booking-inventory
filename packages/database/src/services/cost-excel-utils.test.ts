import { describe, expect, it } from "vitest";
import {
  inventoryUnitMatches,
  normalizeExcelHeader,
  parseIndianNumber,
  mapExcelRowToUnitPayload,
  pickUnitPricingRow,
  towersMatchForExcel,
  mergeExcelColumnMaps,
  validateRequiredMappings,
  remapColumnMapToHeaders,
  RIVIERA_DEFAULT_LINE_DEFINITIONS,
} from "./cost-excel-utils";

describe("normalizeExcelHeader", () => {
  it("collapses whitespace and newlines (Riviera-style headers)", () => {
    expect(normalizeExcelHeader("Salable Area\n(Sq.ft.)")).toBe("Salable Area (Sq.ft.)");
    expect(normalizeExcelHeader("  BASE   RATE/SFT  ")).toBe("BASE RATE/SFT");
    expect(normalizeExcelHeader("Wing")).toBe("Wing");
  });
});

describe("parseIndianNumber", () => {
  it("parses comma-grouped numbers", () => {
    expect(parseIndianNumber("11,300")).toBe(11300);
    expect(parseIndianNumber("1,23,45,678")).toBe(12345678);
    expect(parseIndianNumber("₹11,300")).toBe(11300);
  });

  it("returns null for empty or invalid", () => {
    expect(parseIndianNumber("")).toBeNull();
    expect(parseIndianNumber("—")).toBeNull();
    expect(parseIndianNumber("abc")).toBeNull();
  });
});

describe("mapExcelRowToUnitPayload", () => {
  const lineDefs = [
    { id: "line-premium", role: "OTHER_CHARGE", systemField: "premiumCharges" },
    { id: "line-estamp", role: "OTHER_CHARGE", systemField: null },
  ];

  it("maps system fields and line amounts from normalized row", () => {
    const row = {
      "Villa No.": "A1",
      Wing: "Tower A",
      "Salable Area (Sq.ft.)": "2,500",
      "BASE RATE/SFT": "11,300",
      "Premium Charges": "50,000",
      "E-stamping Charges": "1,200",
    };

    const columnMap = {
      "Villa No.": "systemField:unitNo",
      Wing: "systemField:tower",
      "Salable Area (Sq.ft.)": "systemField:saleableAreaSqft",
      "BASE RATE/SFT": "systemField:baseRatePerSqft",
      "Premium Charges": "systemField:premiumCharges",
      "E-stamping Charges": "line-estamp",
    };

    const payload = mapExcelRowToUnitPayload(row, columnMap, lineDefs);
    expect(payload.unitNo).toBe("A1");
    expect(payload.tower).toBe("Tower A");
    expect(payload.saleableAreaSqft).toBe(2500);
    expect(payload.baseRatePerSqft).toBe(11300);
    expect(payload.premiumCharges).toBe(50000);
    expect(payload.importedValues["line-estamp"]).toBe(1200);
  });
});

describe("validateRequiredMappings", () => {
  it("requires unitNo and tower system mappings", () => {
    const errors = validateRequiredMappings({}, []);
    expect(errors.some((e) => e.includes("unitNo"))).toBe(true);
    expect(errors.some((e) => e.includes("tower"))).toBe(true);
  });

  it("accepts line definition id mapping for required identity fields", () => {
    const lineDefs = [
      { id: "wing-id", label: "Wing", systemField: "tower", isRequired: true },
      { id: "unit-id", label: "Villa No.", systemField: "unitNo", isRequired: true },
    ];
    const errors = validateRequiredMappings(
      { wing: "wing-id", villa: "unit-id" },
      lineDefs
    );
    expect(errors).toHaveLength(0);
  });
});

describe("unit/tower matching", () => {
  it("matches Wing A inventory to Tower A excel row", () => {
    expect(towersMatchForExcel("Tower A", "A")).toBe(true);
    expect(towersMatchForExcel("Wing A", "A")).toBe(true);
    expect(inventoryUnitMatches("Tower A", "V1", "A", "V1")).toBe(true);
  });

  it("pickUnitPricingRow prefers tower match over unit-only", () => {
    const rows = [
      { tower: "Tower B", unitNo: "101" },
      { tower: "Tower A", unitNo: "101" },
    ];
    const picked = pickUnitPricingRow(rows, (r) => r.tower, (r) => r.unitNo, "A", "101");
    expect(picked?.tower).toBe("Tower A");
  });
});

describe("mergeExcelColumnMaps", () => {
  it("preserves admin overrides over auto map", () => {
    const auto = { wing: "systemField:tower", col_a: "line-1" };
    const saved = { wing: "systemField:unitNo", col_b: "line-2" };
    const merged = mergeExcelColumnMaps(auto, saved);
    expect(merged.wing).toBe("systemField:unitNo");
    expect(merged.col_a).toBe("line-1");
    expect(merged.col_b).toBe("line-2");
  });
});

describe("remapColumnMapToHeaders", () => {
  it("remaps saved map when header label changes slightly", () => {
    const saved = { "Villa No.": "systemField:unitNo", Wing: "systemField:tower" };
    const remapped = remapColumnMapToHeaders(saved, ["Villa No", "Tower"]);
    expect(remapped?.["Villa No"]).toBe("systemField:unitNo");
  });
});

describe("RIVIERA_DEFAULT_LINE_DEFINITIONS", () => {
  it("includes master sheet identity and charge rows", () => {
    const keys = RIVIERA_DEFAULT_LINE_DEFINITIONS.map((r) => r.key);
    expect(keys).toContain("unit_no");
    expect(keys).toContain("wing");
    expect(keys).toContain("base_rate");
    expect(keys).toContain("e_stamping");
  });
});
