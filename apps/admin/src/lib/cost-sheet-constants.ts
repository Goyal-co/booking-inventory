/** Client-safe cost sheet constants (no database / Prisma imports). */

export const COST_SHEET_SYSTEM_FIELDS = [
  "unitNo",
  "tower",
  "floor",
  "configuration",
  "status",
  "saleableAreaSqft",
  "saleableAreaSqm",
  "carpetAreaSqft",
  "carpetAreaSqm",
  "balconyAreaSqft",
  "balconyAreaSqm",
  "baseRatePerSqft",
  "premiumCharges",
] as const;

export type CostSheetSystemField = (typeof COST_SHEET_SYSTEM_FIELDS)[number];

export const COST_SHEET_SYSTEM_FIELD_LABELS: Record<CostSheetSystemField, string> = {
  unitNo: "Villa / Unit No",
  tower: "Wing / Tower",
  floor: "Floor",
  configuration: "Accommodation / BHK",
  status: "Status",
  saleableAreaSqft: "Saleable Area (sq.ft.)",
  saleableAreaSqm: "Saleable Area (sq.m.)",
  carpetAreaSqft: "Carpet Area (sq.ft.)",
  carpetAreaSqm: "Carpet Area (sq.m.)",
  balconyAreaSqft: "Balcony Area (sq.ft.)",
  balconyAreaSqm: "Balcony Area (sq.m.)",
  baseRatePerSqft: "Base Rate / sq.ft.",
  premiumCharges: "Premium Charges",
};

/** Rows shown in Part A — Inventory / Basic Cost (before payment schedule). */
export const PART_A_ROLE_OPTIONS = [
  { value: "DISPLAY_ONLY", label: "Amount row (from Excel column)" },
  { value: "IDENTITY", label: "Identity (tower, unit, type)" },
  { value: "AREA", label: "Area field" },
  { value: "RATE", label: "Rate (₹/sq.ft)" },
] as const;

export function isPartALine(role: string, includeInGross: boolean, key: string) {
  if (role === "IDENTITY" || role === "AREA" || role === "RATE" || role === "COMPUTED_INPUT") {
    return true;
  }
  if (role === "DISPLAY_ONLY" && !includeInGross && key !== "gross_value") {
    return true;
  }
  return false;
}

export const LINE_CALC_MODE_OPTIONS = [
  { value: "IMPORTED_AMOUNT", label: "From Excel (mapped column)" },
  { value: "FIXED", label: "Fixed amount" },
  { value: "RATE_PER_AREA", label: "Rate × area × months" },
] as const;

export const AREA_FIELD_OPTIONS = [
  { value: "saleable", label: "Saleable area" },
  { value: "carpet", label: "Carpet area" },
  { value: "balcony", label: "Balcony area" },
] as const;

export function slugifyLineKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "excel_line";
}
