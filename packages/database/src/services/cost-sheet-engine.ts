import {
  ChargeCalcMode,
  CostSheetLineCalcMode,
  CostSheetLineRole,
  PaymentStageType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../index";
import {
  resolveUnitPricingMaster,
  type UnitPricingMasterData,
} from "./cost-excel-live";
import { isPartACostSheetLine } from "./cost-excel-utils";

const SQFT_TO_SQM = 0.092903;
const DEFAULT_GST_PERCENT = 5;

type LineDefinitionRef = {
  id: string;
  key: string;
  label: string;
  role: CostSheetLineRole;
  systemField?: string | null;
  includeInGross?: boolean;
};

function findLineByKeys(
  lineDefinitions: LineDefinitionRef[],
  keys: string[],
  labelPattern?: RegExp
): LineDefinitionRef | null {
  for (const key of keys) {
    const found = lineDefinitions.find((d) => d.key === key);
    if (found) return found;
  }
  if (labelPattern) {
    return lineDefinitions.find((d) => labelPattern.test(d.label)) ?? null;
  }
  return null;
}

function findSaleValueLineDef(
  lineDefinitions: Array<{ id: string; key: string; label: string }>
) {
  return (
    lineDefinitions.find((d) => d.key === "sale_value") ??
    lineDefinitions.find(
      (d) =>
        /sale\s*value|basic\s*sale/i.test(d.label) &&
        !/gst/i.test(d.label)
    ) ??
    null
  );
}

function findGstLineDef(lineDefinitions: Array<{ id: string; key: string; label: string }>) {
  return (
    lineDefinitions.find((d) => d.key === "gst_amount") ??
    lineDefinitions.find(
      (d) =>
        /gst/i.test(d.label) &&
        !/with\s*gst/i.test(d.label.toLowerCase()) &&
        !/basic\s*sale/i.test(d.label.toLowerCase())
    ) ??
    null
  );
}

function findBasicWithGstLineDef(
  lineDefinitions: Array<{ id: string; key: string; label: string }>
) {
  return (
    lineDefinitions.find((d) => d.key === "basic_with_gst") ??
    lineDefinitions.find((d) => /basic.*with\s*gst|sale.*with\s*gst/i.test(d.label)) ??
    null
  );
}

/** Apply imported Excel totals and ensure GST / A are consistent. */
function applyImportedPricingTotals(
  basicSaleValue: number,
  gstAmount: number,
  basicSaleValueWithGst: number,
  gstPercent: number,
  master: UnitPricingMasterData | null,
  lineDefinitions: Array<{ id: string; key: string; label: string }>
): {
  basicSaleValue: number;
  gstAmount: number;
  basicSaleValueWithGst: number;
  pricingSource: "excel" | "computed";
} {
  let basic = basicSaleValue;
  let gst = gstAmount;
  let withGst = basicSaleValueWithGst;
  let pricingSource: "excel" | "computed" = "computed";

  if (!master) {
    return { basicSaleValue: basic, gstAmount: gst, basicSaleValueWithGst: withGst, pricingSource };
  }

  const saleValueDef = findSaleValueLineDef(lineDefinitions);
  const gstDef = findGstLineDef(lineDefinitions);
  const basicWithGstDef = findBasicWithGstLineDef(lineDefinitions);

  const excelBasic = saleValueDef ? getImportedValue(master, saleValueDef.id) : null;
  const excelGst = gstDef ? getImportedValue(master, gstDef.id) : null;
  const excelWithGst = basicWithGstDef ? getImportedValue(master, basicWithGstDef.id) : null;

  if (excelBasic != null || excelGst != null || excelWithGst != null) {
    pricingSource = "excel";
    if (excelBasic != null) basic = round2(excelBasic);
    if (excelGst != null) gst = round2(excelGst);
    else if (basic > 0) gst = round2(basic * (gstPercent / 100));
    if (excelWithGst != null) withGst = round2(excelWithGst);
    else withGst = round2(basic + gst);
  }

  return { basicSaleValue: basic, gstAmount: gst, basicSaleValueWithGst: withGst, pricingSource };
}

function syncPricingLineItemAmounts(
  lineItems: CostSheetLineItem[],
  basicSaleValue: number,
  gstAmount: number,
  basicSaleValueWithGst: number
) {
  for (const item of lineItems) {
    if (item.key === "sale_value") item.amount = basicSaleValue;
    if (item.key === "gst_amount") item.amount = gstAmount;
    if (item.key === "basic_with_gst") item.amount = basicSaleValueWithGst;
  }
}

export interface CostSheetPartAItem {
  key: string;
  label: string;
  displayValue: string;
}

export interface CostSheetLineItem {
  key: string;
  label: string;
  amount: number;
  source: "imported" | "template" | "computed" | "definition";
}

export interface CostSheetPaymentStage {
  stageName: string;
  percentage: number | null;
  amount: number;
  type: string;
}

export interface CostSheetResult {
  projectName: string;
  wing: string;
  apartmentNo: string;
  accommodationType: string;
  floor: number;
  floorLabel: string;
  saleableAreaSqft: number;
  saleableAreaSqm: number | null;
  carpetAreaSqft: number;
  carpetAreaSqm: number | null;
  balconyAreaSqft: number | null;
  balconyAreaSqm: number | null;
  saleablePricePerSqft: number;
  carpetPricePerSqft: number;
  basicSaleValue: number;
  gstPercent: number;
  gstAmount: number;
  basicSaleValueWithGst: number;
  paymentSchedule: CostSheetPaymentStage[];
  otherCharges: Array<{ name: string; amount: number }>;
  otherChargesTotal: number;
  grossApartmentValue: number;
  partAItems?: CostSheetPartAItem[];
  lineItems?: CostSheetLineItem[];
  pricingSource?: "excel" | "computed";
  dataSource?: "excel" | "engine";
}

export interface UnitPricingContext {
  unitId: string;
  projectId: string;
  projectName: string;
  unitNumber: string;
  towerName: string;
  configuration: string;
  floor: number;
  floorLabel: string;
  saleableAreaSqft: number;
  saleableAreaSqm: number | null;
  carpetAreaSqft: number;
  carpetAreaSqm: number | null;
  balconyAreaSqft: number | null;
  balconyAreaSqm: number | null;
  saleablePricePerSqft: number;
  gstPercent: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toSqm(sqft: number | null | undefined, existingSqm?: number | null) {
  if (existingSqm != null && Number.isFinite(Number(existingSqm))) return round2(Number(existingSqm));
  if (sqft == null || !Number.isFinite(sqft) || sqft <= 0) return null;
  return round2(sqft * SQFT_TO_SQM);
}

function ordinalFloor(n: number) {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (abs % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function fmtPartANumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtPartACurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function partASystemFieldDisplay(
  field: string,
  ctx: UnitPricingContext,
  saleablePricePerSqft: number,
  carpetPricePerSqft: number
): string {
  switch (field) {
    case "unitNo":
      return ctx.unitNumber || "—";
    case "tower":
      return ctx.towerName || "—";
    case "floor":
      return ctx.floorLabel || String(ctx.floor);
    case "configuration":
      return ctx.configuration || "—";
    case "status":
      return "—";
    case "saleableAreaSqft":
      return fmtPartANumber(ctx.saleableAreaSqft);
    case "saleableAreaSqm":
      return fmtPartANumber(ctx.saleableAreaSqm);
    case "carpetAreaSqft":
      return fmtPartANumber(ctx.carpetAreaSqft);
    case "carpetAreaSqm":
      return fmtPartANumber(ctx.carpetAreaSqm);
    case "balconyAreaSqft":
      return fmtPartANumber(ctx.balconyAreaSqft);
    case "balconyAreaSqm":
      return fmtPartANumber(ctx.balconyAreaSqm);
    case "baseRatePerSqft":
      return fmtPartACurrency(saleablePricePerSqft);
    case "premiumCharges":
      return "—";
    default:
      return "—";
  }
}

function buildPartAItems(
  lineDefinitions: Array<{
    id: string;
    key: string;
    label: string;
    role: CostSheetLineRole;
    systemField: string | null;
    calcMode: CostSheetLineCalcMode | null;
    fixedAmount: Prisma.Decimal | null;
    rate: Prisma.Decimal | null;
    areaField: string | null;
    months: number | null;
    includeInGross: boolean;
  }>,
  ctx: UnitPricingContext,
  master: UnitPricingMasterData | null,
  saleablePricePerSqft: number,
  carpetPricePerSqft: number,
  basicSaleValue: number,
  gstPercent: number,
  gstAmount: number,
  basicSaleValueWithGst: number
): CostSheetPartAItem[] {
  const items: CostSheetPartAItem[] = [];

  for (const def of lineDefinitions) {
    if (!isPartACostSheetLine(def)) continue;

    let displayValue = "—";
    let label = def.label;

    if (def.role === CostSheetLineRole.DISPLAY_ONLY) {
      let amount = chargeAmountFromDefinition(def, ctx, master);
      if (def.key === "sale_value") amount = basicSaleValue;
      if (def.key === "gst_amount") {
        amount = gstAmount;
        if (!label.includes("%")) label = `${label} (${gstPercent}%)`;
      }
      if (def.key === "basic_with_gst") {
        amount = basicSaleValueWithGst;
        if (!label.includes("(A)")) label = `${label} (A)`;
      }
      displayValue = fmtPartACurrency(amount);
    } else if (def.systemField) {
      if (def.systemField === "baseRatePerSqft") {
        displayValue = fmtPartACurrency(saleablePricePerSqft);
      } else if (/carpet/i.test(def.label) && /rate|price|sq\.?ft/i.test(def.label)) {
        displayValue = fmtPartACurrency(carpetPricePerSqft);
      } else {
        displayValue = partASystemFieldDisplay(
          def.systemField,
          ctx,
          saleablePricePerSqft,
          carpetPricePerSqft
        );
      }
    } else {
      const imported = getImportedValue(master, def.id, def.systemField);
      if (imported != null) {
        displayValue =
          def.role === CostSheetLineRole.RATE ? fmtPartACurrency(imported) : fmtPartANumber(imported);
      }
    }

    items.push({ key: def.key, label, displayValue });
  }

  return items;
}

function normalizeKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function areaForField(
  field: string | null | undefined,
  ctx: UnitPricingContext
): number {
  if (field === "carpet") return ctx.carpetAreaSqft;
  if (field === "balcony") return ctx.balconyAreaSqft ?? 0;
  return ctx.saleableAreaSqft;
}

async function loadUnitContext(unitId: string): Promise<UnitPricingContext | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      floorPlanType: true,
      floor: { include: { tower: { include: { project: true } } } },
    },
  });
  if (!unit) return null;

  const master = await resolveUnitPricingMaster(
    unit.floor.tower.projectId,
    unit.floor.tower.name,
    unit.unitNumber
  );

  const saleableAreaSqft = master?.saleableAreaSqft
    ? Number(master.saleableAreaSqft)
    : unit.floorPlanType?.superArea ?? unit.carpetArea ?? 0;
  const carpetAreaSqft = master?.carpetAreaSqft
    ? Number(master.carpetAreaSqft)
    : unit.floorPlanType?.carpetArea ?? unit.carpetArea ?? saleableAreaSqft;
  const balconyAreaSqft = master?.balconyAreaSqft
    ? Number(master.balconyAreaSqft)
    : unit.floorPlanType?.balconyArea
      ? Number(unit.floorPlanType.balconyArea)
      : null;

  const saleableAreaSqm = toSqm(saleableAreaSqft, master?.saleableAreaSqm ?? null);
  const carpetAreaSqm = toSqm(carpetAreaSqft, master?.carpetAreaSqm ?? null);
  const balconyAreaSqm = toSqm(balconyAreaSqft, master?.balconyAreaSqm ?? null);

  const projectDefault = unit.floor.tower.project.defaultSaleablePricePerSqft
    ? Number(unit.floor.tower.project.defaultSaleablePricePerSqft)
    : unit.basePrice && saleableAreaSqft
      ? Number(unit.basePrice) / saleableAreaSqft
      : 0;

  const masterBaseRate = master?.baseRatePerSqft ? Number(master.baseRatePerSqft) : null;
  const defaultPrice = masterBaseRate && masterBaseRate > 0 ? masterBaseRate : projectDefault;

  const configuration =
    master?.configuration ||
    unit.bhkType ||
    unit.floorPlanType?.bhkType ||
    "";

  return {
    unitId: unit.id,
    projectId: unit.floor.tower.projectId,
    projectName: unit.floor.tower.project.name,
    unitNumber: unit.unitNumber,
    towerName: unit.floor.tower.name,
    configuration,
    floor: master?.floor ?? unit.floor.number,
    floorLabel: unit.floor.label || ordinalFloor(unit.floor.number),
    saleableAreaSqft,
    saleableAreaSqm,
    carpetAreaSqft,
    carpetAreaSqm,
    balconyAreaSqft,
    balconyAreaSqm,
    saleablePricePerSqft: defaultPrice,
    gstPercent: unit.floor.tower.project.gstPercent
      ? Number(unit.floor.tower.project.gstPercent)
      : DEFAULT_GST_PERCENT,
  };
}

function getImportedValue(
  master: UnitPricingMasterData | null,
  lineId: string,
  systemField?: string | null
): number | null {
  if (!master) return null;
  const imported = master.importedValues;
  if (imported && imported[lineId] != null) {
    const n = Number(imported[lineId]);
    return Number.isFinite(n) ? n : null;
  }
  if (systemField === "premiumCharges" && master.premiumCharges != null) {
    return Number(master.premiumCharges);
  }
  return null;
}

function chargeAmountFromDefinition(
  def: {
    id: string;
    role: CostSheetLineRole;
    calcMode: CostSheetLineCalcMode | null;
    fixedAmount: Prisma.Decimal | null;
    rate: Prisma.Decimal | null;
    areaField: string | null;
    months: number | null;
    label: string;
    systemField: string | null;
  },
  ctx: UnitPricingContext,
  master: UnitPricingMasterData | null
): number {
  if (def.role !== CostSheetLineRole.OTHER_CHARGE && def.role !== CostSheetLineRole.DISPLAY_ONLY) {
    return 0;
  }

  const calcMode = def.calcMode ?? CostSheetLineCalcMode.IMPORTED_AMOUNT;

  if (calcMode === CostSheetLineCalcMode.FIXED && def.fixedAmount) {
    return round2(Number(def.fixedAmount));
  }

  if (calcMode === CostSheetLineCalcMode.RATE_PER_AREA && def.rate) {
    const months =
      def.months != null && def.months > 0
        ? def.months
        : /\b(\d+)\s*month/i.test(def.label)
          ? Number(/\b(\d+)\s*month/i.exec(def.label)?.[1] ?? 1)
          : 1;
    const area = areaForField(def.areaField, ctx);
    return round2(Number(def.rate) * area * months);
  }

  const imported = getImportedValue(master, def.id, def.systemField);
  return imported != null ? round2(imported) : 0;
}

export async function calculateCostSheet(
  unitId: string,
  saleablePricePerSqft: number
): Promise<CostSheetResult | null> {
  const ctx = await loadUnitContext(unitId);
  if (!ctx || !ctx.saleableAreaSqft) return null;

  const master = await resolveUnitPricingMaster(ctx.projectId, ctx.towerName, ctx.unitNumber);

  let basicSaleValue = round2(ctx.saleableAreaSqft * saleablePricePerSqft);
  const carpetPricePerSqft = ctx.carpetAreaSqft
    ? round2(basicSaleValue / ctx.carpetAreaSqft)
    : 0;
  const gstPercent = ctx.gstPercent || DEFAULT_GST_PERCENT;
  let gstAmount = round2(basicSaleValue * (gstPercent / 100));
  let basicSaleValueWithGst = round2(basicSaleValue + gstAmount);
  let pricingSource: "excel" | "computed" = "computed";

  const [scheduleTemplates, chargeTemplates, lineDefinitions] = await Promise.all([
    prisma.paymentScheduleTemplate.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.otherChargeTemplate.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.costSheetLineDefinition.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const importedPricing = applyImportedPricingTotals(
    basicSaleValue,
    gstAmount,
    basicSaleValueWithGst,
    gstPercent,
    master,
    lineDefinitions
  );
  basicSaleValue = importedPricing.basicSaleValue;
  gstAmount = importedPricing.gstAmount;
  basicSaleValueWithGst = importedPricing.basicSaleValueWithGst;
  pricingSource = importedPricing.pricingSource;

  let bookingFixedTotal = 0;
  for (const stage of scheduleTemplates) {
    if (stage.stageType === PaymentStageType.FIXED && stage.fixedAmount) {
      const name = stage.stageName.toLowerCase();
      if (
        name.includes("booking") ||
        name.includes("read") ||
        name.includes("earnest") ||
        name.includes("token")
      ) {
        bookingFixedTotal += Number(stage.fixedAmount);
      }
    }
  }

  const bookingTarget = round2(basicSaleValueWithGst * 0.1);
  const paymentSchedule: CostSheetPaymentStage[] = [];

  for (const stage of scheduleTemplates) {
    let amount = 0;
    let percentage: number | null = stage.percentage != null ? Number(stage.percentage) : null;

    if (stage.stageType === PaymentStageType.FIXED && stage.fixedAmount) {
      amount = Number(stage.fixedAmount);
      if (basicSaleValueWithGst > 0) {
        percentage = round2((amount / basicSaleValueWithGst) * 100);
      }
    } else if (stage.stageType === PaymentStageType.PERCENTAGE && stage.percentage) {
      percentage = Number(stage.percentage);
      amount = round2(basicSaleValueWithGst * (percentage / 100));
    } else if (stage.stageType === PaymentStageType.FORMULA && stage.formulaKey === "BALANCE_BOOKING") {
      amount = round2(Math.max(0, bookingTarget - bookingFixedTotal));
      percentage =
        basicSaleValueWithGst > 0 ? round2((amount / basicSaleValueWithGst) * 100) : 0;
    }

    paymentSchedule.push({
      stageName: stage.stageName,
      percentage,
      amount,
      type: stage.stageType,
    });
  }

  const lineItems: CostSheetLineItem[] = [];
  const otherCharges: Array<{ name: string; amount: number }> = [];
  const supersededTemplateKeys = new Set<string>();

  for (const def of lineDefinitions) {
    if (def.role !== CostSheetLineRole.OTHER_CHARGE) {
      continue;
    }

    const amount = chargeAmountFromDefinition(def, ctx, master);
    supersededTemplateKeys.add(normalizeKey(def.key));
    supersededTemplateKeys.add(normalizeKey(def.label));

    if (def.role === CostSheetLineRole.OTHER_CHARGE && amount > 0) {
      otherCharges.push({ name: def.label, amount });
    }

    if (amount > 0) {
      lineItems.push({
        key: def.key,
        label: def.label,
        amount,
        source:
          def.calcMode === CostSheetLineCalcMode.RATE_PER_AREA
            ? "computed"
            : def.calcMode === CostSheetLineCalcMode.FIXED
              ? "definition"
              : "imported",
      });
    }
  }

  for (const c of chargeTemplates) {
    const templateKey = normalizeKey(c.name);
    if (supersededTemplateKeys.has(templateKey)) continue;

    let amount = 0;
    if (c.calcMode === ChargeCalcMode.FIXED && c.amount) {
      amount = Number(c.amount);
    } else if (c.calcMode === ChargeCalcMode.RATE_PER_AREA && c.rate) {
      const months =
        c.months != null && Number(c.months) > 0
          ? Number(c.months)
          : /\b(\d+)\s*month/i.test(c.name)
            ? Number(/\b(\d+)\s*month/i.exec(c.name)?.[1] ?? 1)
            : 1;
      const area = areaForField(c.areaField, ctx);
      amount = round2(Number(c.rate) * area * months);
    }

    if (amount > 0) {
      otherCharges.push({ name: c.name, amount });
      lineItems.push({
        key: templateKey,
        label: c.name,
        amount,
        source: c.calcMode === ChargeCalcMode.RATE_PER_AREA ? "computed" : "template",
      });
    }
  }

  syncPricingLineItemAmounts(lineItems, basicSaleValue, gstAmount, basicSaleValueWithGst);

  const otherChargesTotal = round2(otherCharges.reduce((s, c) => s + c.amount, 0));

  const grossFromLines = lineDefinitions
    .filter((d) => d.role === CostSheetLineRole.OTHER_CHARGE && d.includeInGross)
    .reduce((s, d) => s + chargeAmountFromDefinition(d, ctx, master), 0);

  const grossFromTemplates = chargeTemplates
    .filter((c) => !supersededTemplateKeys.has(normalizeKey(c.name)))
    .reduce((s, c) => {
      let amount = 0;
      if (c.calcMode === ChargeCalcMode.FIXED && c.amount) amount = Number(c.amount);
      else if (c.calcMode === ChargeCalcMode.RATE_PER_AREA && c.rate) {
        const months =
          c.months != null && Number(c.months) > 0
            ? Number(c.months)
            : /\b(\d+)\s*month/i.test(c.name)
              ? Number(/\b(\d+)\s*month/i.exec(c.name)?.[1] ?? 1)
              : 1;
        amount = round2(Number(c.rate) * areaForField(c.areaField, ctx) * months);
      }
      return s + amount;
    }, 0);

  const grossApartmentValue = round2(
    basicSaleValueWithGst + grossFromLines + grossFromTemplates
  );

  let finalGross = grossApartmentValue;
  if (master?.importedValues) {
    const grossDef =
      findLineByKeys(lineDefinitions, ["gross_value", "gross_apartment_value"], /gross/i) ??
      lineDefinitions.find((d) => d.includeInGross && d.role === CostSheetLineRole.DISPLAY_ONLY);
    if (grossDef) {
      const excelGross = getImportedValue(master, grossDef.id, grossDef.systemField);
      if (excelGross != null) {
        finalGross = round2(excelGross);
        if (pricingSource === "excel") {
          // keep payment schedule on recalculated or excel A — gross from Excel row
        }
      }
    }
  }

  const finalCarpetPricePerSqft = ctx.carpetAreaSqft
    ? round2(basicSaleValue / ctx.carpetAreaSqft)
    : carpetPricePerSqft;

  const partAItems = buildPartAItems(
    lineDefinitions,
    ctx,
    master,
    saleablePricePerSqft,
    finalCarpetPricePerSqft,
    basicSaleValue,
    gstPercent,
    gstAmount,
    basicSaleValueWithGst
  );

  return {
    projectName: ctx.projectName,
    wing: ctx.towerName,
    apartmentNo: ctx.unitNumber,
    accommodationType: ctx.configuration,
    floor: ctx.floor,
    floorLabel: ctx.floorLabel,
    saleableAreaSqft: ctx.saleableAreaSqft,
    saleableAreaSqm: ctx.saleableAreaSqm,
    carpetAreaSqft: ctx.carpetAreaSqft,
    carpetAreaSqm: ctx.carpetAreaSqm,
    balconyAreaSqft: ctx.balconyAreaSqft,
    balconyAreaSqm: ctx.balconyAreaSqm,
    saleablePricePerSqft,
    carpetPricePerSqft: finalCarpetPricePerSqft,
    basicSaleValue,
    gstPercent,
    gstAmount,
    basicSaleValueWithGst,
    paymentSchedule,
    otherCharges,
    otherChargesTotal,
    grossApartmentValue: finalGross,
    partAItems,
    lineItems,
    pricingSource,
    dataSource: pricingSource === "excel" ? "excel" : "engine",
  };
}

export function buildPage1Snapshot(
  ctx: UnitPricingContext,
  costSheet: CostSheetResult
): Prisma.InputJsonValue {
  return {
    ...costSheet,
    projectName: ctx.projectName,
    towerName: ctx.towerName,
    unitNumber: ctx.unitNumber,
    floor: ctx.floor,
    configuration: ctx.configuration,
  } as unknown as Prisma.InputJsonValue;
}

export async function getUnitPricingContext(unitId: string) {
  return loadUnitContext(unitId);
}
