/** Canonical system fields available for Excel column mapping. */
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

export type ColumnMapTarget = string; // lineDefinitionId or "systemField:unitNo"

export interface ExcelColumnDescriptor {
  index: number;
  mapKey: string;
  label: string;
  normalized: string;
}

/** Stable keys for Excel columns (handles empty / duplicate headers). */
export function buildExcelColumnDescriptors(rawHeaders: string[]): ExcelColumnDescriptor[] {
  const seen = new Map<string, number>();
  return rawHeaders.map((raw, index) => {
    const normalized = normalizeExcelHeader(raw);
    let mapKey: string;
    if (normalized) {
      const count = seen.get(normalized) ?? 0;
      seen.set(normalized, count + 1);
      mapKey = count === 0 ? normalized : `${normalized}::__${index}`;
    } else {
      mapKey = `__col_${index}`;
    }
    const label = String(raw ?? "").trim() || normalized || `Column ${index + 1}`;
    return { index, mapKey, label, normalized };
  });
}

/** Part A = Inventory / Basic Cost (before payment schedule). Part B = other charges. */
export function isPartACostSheetLine(def: {
  role: string;
  includeInGross?: boolean;
  key: string;
}) {
  if (
    def.role === "IDENTITY" ||
    def.role === "AREA" ||
    def.role === "RATE" ||
    def.role === "COMPUTED_INPUT"
  ) {
    return true;
  }
  if (def.role === "DISPLAY_ONLY" && !def.includeInGross && def.key !== "gross_value") {
    return true;
  }
  return false;
}

export function isPartBCostSheetLine(def: { role: string }) {
  return def.role === "OTHER_CHARGE";
}

export function slugifyLineKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 80) || "excel_column";
}

/** Collapse whitespace/newlines for stable Excel header matching. */
export function normalizeExcelHeader(raw: string): string {
  return String(raw ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize tower/unit strings for fuzzy inventory ↔ Excel matching. */
export function normalizeUnitMatchKey(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
}

export function unitNumbersMatch(excelUnit: string, inventoryUnit: string) {
  return normalizeUnitMatchKey(excelUnit) === normalizeUnitMatchKey(inventoryUnit);
}

export function towersMatchForExcel(excelTower: string, inventoryTower: string) {
  const a = normalizeUnitMatchKey(excelTower);
  const b = normalizeUnitMatchKey(inventoryTower);
  if (!a || !b) return false;
  if (a === b) return true;

  const stripPrefix = (k: string) => k.replace(/^(wing|tower|block|phase|building)/, "");
  const aCore = stripPrefix(a);
  const bCore = stripPrefix(b);
  if (aCore && bCore && aCore === bCore) return true;
  if (a.endsWith(b) || b.endsWith(a)) return true;
  return false;
}

export function inventoryUnitMatches(
  excelTower: string,
  excelUnitNo: string,
  inventoryTower: string,
  inventoryUnitNo: string
) {
  return unitNumbersMatch(excelUnitNo, inventoryUnitNo) && towersMatchForExcel(excelTower, inventoryTower);
}

/** Pick the best Excel / master row for an inventory unit (tower + unit no). */
export function pickUnitPricingRow<T>(
  rows: T[],
  getTower: (row: T) => string | undefined,
  getUnit: (row: T) => string | undefined,
  tower: string,
  unitNo: string
): T | null {
  const unitMatches = rows.filter((row) => {
    const u = getUnit(row);
    return u && unitNumbersMatch(u, unitNo);
  });
  if (unitMatches.length === 0) return null;

  const towerMatches = unitMatches.filter((row) => {
    const t = getTower(row);
    return t && towersMatchForExcel(t, tower);
  });

  if (towerMatches.length === 1) return towerMatches[0];
  if (towerMatches.length > 1) {
    const exactTower = towerMatches.find(
      (row) => normalizeUnitMatchKey(getTower(row) ?? "") === normalizeUnitMatchKey(tower)
    );
    return exactTower ?? towerMatches[0];
  }

  return unitMatches.length === 1 ? unitMatches[0] : null;
}

/** Parse numbers with Indian comma grouping e.g. "11,300" → 11300. */
export function parseIndianNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/,/g, "").replace(/₹/g, "").replace(/rs\.?/gi, "").trim();
  if (!s || s === "-" || s === "—") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseSystemFieldTarget(target: string): CostSheetSystemField | null {
  if (!target.startsWith("systemField:")) return null;
  const field = target.slice("systemField:".length) as CostSheetSystemField;
  return COST_SHEET_SYSTEM_FIELDS.includes(field) ? field : null;
}

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

export function resolveColumnMapTargetLabel(
  target: string | undefined,
  lineDefinitions: Array<{ id: string; label: string }>
): string {
  if (!target) return "Not mapped";
  const systemField = parseSystemFieldTarget(target);
  if (systemField) return COST_SHEET_SYSTEM_FIELD_LABELS[systemField] ?? systemField;
  const line = lineDefinitions.find((d) => d.id === target);
  return line?.label ?? "Cost sheet line";
}

export type ColumnMappingSource = "auto" | "admin" | "unmapped";

export interface ExcelColumnMappingRow {
  index: number;
  mapKey: string;
  label: string;
  normalized: string;
  sampleValue?: string;
  mappedTo?: string;
  mappedLabel: string;
  source: ColumnMappingSource;
}

/** Auto-map detected columns; admin saved mappings override per column key. */
export function mergeExcelColumnMaps(
  autoMap: Record<string, ColumnMapTarget>,
  savedMap?: Record<string, ColumnMapTarget> | null
): Record<string, ColumnMapTarget> {
  const merged: Record<string, ColumnMapTarget> = { ...autoMap };
  if (!savedMap) return merged;
  for (const [mapKey, target] of Object.entries(savedMap)) {
    if (!target || target === "__skip__") {
      delete merged[mapKey];
      continue;
    }
    merged[mapKey] = target;
  }
  return merged;
}

/**
 * Re-apply saved column map when Excel headers change (per-project layouts).
 * Matches by mapKey first, then fuzzy label match on normalized header text.
 */
export function remapColumnMapToHeaders(
  savedMap: Record<string, ColumnMapTarget> | null | undefined,
  rawHeaders: string[]
): Record<string, ColumnMapTarget> | null {
  if (!savedMap || Object.keys(savedMap).length === 0) return null;

  const columns = buildExcelColumnDescriptors(rawHeaders);
  const remapped: Record<string, ColumnMapTarget> = {};
  const usedTargets = new Set<string>();

  for (const col of columns) {
    if (savedMap[col.mapKey]) {
      remapped[col.mapKey] = savedMap[col.mapKey];
      usedTargets.add(savedMap[col.mapKey]);
      continue;
    }

    const headerNorm = normalizeExcelHeader(col.label).toLowerCase();
    if (!headerNorm) continue;

    for (const [oldKey, target] of Object.entries(savedMap)) {
      if (!target || target === "__skip__" || usedTargets.has(target)) continue;
      const oldNorm = normalizeExcelHeader(oldKey).toLowerCase();
      if (!oldNorm) continue;
      if (
        headerNorm === oldNorm ||
        headerNorm.includes(oldNorm) ||
        oldNorm.includes(headerNorm) ||
        excelHeaderTokensMatch(headerNorm, oldNorm)
      ) {
        remapped[col.mapKey] = target;
        usedTargets.add(target);
        break;
      }
    }
  }

  return Object.keys(remapped).length > 0 ? remapped : savedMap;
}

function excelHeaderTokensMatch(a: string, b: string): boolean {
  const tokenize = (s: string) =>
    s.split(/[^a-z0-9]+/g).filter((t) => t.length > 2);
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.length === 0 || bTokens.length === 0) return false;
  const overlap = aTokens.filter((t) => bTokens.includes(t)).length;
  const minLen = Math.min(aTokens.length, bTokens.length);
  return overlap >= Math.min(2, minLen);
}

export function buildExcelColumnMappingRows(
  rawHeaders: string[],
  columnMap: Record<string, ColumnMapTarget>,
  autoMap: Record<string, ColumnMapTarget>,
  savedMap: Record<string, ColumnMapTarget> | null | undefined,
  lineDefinitions: Array<{ id: string; label: string }>,
  sampleRow?: Record<string, unknown>
): ExcelColumnMappingRow[] {
  const columns = buildExcelColumnDescriptors(rawHeaders);
  return columns.map((col) => {
    const mappedTo = columnMap[col.mapKey];
    const adminSet = savedMap && savedMap[col.mapKey] != null && savedMap[col.mapKey] !== "";
    let source: ColumnMappingSource = "unmapped";
    if (mappedTo) {
      source = adminSet ? "admin" : "auto";
    }
    return {
      index: col.index,
      mapKey: col.mapKey,
      label: col.label,
      normalized: col.normalized,
      sampleValue: sampleRow ? String(sampleRow[col.mapKey] ?? "").trim() : undefined,
      mappedTo: mappedTo || undefined,
      mappedLabel: resolveColumnMapTargetLabel(mappedTo, lineDefinitions),
      source,
    };
  });
}

export function columnMapHasSystemField(
  columnMap: Record<string, ColumnMapTarget>,
  field: CostSheetSystemField
): boolean {
  return Object.values(columnMap).some((t) => parseSystemFieldTarget(t) === field);
}

/** True when column map targets systemField:X or a line definition with that systemField. */
export function columnMapCoversSystemField(
  columnMap: Record<string, ColumnMapTarget>,
  field: CostSheetSystemField,
  lineDefinitions: Array<{ id: string; systemField?: string | null }>
): boolean {
  if (columnMapHasSystemField(columnMap, field)) return true;
  const targets = new Set(Object.values(columnMap));
  return lineDefinitions.some((d) => d.systemField === field && targets.has(d.id));
}

export function resolveSaleableAreaSqft(payload: MappedUnitRowPayload): number | null {
  if (payload.saleableAreaSqft != null && payload.saleableAreaSqft > 0) {
    return payload.saleableAreaSqft;
  }
  if (payload.saleableAreaSqm != null && payload.saleableAreaSqm > 0) {
    return round2(payload.saleableAreaSqm * 10.7639);
  }
  return null;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export interface LineDefinitionRef {
  id: string;
  role: string;
  systemField?: string | null;
}

export interface MappedUnitRowPayload {
  tower?: string;
  unitNo?: string;
  floor?: number;
  configuration?: string;
  status?: string;
  saleableAreaSqft?: number;
  saleableAreaSqm?: number | null;
  carpetAreaSqft?: number | null;
  carpetAreaSqm?: number | null;
  balconyAreaSqft?: number | null;
  balconyAreaSqm?: number | null;
  baseRatePerSqft?: number | null;
  premiumCharges?: number | null;
  importedValues: Record<string, number | string>;
}

export function mapExcelRowToUnitPayload(
  rowCells: Record<string, unknown>,
  columnMap: Record<string, ColumnMapTarget>,
  lineDefinitions: LineDefinitionRef[]
): MappedUnitRowPayload {
  const payload: MappedUnitRowPayload = { importedValues: {} };
  const lineById = new Map(lineDefinitions.map((d) => [d.id, d]));

  for (const [rawHeader, target] of Object.entries(columnMap)) {
    const normalizedHeader = normalizeExcelHeader(rawHeader);
    const cell =
      rowCells[normalizedHeader] ??
      rowCells[rawHeader] ??
      Object.entries(rowCells).find(([k]) => normalizeExcelHeader(k) === normalizedHeader)?.[1];

    if (cell == null || cell === "") continue;

    const systemField = parseSystemFieldTarget(target);
    if (systemField) {
      if (systemField === "unitNo" || systemField === "tower" || systemField === "configuration" || systemField === "status") {
        if (systemField === "unitNo") payload.unitNo = String(cell).trim();
        if (systemField === "tower") payload.tower = String(cell).trim();
        if (systemField === "configuration") payload.configuration = String(cell).trim();
        if (systemField === "status") payload.status = String(cell).trim();
      } else if (systemField === "floor") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.floor = Math.trunc(n);
      } else if (systemField === "saleableAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.saleableAreaSqft = n;
      } else if (systemField === "saleableAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.saleableAreaSqm = n;
      } else if (systemField === "carpetAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.carpetAreaSqft = n;
      } else if (systemField === "carpetAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.carpetAreaSqm = n;
      } else if (systemField === "balconyAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.balconyAreaSqft = n;
      } else if (systemField === "balconyAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.balconyAreaSqm = n;
      } else if (systemField === "baseRatePerSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.baseRatePerSqft = n;
      } else if (systemField === "premiumCharges") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.premiumCharges = n;
      }
      continue;
    }

    const line = lineById.get(target);
    if (!line) continue;

    if (line.systemField && COST_SHEET_SYSTEM_FIELDS.includes(line.systemField as CostSheetSystemField)) {
      const sf = line.systemField as CostSheetSystemField;
      if (sf === "unitNo" || sf === "tower" || sf === "configuration" || sf === "status") {
        if (sf === "unitNo") payload.unitNo = String(cell).trim();
        if (sf === "tower") payload.tower = String(cell).trim();
        if (sf === "configuration") payload.configuration = String(cell).trim();
        if (sf === "status") payload.status = String(cell).trim();
      } else if (sf === "floor") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.floor = Math.trunc(n);
      } else if (sf === "saleableAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.saleableAreaSqft = n;
      } else if (sf === "saleableAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.saleableAreaSqm = n;
      } else if (sf === "carpetAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.carpetAreaSqft = n;
      } else if (sf === "carpetAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.carpetAreaSqm = n;
      } else if (sf === "balconyAreaSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.balconyAreaSqft = n;
      } else if (sf === "balconyAreaSqm") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.balconyAreaSqm = n;
      } else if (sf === "baseRatePerSqft") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.baseRatePerSqft = n;
      } else if (sf === "premiumCharges") {
        const n = parseIndianNumber(cell);
        if (n != null) payload.premiumCharges = n;
      }
    } else {
      const n = parseIndianNumber(cell);
      if (n != null) payload.importedValues[target] = n;
      else payload.importedValues[target] = String(cell).trim();
    }
  }

  return payload;
}

export function validateRequiredMappings(
  columnMap: Record<string, ColumnMapTarget>,
  lineDefinitions: Array<{ id: string; label: string; systemField?: string | null; isRequired?: boolean }>
): string[] {
  const errors: string[] = [];
  const requiredLineDefs = lineDefinitions.filter((d) => d.isRequired);
  const targets = new Set(Object.values(columnMap));

  if (!columnMapCoversSystemField(columnMap, "unitNo", lineDefinitions)) {
    errors.push("Map a column to Unit No (unitNo)");
  }
  if (!columnMapCoversSystemField(columnMap, "tower", lineDefinitions)) {
    errors.push("Map a column to Tower/Wing (tower)");
  }

  for (const def of requiredLineDefs) {
    if (def.systemField && columnMapCoversSystemField(columnMap, def.systemField as CostSheetSystemField, lineDefinitions)) {
      continue;
    }
    const mappedById = targets.has(def.id);
    if (!mappedById) {
      errors.push(`Required row "${def.label}" is not mapped to any Excel column`);
    }
  }

  return errors;
}

/** Riviera-style default cost sheet line definitions for admin seed. */
export const RIVIERA_DEFAULT_LINE_DEFINITIONS = [
  { key: "unit_no", label: "Villa No.", role: "IDENTITY", systemField: "unitNo", sortOrder: 0, isRequired: true },
  { key: "wing", label: "Wing", role: "IDENTITY", systemField: "tower", sortOrder: 1, isRequired: true },
  { key: "villa_type", label: "VILLA TYPE", role: "IDENTITY", systemField: "configuration", sortOrder: 2 },
  { key: "saleable_sqft", label: "Salable Area (Sq.ft.)", role: "AREA", systemField: "saleableAreaSqft", sortOrder: 3 },
  { key: "saleable_sqm", label: "Salable Area (Sq.Mt.)", role: "AREA", systemField: "saleableAreaSqm", sortOrder: 4 },
  { key: "carpet_sqft", label: "Carpet Area (Sq.ft.)", role: "AREA", systemField: "carpetAreaSqft", sortOrder: 5 },
  { key: "carpet_sqm", label: "Carpet Area (Sq.Mt.)", role: "AREA", systemField: "carpetAreaSqm", sortOrder: 6 },
  { key: "balcony_sqft", label: "Balcony Area (Sq.ft.)", role: "AREA", systemField: "balconyAreaSqft", sortOrder: 7 },
  { key: "balcony_sqm", label: "Balcony Area (Sq.Mt.)", role: "AREA", systemField: "balconyAreaSqm", sortOrder: 8 },
  { key: "base_rate", label: "BASE RATE/SFT", role: "RATE", systemField: "baseRatePerSqft", sortOrder: 9 },
  { key: "premium", label: "Premium Charges", role: "OTHER_CHARGE", systemField: "premiumCharges", calcMode: "IMPORTED_AMOUNT", includeInGross: false, sortOrder: 10 },
  { key: "e_stamping", label: "E-stamping Charges", role: "OTHER_CHARGE", calcMode: "IMPORTED_AMOUNT", includeInGross: true, sortOrder: 11 },
  { key: "maintenance", label: "Maintenance Charges", role: "OTHER_CHARGE", calcMode: "IMPORTED_AMOUNT", includeInGross: true, sortOrder: 12 },
  { key: "corpus", label: "Corpus Fund", role: "OTHER_CHARGE", calcMode: "IMPORTED_AMOUNT", includeInGross: true, sortOrder: 13 },
  { key: "clubhouse", label: "Clubhouse Charges", role: "OTHER_CHARGE", calcMode: "IMPORTED_AMOUNT", includeInGross: true, sortOrder: 14 },
] as const;
