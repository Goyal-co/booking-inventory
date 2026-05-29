"use client";

import { formatPrice, type CostSheetData } from "../lib/utils";

interface CostSheetTableProps {
  costSheet: CostSheetData;
  readOnly?: boolean;
}

export function CostSheetTable({ costSheet, readOnly = true }: CostSheetTableProps) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h4 className="font-semibold text-gray-900">{costSheet.name}</h4>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {costSheet.lineItems.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2 text-gray-600">{item.label}</td>
              <td className="px-4 py-2 text-right font-medium text-gray-900">
                {formatPrice(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-blue-50">
            <td className="px-4 py-3 font-bold text-gray-900">Total</td>
            <td className="px-4 py-3 text-right font-bold text-blue-700">
              {formatPrice(costSheet.totalPrice)}
            </td>
          </tr>
        </tfoot>
      </table>
      {!readOnly && (
        <p className="px-4 py-2 text-xs text-gray-400">Editable in admin panel only</p>
      )}
    </div>
  );
}
