"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@booking/ui";
import { toast } from "sonner";
import {
  AREA_FIELD_OPTIONS,
  isPartALine,
  LINE_CALC_MODE_OPTIONS,
  PART_A_ROLE_OPTIONS,
  slugifyLineKey,
} from "@/lib/cost-sheet-constants";

export interface CostSheetLineRow {
  id: string;
  key: string;
  label: string;
  role: string;
  calcMode: string | null;
  includeInGross: boolean;
  isRequired: boolean;
  sortOrder: number;
  systemField: string | null;
  fixedAmount?: number | string | null;
  rate?: number | string | null;
  areaField?: string | null;
  months?: number | null;
}

interface DraftLine {
  label: string;
  role: string;
  calcMode: string;
  includeInGross: boolean;
  fixedAmount: string;
  rate: string;
  areaField: string;
  months: string;
}

const emptyDraft = (): DraftLine => ({
  label: "",
  role: "DISPLAY_ONLY",
  calcMode: "IMPORTED_AMOUNT",
  includeInGross: false,
  fixedAmount: "",
  rate: "",
  areaField: "saleable",
  months: "1",
});

function roleLabel(role: string) {
  return PART_A_ROLE_OPTIONS.find((r) => r.value === role)?.label ?? role;
}

function calcModeLabel(mode: string | null) {
  if (!mode) return "—";
  return LINE_CALC_MODE_OPTIONS.find((m) => m.value === mode)?.label ?? mode;
}

export interface ExcelColumnOption {
  mapKey: string;
  label: string;
}

/** Part A — Inventory / Basic Cost rows (customizable; Part B + payment plan configured separately). */
export function ProjectCostSheetPartAPanel({
  projectId,
  onLinesChange,
  excelColumns = [],
  columnMap = {},
  onColumnMapChange,
}: {
  projectId: string;
  onLinesChange?: (lines: CostSheetLineRow[]) => void;
  excelColumns?: ExcelColumnOption[];
  columnMap?: Record<string, string>;
  onColumnMapChange?: (map: Record<string, string>) => void;
}) {
  const [lines, setLines] = useState<CostSheetLineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [draft, setDraft] = useState<DraftLine>(emptyDraft());
  const [showAdd, setShowAdd] = useState(false);
  const onLinesChangeRef = useRef(onLinesChange);
  onLinesChangeRef.current = onLinesChange;

  const partALines = useMemo(
    () => lines.filter((l) => isPartALine(l.role, l.includeInGross, l.key)),
    [lines]
  );

  const excelColumnForLine = (line: CostSheetLineRow) => {
    for (const [mapKey, target] of Object.entries(columnMap)) {
      if (target === line.id) return mapKey;
      if (line.systemField && target === `systemField:${line.systemField}`) return mapKey;
    }
    return "";
  };

  const setExcelColumnForLine = (line: CostSheetLineRow, mapKey: string) => {
    if (!onColumnMapChange) return;
    const next = { ...columnMap };
    for (const [k, v] of Object.entries(next)) {
      if (v === line.id || (line.systemField && v === `systemField:${line.systemField}`)) {
        delete next[k];
      }
    }
    if (mapKey) {
      const target =
        line.systemField &&
        line.role !== "DISPLAY_ONLY" &&
        line.role !== "OTHER_CHARGE"
          ? `systemField:${line.systemField}`
          : line.id;
      next[mapKey] = target;
    }
    onColumnMapChange(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-sheet-lines`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : `Request failed (${res.status})`;
        setLoadError(msg);
        return;
      }
      const list = (data.lines ?? []) as CostSheetLineRow[];
      setLines(list);
      onLinesChangeRef.current?.(list);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load Part A rows");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveLine = async (line: Partial<CostSheetLineRow> & { id?: string }) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-sheet-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(line),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to save row");
        return false;
      }
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const addLine = async () => {
    const label = draft.label.trim();
    if (!label) {
      toast.error("Label is required");
      return;
    }
    const baseKey = slugifyLineKey(label);
    const existingKeys = new Set(lines.map((l) => l.key));
    let key = baseKey;
    let n = 2;
    while (existingKeys.has(key)) {
      key = `${baseKey}_${n}`;
      n += 1;
    }

    const payload: Record<string, unknown> = {
      key,
      label,
      role: draft.role,
      calcMode: draft.role === "DISPLAY_ONLY" ? draft.calcMode : "IMPORTED_AMOUNT",
      includeInGross: false,
      sortOrder: partALines.length,
    };

    if (draft.calcMode === "FIXED" && draft.fixedAmount) {
      payload.fixedAmount = Number(draft.fixedAmount);
    }
    if (draft.calcMode === "RATE_PER_AREA") {
      if (draft.rate) payload.rate = Number(draft.rate);
      payload.areaField = draft.areaField;
      payload.months = draft.months ? Number(draft.months) : 1;
    }

    const ok = await saveLine(payload);
    if (ok) {
      toast.success("Part A row added — map it to an Excel column below");
      setDraft(emptyDraft());
      setShowAdd(false);
    }
  };

  const deleteLine = async (line: CostSheetLineRow) => {
    if (line.isRequired) {
      toast.error("Required identity rows cannot be removed. Edit the label instead.");
      return;
    }
    if (
      !confirm(
        `Remove "${line.label}" from Part A? Excel mappings for this row will be cleared.`
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/cost-sheet-lines?lineId=${encodeURIComponent(line.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Failed to delete row");
        return;
      }
      toast.success("Part A row removed");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const seedLines = async (full: boolean) => {
    setSeeding(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-sheet-lines/seed-riviera`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Failed to seed rows");
        return;
      }
      toast.success(
        full
          ? `Seeded Part A rows including Sale Value, GST, and (A)`
          : `Seeded ${data.seeded ?? 0} Part A inventory rows`
      );
      await load();
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-gray-500">Loading Part A rows…</p>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-6 space-y-3">
          <p className="text-sm text-red-700">Could not load Part A rows: {loadError}</p>
          <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Part A — Inventory / Basic Cost</CardTitle>
        <p className="text-sm text-gray-600">
          Customize rows shown above the payment schedule: wing, areas, rates, sale value, GST, and
          (A). Add or remove rows here, then map each Excel column to a Part A row after Load
          preview. Part B charges and payment milestones are configured in sections 2–3 above.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={seeding || saving} onClick={() => seedLines(false)}>
            {seeding ? "Seeding…" : "Seed Part A inventory rows"}
          </Button>
          <Button size="sm" variant="outline" disabled={seeding || saving} onClick={() => seedLines(true)}>
            Seed + Sale Value / GST / (A)
          </Button>
          <Button size="sm" disabled={saving} onClick={() => setShowAdd((v) => !v)}>
            {showAdd ? "Cancel" : "Add Part A row"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAdd ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-800">New Part A row</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Row label (match Excel header)</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Salable Area (Sq.ft.)"
                  value={draft.label}
                  onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </div>
              <div>
                <Label>Row type</Label>
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={draft.role}
                  onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                >
                  {PART_A_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {draft.role === "DISPLAY_ONLY" ? (
                <div>
                  <Label>Value source</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={draft.calcMode}
                    onChange={(e) => setDraft((d) => ({ ...d, calcMode: e.target.value }))}
                  >
                    {LINE_CALC_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {draft.calcMode === "FIXED" ? (
                <div>
                  <Label>Fixed amount (₹)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    value={draft.fixedAmount}
                    onChange={(e) => setDraft((d) => ({ ...d, fixedAmount: e.target.value }))}
                  />
                </div>
              ) : null}
              {draft.calcMode === "RATE_PER_AREA" ? (
                <>
                  <div>
                    <Label>Rate (₹)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      value={draft.rate}
                      onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Area field</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      value={draft.areaField}
                      onChange={(e) => setDraft((d) => ({ ...d, areaField: e.target.value }))}
                    >
                      {AREA_FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Months</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      min={1}
                      value={draft.months}
                      onChange={(e) => setDraft((d) => ({ ...d, months: e.target.value }))}
                    />
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button onClick={addLine} disabled={saving}>
                {saving ? "Saving…" : "Add row"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Value source</th>
                <th className="px-3 py-2">Excel column</th>
                <th className="px-3 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {partALines.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-gray-400">
                    No Part A rows yet. Seed standard rows or add custom rows, then map Excel columns.
                  </td>
                </tr>
              ) : (
                partALines.map((line) => (
                  <tr key={line.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900">{line.label}</span>
                      {line.isRequired ? (
                        <span className="ml-2 text-xs text-amber-700">Required</span>
                      ) : null}
                      {line.systemField ? (
                        <span className="ml-2 text-xs text-gray-400">({line.systemField})</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{roleLabel(line.role)}</td>
                    <td className="px-3 py-2 text-gray-600">{calcModeLabel(line.calcMode)}</td>
                    <td className="px-3 py-2">
                      {excelColumns.length > 0 ? (
                        <select
                          className="w-full min-w-[160px] max-w-xs rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                          value={excelColumnForLine(line)}
                          onChange={(e) => setExcelColumnForLine(line, e.target.value)}
                        >
                          <option value="">— Not mapped —</option>
                          {excelColumns.map((col) => (
                            <option key={col.mapKey} value={col.mapKey}>
                              {col.label || col.mapKey}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">
                          Load Excel preview below to pick columns
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!line.isRequired ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          disabled={saving}
                          onClick={() => deleteLine(line)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">
          <strong>{partALines.length}</strong> Part A rows ·{" "}
          {excelColumns.length > 0
            ? `${excelColumns.length} Excel columns available — pick per row above or use the full mapping table below.`
            : "Load preview in section 5 to list all Excel columns for mapping."}
        </p>
      </CardContent>
    </Card>
  );
}

/** @deprecated Use ProjectCostSheetPartAPanel */
export const ProjectCostSheetLinesPanel = ProjectCostSheetPartAPanel;
