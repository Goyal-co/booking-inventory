"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@booking/ui";
import {
  COST_SHEET_SYSTEM_FIELDS,
  COST_SHEET_SYSTEM_FIELD_LABELS,
} from "@/lib/cost-sheet-constants";
import { toast } from "sonner";

export interface ColumnMappingRow {
  index: number;
  mapKey: string;
  label: string;
  normalized: string;
  sampleValue?: string;
  mappedTo?: string;
  mappedLabel: string;
  source: "auto" | "admin" | "unmapped";
}

interface LineDefinitionOption {
  id: string;
  label: string;
  key?: string;
  role?: string;
  systemField?: string | null;
}

interface ProjectCostExcelMappingPanelProps {
  projectId: string;
  rows: ColumnMappingRow[];
  columnMap: Record<string, string>;
  sheetName: string;
  headerRowIndex: number;
  excelSourceUrl: string;
  mappedCount: number;
  unmappedCount: number;
  lineOptions?: LineDefinitionOption[];
  onColumnMapChange: (map: Record<string, string>) => void;
  onSaved?: () => void;
}

export function ProjectCostExcelMappingPanel({
  projectId,
  rows,
  columnMap,
  sheetName,
  headerRowIndex,
  excelSourceUrl,
  mappedCount,
  unmappedCount,
  lineOptions: lineOptionsProp,
  onColumnMapChange,
  onSaved,
}: ProjectCostExcelMappingPanelProps) {
  const [fetchedLines, setFetchedLines] = useState<LineDefinitionOption[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLines = useCallback(() => {
    fetch(`/api/projects/${projectId}/cost-sheet-lines`)
      .then((r) => r.json())
      .then((data) => setFetchedLines(data.lines ?? []))
      .catch(() => setFetchedLines([]));
  }, [projectId]);

  useEffect(() => {
    if (!lineOptionsProp?.length) {
      loadLines();
    }
  }, [lineOptionsProp?.length, loadLines]);

  const lineOptions = lineOptionsProp?.length ? lineOptionsProp : fetchedLines;

  const selectOptions = useMemo(() => {
    const system = COST_SHEET_SYSTEM_FIELDS.map((field) => ({
      value: `systemField:${field}`,
      label: COST_SHEET_SYSTEM_FIELD_LABELS[field] ?? field,
      group: "System fields",
    }));
    const allLines = lineOptions.map((line) => ({
      value: line.id,
      label: line.label,
      group: "Cost sheet rows",
    }));
    return { system, allLines };
  }, [lineOptions]);

  const setMapping = useCallback(
    (mapKey: string, value: string) => {
      const next = { ...columnMap };
      if (!value) next[mapKey] = "__skip__";
      else next[mapKey] = value;
      onColumnMapChange(next);
    },
    [columnMap, onColumnMapChange]
  );

  const saveMapping = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-excel/mapping`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetName,
          headerRowIndex,
          columnMap,
          pricingMode: excelSourceUrl.trim() ? "LIVE" : "IMPORT",
          excelSourceUrl: excelSourceUrl.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to save mapping");
        return;
      }
      toast.success("Column mapping saved");
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excel column mapping</CardTitle>
        <p className="text-sm text-gray-600">
          Map Excel columns to <strong>Part A</strong> rows (inventory / basic cost) or{" "}
          <strong>Part B</strong> charges. Tower + Unit No are required for sync.
        </p>
        <p className="text-xs text-gray-500">
          Showing <strong>{rows.length}</strong> Excel columns ·{" "}
          <strong>{mappedCount}</strong> mapped · <strong>{unmappedCount}</strong> not mapped
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto overflow-y-auto rounded-lg border max-h-[min(70vh,640px)]">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">Excel column</th>
                <th className="px-3 py-2">Sample value</th>
                <th className="px-3 py-2">Maps to</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mapKey} className="border-t">
                  <td className="px-3 py-2 font-medium text-gray-900">{row.label}</td>
                  <td className="px-3 py-2 max-w-[140px] truncate text-gray-600">
                    {row.sampleValue || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                      value={
                        columnMap[row.mapKey] === "__skip__"
                          ? ""
                          : (columnMap[row.mapKey] ?? row.mappedTo ?? "")
                      }
                      onChange={(e) => setMapping(row.mapKey, e.target.value)}
                    >
                      <option value="">— Not mapped —</option>
                      <optgroup label="System fields">
                        {selectOptions.system.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </optgroup>
                      {selectOptions.allLines.length > 0 ? (
                        <optgroup label="Cost sheet rows (Part A + Part B)">
                          {selectOptions.allLines.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.source === "auto"
                          ? "bg-green-100 text-green-800"
                          : row.source === "admin"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.source === "auto" ? "Auto" : row.source === "admin" ? "Admin" : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={saveMapping} disabled={saving}>
            {saving ? "Saving…" : "Save column mapping"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
