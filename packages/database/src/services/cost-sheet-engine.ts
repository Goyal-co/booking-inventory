import { ChargeCalcMode, PaymentStageType, Prisma } from "@prisma/client";
import { prisma } from "../index";

const SQFT_TO_SQM = 0.092903;
const DEFAULT_GST_PERCENT = 5;

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

async function loadUnitContext(unitId: string): Promise<UnitPricingContext | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      floorPlanType: true,
      floor: { include: { tower: { include: { project: true } } } },
    },
  });
  if (!unit) return null;

  const master = await prisma.unitMasterRow.findFirst({
    where: {
      projectId: unit.floor.tower.projectId,
      unitNo: unit.unitNumber,
      tower: unit.floor.tower.name,
    },
  });

  const saleableAreaSqft = master
    ? Number(master.saleableAreaSqft)
    : unit.floorPlanType?.superArea ?? unit.carpetArea ?? 0;
  const carpetAreaSqft = master
    ? Number(master.carpetAreaSqft ?? 0)
    : unit.floorPlanType?.carpetArea ?? unit.carpetArea ?? saleableAreaSqft;
  const balconyAreaSqft = master?.balconyAreaSqft
    ? Number(master.balconyAreaSqft)
    : unit.floorPlanType?.balconyArea
      ? Number(unit.floorPlanType.balconyArea)
      : null;

  const saleableAreaSqm = toSqm(saleableAreaSqft, master?.saleableAreaSqm ? Number(master.saleableAreaSqm) : null);
  const carpetAreaSqm = toSqm(carpetAreaSqft, master?.carpetAreaSqm ? Number(master.carpetAreaSqm) : null);
  const balconyAreaSqm = toSqm(
    balconyAreaSqft,
    master?.balconyAreaSqm ? Number(master.balconyAreaSqm) : null
  );

  const defaultPrice = unit.floor.tower.project.defaultSaleablePricePerSqft
    ? Number(unit.floor.tower.project.defaultSaleablePricePerSqft)
    : unit.basePrice && saleableAreaSqft
      ? Number(unit.basePrice) / saleableAreaSqft
      : 0;

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
    floor: unit.floor.number,
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

export async function calculateCostSheet(
  unitId: string,
  saleablePricePerSqft: number
): Promise<CostSheetResult | null> {
  const ctx = await loadUnitContext(unitId);
  if (!ctx || !ctx.saleableAreaSqft) return null;

  const basicSaleValue = round2(ctx.saleableAreaSqft * saleablePricePerSqft);
  const carpetPricePerSqft = ctx.carpetAreaSqft
    ? round2(basicSaleValue / ctx.carpetAreaSqft)
    : 0;
  const gstPercent = ctx.gstPercent || DEFAULT_GST_PERCENT;
  const gstAmount = round2(basicSaleValue * (gstPercent / 100));
  const basicSaleValueWithGst = round2(basicSaleValue + gstAmount);

  const [scheduleTemplates, chargeTemplates] = await Promise.all([
    prisma.paymentScheduleTemplate.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.otherChargeTemplate.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  let bookingFixedTotal = 0;
  const paymentSchedule: CostSheetPaymentStage[] = [];

  for (const stage of scheduleTemplates) {
    let amount = 0;
    let percentage: number | null = stage.percentage != null ? Number(stage.percentage) : null;

    if (stage.stageType === PaymentStageType.FIXED && stage.fixedAmount) {
      amount = Number(stage.fixedAmount);
      if (stage.stageName.toLowerCase().includes("booking") || stage.stageName.toLowerCase().includes("read")) {
        bookingFixedTotal += amount;
      }
      if (basicSaleValueWithGst > 0) {
        percentage = round2((amount / basicSaleValueWithGst) * 100);
      }
    } else if (stage.stageType === PaymentStageType.PERCENTAGE && stage.percentage) {
      percentage = Number(stage.percentage);
      amount = round2(basicSaleValueWithGst * (percentage / 100));
    } else if (stage.stageType === PaymentStageType.FORMULA && stage.formulaKey === "BALANCE_BOOKING") {
      percentage = 10;
      amount = round2(basicSaleValueWithGst * 0.1 - bookingFixedTotal);
    }

    paymentSchedule.push({
      stageName: stage.stageName,
      percentage,
      amount,
      type: stage.stageType,
    });
  }

  const otherCharges = chargeTemplates.map((c) => {
    let amount = 0;
    if (c.calcMode === ChargeCalcMode.FIXED && c.amount) {
      amount = Number(c.amount);
    } else if (c.calcMode === ChargeCalcMode.RATE_PER_AREA && c.rate) {
      const months = c.months ?? 1;
      const area =
        c.areaField === "carpet"
          ? ctx.carpetAreaSqft
          : c.areaField === "balcony"
            ? ctx.balconyAreaSqft ?? 0
            : ctx.saleableAreaSqft;
      amount = round2(Number(c.rate) * area * months);
    }
    return { name: c.name, amount };
  });

  const otherChargesTotal = round2(otherCharges.reduce((s, c) => s + c.amount, 0));
  const grossApartmentValue = round2(basicSaleValueWithGst + otherChargesTotal);

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
    carpetPricePerSqft,
    basicSaleValue,
    gstPercent,
    gstAmount,
    basicSaleValueWithGst,
    paymentSchedule,
    otherCharges,
    otherChargesTotal,
    grossApartmentValue,
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
  };
}

export async function getUnitPricingContext(unitId: string) {
  return loadUnitContext(unitId);
}
