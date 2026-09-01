"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  CostSheetEngineView,
  type CostSheetEngineData,
  formatPrice,
} from "@booking/ui";

export interface InventoryPreviewUnit {
  id: string;
  unitNumber: string;
  towerName: string;
  towerCode: string;
  status: string;
  configuration: string;
  floor: number;
  saleableAreaSqft: number;
  baseRatePerSqft: number | null;
  hasMasterRow: boolean;
}

interface ProjectCostExcelInventoryPreviewProps {
  projectId: string;
  units?: InventoryPreviewUnit[];
  initialUnitId?: string;
  onUnitsChange?: (units: InventoryPreviewUnit[]) => void;
  showInventoryTable?: boolean;
  showCostSheetPreview?: boolean;
  embedded?: boolean;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function statusBadgeClass(status: string) {
  if (status === "AVAILABLE") return "bg-green-100 text-green-800";
  if (status === "BOOKED" || status === "BLOCKED") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

export function ProjectCostExcelInventoryPreview({
  projectId,
  units: unitsProp,
  initialUnitId,
  onUnitsChange,
  showInventoryTable = true,
  showCostSheetPreview = true,
  embedded = false,
}: ProjectCostExcelInventoryPreviewProps) {
  const [units, setUnits] = useState<InventoryPreviewUnit[]>(unitsProp ?? []);
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnitId ?? "");
  const [costSheet, setCostSheet] = useState<CostSheetEngineData | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(!unitsProp?.length);
  const [loadingCostSheet, setLoadingCostSheet] = useState(false);

  const refreshUnits = useCallback(async () => {
    setLoadingUnits(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/inventory-preview`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const list = (data.units ?? []) as InventoryPreviewUnit[];
        setUnits(list);
        onUnitsChange?.(list);
        return list;
      }
    } finally {
      setLoadingUnits(false);
    }
    return [];
  }, [projectId, onUnitsChange]);

  useEffect(() => {
    if (unitsProp?.length) {
      setUnits(unitsProp);
      setLoadingUnits(false);
    }
  }, [unitsProp]);

  useEffect(() => {
    if (!unitsProp?.length) {
      refreshUnits();
    }
  }, [unitsProp, refreshUnits]);

  const availableUnits = useMemo(
    () => units.filter((u) => u.status === "AVAILABLE"),
    [units]
  );

  const selectableUnits = availableUnits.length > 0 ? availableUnits : units;

  useEffect(() => {
    if (!selectedUnitId && selectableUnits.length > 0) {
      setSelectedUnitId(selectableUnits[0].id);
    }
  }, [selectableUnits, selectedUnitId]);

  useEffect(() => {
    if (initialUnitId && !selectedUnitId) {
      setSelectedUnitId(initialUnitId);
    }
  }, [initialUnitId, selectedUnitId]);

  const loadCostSheet = useCallback(async (unitId: string) => {
    if (!unitId) return;
    setLoadingCostSheet(true);
    try {
      const res = await fetch("/api/cost-sheet/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.costSheet) {
        setCostSheet(data.costSheet as CostSheetEngineData);
      } else {
        setCostSheet(null);
      }
    } finally {
      setLoadingCostSheet(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUnitId) return;
    loadCostSheet(selectedUnitId);
  }, [selectedUnitId, loadCostSheet]);

  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  if (loadingUnits && units.length === 0) {
    return <p className="text-sm text-gray-500">Loading inventory preview…</p>;
  }

  if (!showInventoryTable && !showCostSheetPreview) {
    return null;
  }

  if (units.length === 0) {
    if (!showCostSheetPreview) {
      return (
        <p className="text-sm text-amber-700">
          No inventory units yet. Sync from Excel with &quot;Replace inventory&quot; to create units.
        </p>
      );
    }
    return (
      <p className="text-sm text-amber-700">
        No inventory units yet. Sync from Excel with &quot;Replace inventory&quot; to create units,
        then return here to preview cost sheets.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {showInventoryTable ? (
      <Card>
        <CardHeader>
          <CardTitle>Inventory preview ({units.length} units)</CardTitle>
          <p className="text-sm text-gray-600">
            Units in project inventory after Excel sync.{" "}
            <strong>{availableUnits.length}</strong> available for booking.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border max-h-80">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">Tower / Wing</th>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Floor</th>
                  <th className="px-3 py-2 text-right">Saleable sq.ft.</th>
                  <th className="px-3 py-2 text-right">Base ₹/sq.ft</th>
                  <th className="px-3 py-2">Excel row</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr
                    key={unit.id}
                    className={`border-t cursor-pointer hover:bg-brand-50/50 ${
                      unit.id === selectedUnitId ? "bg-brand-50" : ""
                    }`}
                    onClick={() => setSelectedUnitId(unit.id)}
                  >
                    <td className="px-3 py-2">{unit.towerName}</td>
                    <td className="px-3 py-2 font-medium">{unit.unitNumber}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(unit.status)}`}
                      >
                        {unit.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{unit.configuration || "—"}</td>
                    <td className="px-3 py-2 text-right">{unit.floor}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(unit.saleableAreaSqft)}</td>
                    <td className="px-3 py-2 text-right">{fmtNum(unit.baseRatePerSqft)}</td>
                    <td className="px-3 py-2">
                      {unit.hasMasterRow ? (
                        <span className="text-green-700">Linked</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      ) : null}

      {showCostSheetPreview ? (
        embedded ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px]">
                <Label>Select unit</Label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={selectedUnitId}
                  onChange={(e) => setSelectedUnitId(e.target.value)}
                >
                  {selectableUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.towerName} / {unit.unitNumber}
                      {unit.status !== "AVAILABLE" ? ` (${unit.status})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {selectedUnit ? (
                <p className="text-sm text-gray-600">
                  {selectedUnit.configuration || "—"} · {fmtNum(selectedUnit.saleableAreaSqft)} sq.ft.
                  {selectedUnit.baseRatePerSqft
                    ? ` · ${formatPrice(selectedUnit.baseRatePerSqft)}/sq.ft`
                    : ""}
                </p>
              ) : null}
            </div>
            {loadingCostSheet ? (
              <p className="text-sm text-gray-500">Calculating cost sheet…</p>
            ) : costSheet ? (
              <CostSheetEngineView
                costSheet={costSheet}
                title={
                  selectedUnit
                    ? `Cost sheet — ${selectedUnit.towerName} / ${selectedUnit.unitNumber}`
                    : "Cost sheet"
                }
              />
            ) : (
              <p className="text-sm text-amber-700">
                Cost sheet unavailable for this unit. Check saleable area, base rate in Excel, and
                payment schedule / other charges for this project.
              </p>
            )}
          </div>
        ) : (
      <Card>
        <CardHeader>
          <CardTitle>Cost sheet preview</CardTitle>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <div className="min-w-[240px]">
              <Label>Select unit</Label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                {selectableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.towerName} / {unit.unitNumber}
                    {unit.status !== "AVAILABLE" ? ` (${unit.status})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {selectedUnit ? (
              <p className="text-sm text-gray-600">
                {selectedUnit.configuration || "—"} · {fmtNum(selectedUnit.saleableAreaSqft)} sq.ft.
                {selectedUnit.baseRatePerSqft
                  ? ` · ${formatPrice(selectedUnit.baseRatePerSqft)}/sq.ft`
                  : ""}
              </p>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {loadingCostSheet ? (
            <p className="text-sm text-gray-500">Calculating cost sheet…</p>
          ) : costSheet ? (
            <CostSheetEngineView
              costSheet={costSheet}
              title={
                selectedUnit
                  ? `Cost sheet — ${selectedUnit.towerName} / ${selectedUnit.unitNumber}`
                  : "Cost sheet"
              }
            />
          ) : (
            <p className="text-sm text-amber-700">
              Cost sheet unavailable for this unit. Check saleable area, base rate in Excel, and
              payment schedule / other charges for this project.
            </p>
          )}
        </CardContent>
      </Card>
        )
      ) : null}
    </div>
  );
}
