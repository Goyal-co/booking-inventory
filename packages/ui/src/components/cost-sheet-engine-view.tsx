"use client";

import { formatPrice } from "../lib/utils";

export interface CostSheetEngineData {
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
  paymentSchedule: Array<{
    stageName: string;
    percentage?: number | null;
    amount: number;
    type?: string;
  }>;
  otherCharges: Array<{ name: string; amount: number }>;
  otherChargesTotal: number;
  grossApartmentValue: number;
  towerName?: string;
  unitNumber?: string;
  configuration?: string;
}

interface CostSheetEngineViewProps {
  costSheet: CostSheetEngineData;
  title?: string;
  compact?: boolean;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${Number(n)}%`;
}

export function CostSheetEngineView({
  costSheet,
  title = "Cost Sheet",
  compact = false,
}: CostSheetEngineViewProps) {
  const wing = costSheet.wing || costSheet.towerName || "—";
  const apartmentNo = costSheet.apartmentNo || costSheet.unitNumber || "—";
  const accommodation = costSheet.accommodationType || costSheet.configuration || "—";
  const floorLabel =
    costSheet.floorLabel || (costSheet.floor != null ? String(costSheet.floor) : "—");
  const gstPercent = costSheet.gstPercent ?? 5;

  const inventoryRows: Array<[string, string]> = [
    ["Wing", wing],
    ["Apartment No.", apartmentNo],
    ["Accommodation Type", accommodation],
    ["Floors", floorLabel],
    ["Saleable Area (Sq.ft.)", fmtNum(costSheet.saleableAreaSqft)],
    ["Carpet Area (Sq.Mt)* Excluding Balcony / Utility Area", fmtNum(costSheet.carpetAreaSqm)],
    ["Carpet Area (Sq.ft)* Excluding Balcony / Utility Area", fmtNum(costSheet.carpetAreaSqft)],
    ["Balcony Area (Sq.Mt.)", fmtNum(costSheet.balconyAreaSqm)],
    ["Balcony Area (Sq.ft.)", fmtNum(costSheet.balconyAreaSqft)],
    ["Unit Price per sq.ft. on Saleable Area (Rs.)", formatPrice(costSheet.saleablePricePerSqft)],
    ["Unit Price per sq.ft. on Carpet Area (Rs.)", formatPrice(costSheet.carpetPricePerSqft)],
    ["Basic Sale Value", formatPrice(costSheet.basicSaleValue)],
    [`GST applicable on Basic Sale Value (${gstPercent}%)`, formatPrice(costSheet.gstAmount)],
    ["Basic Sale Value with GST (A)", formatPrice(costSheet.basicSaleValueWithGst)],
  ];

  const paymentTotal = costSheet.paymentSchedule.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paymentPct = costSheet.paymentSchedule.reduce((s, p) => s + Number(p.percentage || 0), 0);

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${compact ? "" : "shadow-sm"}`}>
      <div className="border-b border-gray-200 bg-navy-600 px-4 py-3 text-white">
        <h3 className="font-semibold">{title}</h3>
        {costSheet.projectName ? (
          <p className="mt-0.5 text-xs text-white/80">{costSheet.projectName}</p>
        ) : null}
      </div>

      <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Inventory / Basic Cost
      </div>
      <table className="w-full text-sm">
        <tbody>
          {inventoryRows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2 text-gray-600">{label}</td>
              <td className="px-4 py-2 text-right font-medium text-gray-900">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-y border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Payment Schedule (on Basic Sale Value with GST — A)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Milestone Description</th>
              <th className="px-4 py-2 text-right font-medium">%</th>
              <th className="px-4 py-2 text-right font-medium">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {costSheet.paymentSchedule.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-gray-400">
                  No payment schedule configured for this project
                </td>
              </tr>
            ) : (
              costSheet.paymentSchedule.map((stage) => (
                <tr key={stage.stageName} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-700">{stage.stageName}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmtPct(stage.percentage)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">
                    {formatPrice(stage.amount)}
                  </td>
                </tr>
              ))
            )}
            <tr className="bg-indigo-50">
              <td className="px-4 py-2.5 font-semibold text-gray-900">TOTAL</td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
                {paymentPct ? fmtPct(Math.round(paymentPct * 100) / 100) : "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">
                {formatPrice(paymentTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="border-y border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Other Cost Charges &amp; Expenses (B)
      </div>
      <table className="w-full text-sm">
        <tbody>
          {costSheet.otherCharges.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-4 py-3 text-gray-400">
                No other charges configured for this project
              </td>
            </tr>
          ) : (
            costSheet.otherCharges.map((charge) => (
              <tr key={charge.name} className="border-b border-gray-100">
                <td className="px-4 py-2 text-gray-700">{charge.name}</td>
                <td className="px-4 py-2 text-right font-medium text-gray-900">
                  {formatPrice(charge.amount)}
                </td>
              </tr>
            ))
          )}
          <tr className="bg-slate-50">
            <td className="px-4 py-2.5 font-semibold text-gray-900">Sub Total (B)</td>
            <td className="px-4 py-2.5 text-right font-semibold text-gray-900">
              {formatPrice(costSheet.otherChargesTotal)}
            </td>
          </tr>
          <tr className="bg-amber-50">
            <td className="px-4 py-3 font-bold text-gray-900">Gross Apartment Value (A) + (B)</td>
            <td className="px-4 py-3 text-right font-bold text-amber-800">
              {formatPrice(costSheet.grossApartmentValue)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
