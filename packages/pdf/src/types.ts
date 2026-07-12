export interface CostSheetPaymentStage {
  stageName: string;
  percentage?: number | null;
  amount: number;
  type?: string;
}

export interface CostSheetResult {
  projectName?: string;
  wing?: string;
  apartmentNo?: string;
  accommodationType?: string;
  floor?: number;
  floorLabel?: string;
  saleableAreaSqft: number;
  saleableAreaSqm?: number | null;
  carpetAreaSqft: number;
  carpetAreaSqm?: number | null;
  balconyAreaSqft?: number | null;
  balconyAreaSqm?: number | null;
  saleablePricePerSqft: number;
  carpetPricePerSqft: number;
  basicSaleValue: number;
  gstPercent?: number;
  gstAmount: number;
  basicSaleValueWithGst: number;
  paymentSchedule: CostSheetPaymentStage[];
  otherCharges: Array<{ name: string; amount: number }>;
  otherChargesTotal: number;
  grossApartmentValue: number;
  /** legacy aliases used by older snapshots */
  towerName?: string;
  unitNumber?: string;
  configuration?: string;
}
