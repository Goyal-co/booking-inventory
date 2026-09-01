import {
  buildExcelColumnDescriptors,
  normalizeExcelHeader,
  COST_SHEET_SYSTEM_FIELD_LABELS,
  RIVIERA_DEFAULT_LINE_DEFINITIONS,
  type ColumnMapTarget,
  type CostSheetSystemField,
} from "./cost-excel-utils";

/** Fallback header hints when project line labels do not match (not project-specific). */
export const EXCEL_HEADER_HINTS: Array<{
  patterns: string[];
  systemField?: CostSheetSystemField;
  lineKey?: string;
}> = [
  { patterns: ["villa no", "villa no.", "apartment no", "unit no", "flat no"], systemField: "unitNo" },
  { patterns: ["wing", "tower", "block"], systemField: "tower" },
  { patterns: ["floor"], systemField: "floor" },
  { patterns: ["villa type", "villatype", "accommodation", "bhk"], systemField: "configuration" },
  { patterns: ["apt. status", "apt status", "status"], systemField: "status" },
  {
    patterns: [
      "salable area (sq.ft.)",
      "salable area (sq.ft)",
      "saleable area (sq.ft.)",
      "saleable area (sq.ft)",
      "salable area sq.ft",
      "saleable area sq.ft",
      "super builtup",
    ],
    systemField: "saleableAreaSqft",
  },
  {
    patterns: [
      "salable area (sq.mt.)",
      "salable area (sq.mt)",
      "saleable area (sq.mt.)",
      "saleable area (sq.mt)",
      "salable area sq.mt",
    ],
    systemField: "saleableAreaSqm",
  },
  {
    patterns: [
      "carpet area (sq.ft.)",
      "carpet area (sq.ft)",
      "carpet area sq.ft",
      "carpet area (sq.mts)",
      "carpet area sq.mts",
    ],
    systemField: "carpetAreaSqft",
  },
  { patterns: ["carpet area (sq.mt.)", "carpet area (sq.mt)", "carpet area sq.mt"], systemField: "carpetAreaSqm" },
  { patterns: ["balcony area (sq.ft.)", "balcony area sq.ft"], systemField: "balconyAreaSqft" },
  { patterns: ["balcony area (sq.mt.)", "balcony area sq.mt"], systemField: "balconyAreaSqm" },
  { patterns: ["base rate/sft", "base rate sft", "base rate", "rate/sft", "rate per sft"], systemField: "baseRatePerSqft" },
  { patterns: ["premium charges"], systemField: "premiumCharges" },
  { patterns: ["e-stamping", "e stamping", "estamping"], lineKey: "e_stamping" },
  { patterns: ["maintenance charges", "maintenance"], lineKey: "maintenance" },
  { patterns: ["corpus fund", "corpus", "refundable corpus"], lineKey: "corpus" },
  { patterns: ["clubhouse charges", "clubhouse"], lineKey: "clubhouse" },
  { patterns: ["gst applicable", "gst on basic", "gst on sale value"], lineKey: "gst_amount" },
  { patterns: ["basic salevalue with gst", "basic sale value with gst"], lineKey: "basic_with_gst" },
  { patterns: ["sale value", "basic sale value", "sale value (basic"], lineKey: "sale_value" },
  { patterns: ["gross apartment value", "gross apartment", "gross value"], lineKey: "gross_value" },
];

/** @deprecated Use EXCEL_HEADER_HINTS */
export const RIVIERA_HEADER_RULES = EXCEL_HEADER_HINTS;

function norm(s: string) {
  return normalizeExcelHeader(s).toLowerCase();
}

function matchesPattern(headerNorm: string, pattern: string) {
  const p = pattern.toLowerCase();
  if (headerNorm === p) return true;
  if (p === "sale value" && headerNorm.includes("gst")) return false;
  if (p === "basic sale value" && headerNorm.includes("gst")) return false;
  return headerNorm.includes(p);
}

function headerLabelsMatch(headerNorm: string, labelNorm: string) {
  if (!headerNorm || !labelNorm) return false;
  if (headerNorm === labelNorm) return true;
  if (headerNorm.includes(labelNorm) || labelNorm.includes(headerNorm)) return true;
  const tokenize = (s: string) => s.split(/[^a-z0-9]+/g).filter((t) => t.length > 2);
  const aTokens = tokenize(headerNorm);
  const bTokens = tokenize(labelNorm);
  if (aTokens.length === 0 || bTokens.length === 0) return false;
  const overlap = aTokens.filter((t) => bTokens.includes(t)).length;
  return overlap >= Math.min(2, Math.min(aTokens.length, bTokens.length));
}

/**
 * Build column map from Excel headers using this project's cost sheet lines first,
 * then global hints. Each project can use different column names.
 */
export function inferAutoColumnMap(
  rawHeaders: string[],
  lineDefinitions: Array<{ id: string; key: string; label: string; systemField?: string | null }>
): Record<string, ColumnMapTarget> {
  const columns = buildExcelColumnDescriptors(rawHeaders);
  const lineByKey = new Map(lineDefinitions.map((d) => [d.key, d]));
  const lineByLabel = new Map(lineDefinitions.map((d) => [norm(d.label), d]));

  const columnMap: Record<string, ColumnMapTarget> = {};

  for (const col of columns) {
    const headerNorm = norm(col.label);
    if (!headerNorm && !col.normalized) continue;

    let matched = false;

    const byExactLabel = lineByLabel.get(headerNorm);
    if (byExactLabel) {
      columnMap[col.mapKey] = byExactLabel.id;
      continue;
    }

    for (const def of lineDefinitions) {
      const defLabelNorm = norm(def.label);
      if (defLabelNorm && headerLabelsMatch(headerNorm, defLabelNorm)) {
        if (def.key === "sale_value" && /\bgst\b/i.test(headerNorm) && !/^sale\s*value/i.test(headerNorm)) {
          continue;
        }
        columnMap[col.mapKey] = def.id;
        matched = true;
        break;
      }
      if (def.systemField) {
        const sf = def.systemField as CostSheetSystemField;
        const sfLabel = COST_SHEET_SYSTEM_FIELD_LABELS[sf];
        if (sfLabel && headerLabelsMatch(headerNorm, norm(sfLabel))) {
          columnMap[col.mapKey] = `systemField:${sf}`;
          matched = true;
          break;
        }
      }
    }

    if (matched) continue;

    for (const rule of EXCEL_HEADER_HINTS) {
      if (rule.patterns.some((p) => matchesPattern(headerNorm, p))) {
        if (rule.systemField) {
          columnMap[col.mapKey] = `systemField:${rule.systemField}`;
          matched = true;
          break;
        }
        if (rule.lineKey) {
          const def = lineByKey.get(rule.lineKey);
          if (def) {
            columnMap[col.mapKey] = def.id;
            matched = true;
            break;
          }
        }
      }
    }
  }

  return columnMap;
}

export function pickMasterSheetName(sheetNames: string[]): string {
  const master = sheetNames.find((s) => norm(s).includes("master"));
  const price = sheetNames.find((s) => norm(s).includes("price") && !norm(s).includes("master"));
  return master ?? price ?? sheetNames[0] ?? "Sheet1";
}

/** Extended Riviera rows including computed Excel columns (display on cost sheet). */
export const RIVIERA_FULL_LINE_DEFINITIONS = [
  ...RIVIERA_DEFAULT_LINE_DEFINITIONS,
  { key: "sale_value", label: "Sale Value", role: "DISPLAY_ONLY", sortOrder: 15 },
  { key: "gst_amount", label: "GST applicable on Basic Sale Value", role: "DISPLAY_ONLY", sortOrder: 16 },
  { key: "basic_with_gst", label: "Basic Salevalue with GST", role: "DISPLAY_ONLY", sortOrder: 17 },
  { key: "gross_value", label: "Gross Apartment Value", role: "DISPLAY_ONLY", includeInGross: true, sortOrder: 18 },
] as const;
