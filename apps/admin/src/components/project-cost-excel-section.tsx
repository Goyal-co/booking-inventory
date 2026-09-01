"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  type CostSheetEngineData,
  formatPrice,
} from "@booking/ui";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Info } from "lucide-react";
import { columnMapCoversSystemField } from "@booking/database";
import { ProjectCostExcelMappingPanel } from "./project-cost-excel-mapping-panel";
import {
  ProjectCostSheetPartAPanel,
  type CostSheetLineRow,
} from "./project-cost-sheet-lines-panel";
import {
  ProjectCostExcelInventoryPreview,
  type InventoryPreviewUnit,
} from "./project-cost-excel-inventory-preview";

interface LineDefinitionRef {
  id: string;
  label: string;
  key: string;
  role: string;
  systemField?: string | null;
  includeInGross?: boolean;
}

interface ImportBatch {
  id: string;
  fileName: string;
  rowCount: number;
  createdAt: string;
}

interface PreviewColumn {
  key: string;
  label: string;
  kind: "system" | "line";
}

interface PreviewRow {
  tower: string;
  unitNo: string;
  values: Record<string, number | string | null>;
}

interface SyncPreview {
  rowCount: number;
  sampleRows: PreviewRow[];
  previewColumns?: PreviewColumn[];
  inventoryUnits?: InventoryPreviewUnit[];
  sampleUnit?: { id: string; unitNumber: string; towerName: string };
  costSheet?: CostSheetEngineData | null;
}

interface ColumnMappingPreview {
  rows: Array<{
    index: number;
    mapKey: string;
    label: string;
    normalized: string;
    sampleValue?: string;
    mappedTo?: string;
    mappedLabel: string;
    source: "auto" | "admin" | "unmapped";
  }>;
  columnMap: Record<string, string>;
  mappedCount: number;
  unmappedCount: number;
  autoMappedCount: number;
  adminMappedCount: number;
}

interface SyncResult {
  imported: number;
  skipped: number;
  sheetName: string;
  sheetNames?: string[];
  headerRowIndex: number;
  columnMapCount: number;
  mappingRequired?: boolean;
  errors?: Array<{ rowIndex: number; message: string }>;
  warnings?: string[];
  inventory?: {
    deletedUnits: number;
    deletedTowers: number;
    createdUnits: number;
    towersCreated: number;
    inventorySkipped: number;
    masterRowsLinked: number;
  };
  preview?: SyncPreview;
  columnMapping?: ColumnMappingPreview;
}

function fmtNum(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

type AckVariant = "success" | "error" | "info";

interface AckDialogState {
  open: boolean;
  variant: AckVariant;
  title: string;
  message: string;
  details: string[];
}

function buildSyncSuccessDetails(sync: SyncResult): string[] {
  const lines: string[] = [
    `Sheet: ${sync.sheetName} (header row ${sync.headerRowIndex})`,
    `Pricing rows imported: ${sync.imported}`,
    `Skipped: ${sync.skipped}`,
    `Columns matched: ${sync.columnMapCount}`,
  ];
  if (sync.inventory) {
    lines.push(
      `Inventory: removed ${sync.inventory.deletedUnits} units / ${sync.inventory.deletedTowers} towers`,
      `Created ${sync.inventory.createdUnits} units in ${sync.inventory.towersCreated} towers`,
      `Master rows linked: ${sync.inventory.masterRowsLinked}`
    );
  }
  if (sync.preview?.rowCount) {
    lines.push(`MASTER SHEET units parsed: ${sync.preview.rowCount}`);
  }
  if (sync.errors?.length) {
    lines.push(`${sync.errors.length} row error(s) — see summary below`);
  }
  if (sync.warnings?.length) {
    lines.push(`${sync.warnings.length} warning(s) — see summary below`);
  }
  return lines;
}

function getMappedCellValue(
  row: PreviewRow,
  mapKey: string,
  columnMap: Record<string, string>
): number | string | null {
  const target = columnMap[mapKey];
  if (!target) return null;
  if (target === "tower") return row.tower;
  if (target === "unitNo") return row.unitNo;
  return row.values?.[target] ?? null;
}

const EXCEL_PREVIEW_MAX_VISIBLE_ROWS = 10;
const EXCEL_PREVIEW_ROW_HEIGHT_REM = 2.5;
const excelPreviewMaxHeight = `calc(${EXCEL_PREVIEW_ROW_HEIGHT_REM}rem * ${EXCEL_PREVIEW_MAX_VISIBLE_ROWS} + ${EXCEL_PREVIEW_ROW_HEIGHT_REM}rem)`;

export function ProjectCostExcelSection({
  projectId,
  lineDefinitions: lineDefinitionsProp,
  sharedColumnMap,
  onSharedColumnMapChange,
  onExcelColumnsChange,
  onCostSheetLinesChange,
}: {
  projectId: string;
  lineDefinitions?: CostSheetLineRow[];
  sharedColumnMap?: Record<string, string>;
  onSharedColumnMapChange?: (map: Record<string, string>) => void;
  onExcelColumnsChange?: (columns: Array<{ mapKey: string; label: string }>) => void;
  onCostSheetLinesChange?: (lines: CostSheetLineRow[]) => void;
}) {
  const [excelSourceUrl, setExcelSourceUrl] = useState("");
  const [lastSync, setLastSync] = useState<SyncResult | null>(null);
  const [linkPreview, setLinkPreview] = useState<SyncPreview | null>(null);
  const [mappingSheet, setMappingSheet] = useState("");
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [replaceInventory, setReplaceInventory] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMappingPreview | null>(null);
  const [columnMapDraft, setColumnMapDraft] = useState<Record<string, string>>(
    sharedColumnMap ?? {}
  );
  const [lineDefinitions, setLineDefinitions] = useState<LineDefinitionRef[]>([]);
  const [inventoryUnits, setInventoryUnits] = useState<InventoryPreviewUnit[]>([]);
  const [inventoryPreviewKey, setInventoryPreviewKey] = useState(0);
  const [sheetMeta, setSheetMeta] = useState({ sheetName: "", headerRowIndex: 1 });
  const [availableSheetNames, setAvailableSheetNames] = useState<string[]>([]);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [serverMappingComplete, setServerMappingComplete] = useState(false);
  const [ackDialog, setAckDialog] = useState<AckDialogState>({
    open: false,
    variant: "info",
    title: "",
    message: "",
    details: [],
  });

  const showAck = (variant: AckVariant, title: string, message: string, details: string[] = []) => {
    setAckDialog({ open: true, variant, title, message, details });
    if (variant === "success") {
      toast.success(title, { description: message });
    } else if (variant === "error") {
      toast.error(title, { description: message });
    } else {
      toast.info(title, { description: message });
    }
  };

  const closeAck = () => setAckDialog((prev) => ({ ...prev, open: false }));

  const publishColumnMap = useCallback(
    (map: Record<string, string>) => {
      setColumnMapDraft(map);
      onSharedColumnMapChange?.(map);
    },
    [onSharedColumnMapChange]
  );

  const publishExcelColumns = useCallback(
    (mapping: ColumnMappingPreview | null) => {
      if (!onExcelColumnsChange || !mapping?.rows?.length) return;
      onExcelColumnsChange(
        mapping.rows.map((r) => ({
          mapKey: r.mapKey,
          label: r.label || r.mapKey,
        }))
      );
    },
    [onExcelColumnsChange]
  );

  useEffect(() => {
    if (sharedColumnMap) {
      setColumnMapDraft(sharedColumnMap);
    }
  }, [sharedColumnMap]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mapRes, batchRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/cost-excel/mapping`),
        fetch(`/api/projects/${projectId}/cost-excel/batches`),
      ]);
      const [mapData, batchData] = await Promise.all([
        mapRes.json().catch(() => ({})),
        batchRes.json().catch(() => ({})),
      ]);
      if (!lineDefinitionsProp?.length) {
        const linesRes = await fetch(`/api/projects/${projectId}/cost-sheet-lines`);
        const linesData = await linesRes.json().catch(() => ({}));
        if (linesRes.ok) {
          setLineDefinitions(
            (linesData.lines ?? []).map((l: LineDefinitionRef) => ({
              id: l.id,
              label: l.label,
              key: l.key,
              role: l.role,
              systemField: l.systemField,
              includeInGross: l.includeInGross ?? false,
            }))
          );
        }
      }
    if (mapData.mapping) {
      if (mapData.mapping.sheetName) {
        setMappingSheet(mapData.mapping.sheetName);
        setSheetMeta({
          sheetName: mapData.mapping.sheetName,
          headerRowIndex: mapData.mapping.headerRowIndex ?? 1,
        });
      }
      if (mapData.mapping.excelSourceUrl) {
        setExcelSourceUrl(mapData.mapping.excelSourceUrl);
      }
      if (mapData.mapping.columnMap && typeof mapData.mapping.columnMap === "object") {
        publishColumnMap(mapData.mapping.columnMap as Record<string, string>);
      }
    }
    setBatches(batchData.batches ?? []);
    } catch {
      toast.error("Failed to load Excel sync settings");
    } finally {
      setLoading(false);
    }
  }, [projectId, lineDefinitionsProp?.length, publishColumnMap]);

  useEffect(() => {
    if (lineDefinitionsProp?.length) {
      setLineDefinitions(
        lineDefinitionsProp.map((l) => ({
          id: l.id,
          label: l.label,
          key: l.key,
          role: l.role,
          systemField: l.systemField,
          includeInGross: l.includeInGross ?? false,
        }))
      );
    }
  }, [lineDefinitionsProp]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshLineDefinitions = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/cost-sheet-lines`);
    const data = await res.json().catch(() => ({}));
    const lines = (data.lines ?? []) as LineDefinitionRef[];
    setLineDefinitions(lines);
    return lines;
  }, [projectId]);

  const identityMappingComplete =
    columnMapCoversSystemField(columnMapDraft, "unitNo", lineDefinitions) &&
    columnMapCoversSystemField(columnMapDraft, "tower", lineDefinitions);

  const canSyncInventory =
    identityMappingComplete || (previewLoaded && serverMappingComplete);

  const applyExtractResult = async (extract: SyncResult) => {
    setLinkPreview(extract.preview ?? null);
    if (extract.sheetNames?.length) {
      setAvailableSheetNames(extract.sheetNames);
    }
    if (extract.preview?.inventoryUnits?.length) {
      setInventoryUnits(extract.preview.inventoryUnits);
    }
    setMappingSheet(extract.sheetName ?? mappingSheet);
    setSheetMeta({
      sheetName: extract.sheetName ?? "MASTER SHEET",
      headerRowIndex: extract.headerRowIndex ?? 1,
    });
    if (extract.columnMapping) {
      setColumnMapping(extract.columnMapping);
      publishColumnMap(extract.columnMapping.columnMap);
      publishExcelColumns(extract.columnMapping);
    }

    setPreviewLoaded(true);
    const lines = await refreshLineDefinitions();
    const extractMap = extract.columnMapping?.columnMap ?? columnMapDraft;
    const complete =
      extract.mappingRequired === false ||
      (columnMapCoversSystemField(extractMap, "unitNo", lines) &&
        columnMapCoversSystemField(extractMap, "tower", lines));
    setServerMappingComplete(complete);
  };

  const runExtract = async () => {
    if (!uploadFile && !excelSourceUrl.trim()) {
      showAck("error", "Nothing to load", "Paste a SharePoint link or choose an .xlsx file.");
      return;
    }
    setExtracting(true);
    setLinkPreview(null);
    try {
      let res: Response;
      if (uploadFile) {
        const form = new FormData();
        form.append("file", uploadFile);
        if (Object.keys(columnMapDraft).length > 0) {
          form.append("columnMap", JSON.stringify(columnMapDraft));
        }
        if (sheetMeta.sheetName) form.append("sheetName", sheetMeta.sheetName);
        form.append("headerRowIndex", String(sheetMeta.headerRowIndex));
        res = await fetch(`/api/projects/${projectId}/cost-excel/extract`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/projects/${projectId}/cost-excel/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            excelSourceUrl: excelSourceUrl.trim(),
            columnMap: columnMapDraft,
            sheetName: sheetMeta.sheetName || undefined,
            headerRowIndex: sheetMeta.headerRowIndex,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Could not read Excel";
        showAck("error", "Load preview failed", errMsg, [
          "Check that the link is a SharePoint “Copy link” URL.",
          "If you see 403, set sharing to “Anyone with the link can view” or upload the .xlsx file.",
        ]);
        return;
      }
      const extract = data.extract as SyncResult;
      await applyExtractResult(extract);
      setInventoryPreviewKey((k) => k + 1);

      const rowCount = extract.preview?.rowCount ?? 0;
      const extractMap = extract.columnMapping?.columnMap ?? {};
      const needsMapping =
        extract.mappingRequired ??
        (!columnMapCoversSystemField(extractMap, "unitNo", lineDefinitions) ||
          !columnMapCoversSystemField(extractMap, "tower", lineDefinitions));
      if (needsMapping) {
        showAck(
          "info",
          "Preview loaded — map columns",
          `Found ${rowCount} rows. Map Wing and Villa/Unit No below, then Sync to inventory.`,
          [
            `Sheet: ${extract.sheetName}`,
            `Columns detected: ${extract.columnMapping?.rows?.length ?? 0}`,
            extract.warnings?.[0] ?? "Map Wing and Villa No. in the table below.",
          ]
        );
      } else {
        showAck(
          "success",
          "Preview loaded",
          `Found ${rowCount} units. Wing and Villa No. are mapped — you can sync to inventory.`,
          [
            `Sheet: ${extract.sheetName}`,
            `Sample rows: ${extract.preview?.sampleRows?.length ?? 0}`,
          ]
        );
      }
    } catch (e) {
      showAck(
        "error",
        "Load preview failed",
        e instanceof Error ? e.message : "Network error while reading Excel"
      );
    } finally {
      setExtracting(false);
    }
  };

  const runSync = async () => {
    if (!canSyncInventory) {
      showAck(
        "error",
        "Mapping required",
        "Load preview first, then map Tower/Wing and Unit No in the column table below.",
        [
          "Click Load preview after choosing your file.",
          "Map identity columns in the table, or use Save column mapping.",
        ]
      );
      return;
    }
    if (!uploadFile && !excelSourceUrl.trim()) {
      showAck("error", "Nothing to sync", "Paste a SharePoint link or choose an .xlsx file.");
      return;
    }
    setSyncing(true);
    try {
      let res: Response;
      if (uploadFile) {
        const form = new FormData();
        form.append("file", uploadFile);
        form.append("replaceInventory", replaceInventory ? "true" : "false");
        form.append("columnMap", JSON.stringify(columnMapDraft));
        if (sheetMeta.sheetName) form.append("sheetName", sheetMeta.sheetName);
        form.append("headerRowIndex", String(sheetMeta.headerRowIndex));
        res = await fetch(`/api/projects/${projectId}/cost-excel/sync`, {
          method: "POST",
          body: form,
        });
      } else {
        res = await fetch(`/api/projects/${projectId}/cost-excel/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            excelSourceUrl: excelSourceUrl.trim(),
            replaceInventory,
            columnMap: columnMapDraft,
            sheetName: sheetMeta.sheetName || undefined,
            headerRowIndex: sheetMeta.headerRowIndex,
          }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Sync failed";
        showAck("error", "Sync failed", errMsg, [
          "Load preview first and map Wing + Villa No. if you have not already.",
          "If SharePoint returned 403, set link to “Anyone with the link can view”.",
          "Or download the file and use “Upload .xlsx file directly”.",
        ]);
        return;
      }
      const sync = data.sync as SyncResult;
      setLastSync(sync);
      setLinkPreview(sync?.preview ?? null);
      if (sync?.preview?.inventoryUnits?.length) {
        setInventoryUnits(sync.preview.inventoryUnits);
      }
      setInventoryPreviewKey((k) => k + 1);
      setMappingSheet(sync?.sheetName ?? "MASTER SHEET");
      setSheetMeta({
        sheetName: sync?.sheetName ?? "MASTER SHEET",
        headerRowIndex: sync?.headerRowIndex ?? 1,
      });
      if (sync?.columnMapping) {
        setColumnMapping(sync.columnMapping);
        publishColumnMap(sync.columnMapping.columnMap);
        publishExcelColumns(sync.columnMapping);
      }

      const imported = sync?.imported ?? 0;
      const isSuccess = imported > 0 || (sync?.inventory?.createdUnits ?? 0) > 0;
      if (isSuccess) {
        showAck(
          "success",
          "Sync completed",
          sync.inventory
            ? `Created ${sync.inventory.createdUnits} units and imported ${imported} pricing rows.`
            : `Imported ${imported} pricing rows from Excel.`,
          buildSyncSuccessDetails(sync)
        );
      } else {
        showAck(
          "error",
          "Sync finished with no data",
          "No units were imported. Check MASTER SHEET headers (Wing, Villa No., Salable Area) and row data.",
          buildSyncSuccessDetails(sync)
        );
      }
      load();
    } catch (e) {
      showAck(
        "error",
        "Sync failed",
        e instanceof Error ? e.message : "Network error during sync"
      );
    } finally {
      setSyncing(false);
    }
  };

  const activePreview = lastSync?.preview ?? linkPreview;
  const excelColumnRows = columnMapping?.rows ?? [];
  const excelPreviewRows = activePreview?.sampleRows ?? [];
  const excelPreviewTotalRows = activePreview?.rowCount ?? 0;
  const hasExcelPreview = previewLoaded || excelColumnRows.length > 0;

  const previewColumns =
    activePreview?.previewColumns?.length
      ? activePreview.previewColumns
      : [
          { key: "tower", label: "Tower / Wing", kind: "system" as const },
          { key: "unitNo", label: "Unit No", kind: "system" as const },
        ];

  const excelColumnOptions = excelColumnRows.map((r) => ({
    mapKey: r.mapKey,
    label: r.label || r.mapKey,
  }));

  const handleCostSheetLinesChange = (lines: CostSheetLineRow[]) => {
    onCostSheetLinesChange?.(lines);
    setLineDefinitions(
      lines.map((l) => ({
        id: l.id,
        label: l.label,
        key: l.key,
        role: l.role,
        systemField: l.systemField,
        includeInGross: l.includeInGross ?? false,
      }))
    );
  };

  function formatPreviewCell(key: string, value: number | string | null | undefined) {
    if (value == null || value === "") return "—";
    if (typeof value === "number") {
      if (key.includes("Rate") || key === "baseRatePerSqft") return fmtNum(value);
      if (key.includes("sale") || key.includes("gross") || key.includes("gst")) return formatPrice(value);
      return fmtNum(value);
    }
    return String(value);
  }

  if (loading) return <p className="text-sm text-gray-500">Loading Excel config…</p>;

  return (
    <div className="space-y-6">
      <Modal
        open={ackDialog.open}
        onOpenChange={(open) => !open && closeAck()}
        title={ackDialog.title}
        description={ackDialog.message}
        className="sm:max-w-md"
      >
        <div className="space-y-4">
          <div
            className={`flex items-start gap-3 rounded-lg border p-3 ${
              ackDialog.variant === "success"
                ? "border-green-200 bg-green-50"
                : ackDialog.variant === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-blue-200 bg-blue-50"
            }`}
          >
            {ackDialog.variant === "success" ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
            ) : ackDialog.variant === "error" ? (
              <XCircle className="h-6 w-6 shrink-0 text-red-600" />
            ) : (
              <Info className="h-6 w-6 shrink-0 text-blue-600" />
            )}
            <div className="min-w-0 text-sm text-gray-800">
              <p className="font-medium">{ackDialog.message}</p>
              {ackDialog.details.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-gray-600">
                  {ackDialog.details.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={closeAck}>OK</Button>
          </div>
        </div>
      </Modal>

      <Card className="border-brand-200 bg-brand-50/40">
        <CardHeader>
          <CardTitle>1. Upload Excel</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Paste a SharePoint link or upload an .xlsx file, then load a preview of the sheet before
            mapping columns and syncing inventory.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Excel file link (OneDrive / SharePoint Copy link)</Label>
            <Input
              className="mt-1"
              value={excelSourceUrl}
              onChange={(e) => setExcelSourceUrl(e.target.value)}
              placeholder="https://...sharepoint.com/:x:/g/personal/..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Use SharePoint “Copy link”. If sync fails with 403, set sharing to{" "}
              <strong>Anyone with the link can view</strong>, or upload the file below.
            </p>
          </div>

          <div>
            <Label>Or upload .xlsx file directly</Label>
            <Input
              className="mt-1"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />
            {uploadFile ? (
              <p className="mt-1 text-xs text-gray-600">Selected: {uploadFile.name}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Excel sheet</Label>
              {availableSheetNames.length > 0 ? (
                <select
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={sheetMeta.sheetName}
                  onChange={(e) =>
                    setSheetMeta((prev) => ({ ...prev, sheetName: e.target.value }))
                  }
                >
                  {availableSheetNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  className="mt-1"
                  value={sheetMeta.sheetName}
                  onChange={(e) =>
                    setSheetMeta((prev) => ({ ...prev, sheetName: e.target.value }))
                  }
                  placeholder="e.g. MASTER SHEET"
                />
              )}
              <p className="mt-1 text-xs text-gray-500">
                Sheet tab name — detected after Load preview, or type manually.
              </p>
            </div>
            <div>
              <Label>Header row (1-based)</Label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={sheetMeta.headerRowIndex}
                onChange={(e) =>
                  setSheetMeta((prev) => ({
                    ...prev,
                    headerRowIndex: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Row number that contains column headers (skip title rows above).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={runExtract} disabled={extracting || syncing}>
              {extracting ? "Loading preview…" : "Load preview"}
            </Button>
            {mappingSheet ? (
              <span className="text-sm text-gray-600">
                Sheet: <strong>{mappingSheet}</strong>
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Excel preview</CardTitle>
          <p className="text-sm text-gray-600">
            {hasExcelPreview
              ? excelPreviewTotalRows > 0
                ? `${excelPreviewTotalRows} data rows in ${mappingSheet || sheetMeta.sheetName || "sheet"}. Scroll inside the table to see more rows and columns.`
                : `${excelColumnRows.length} columns detected. Map Wing and Villa/Unit No in step 3.`
              : "Load preview in step 1 to see Excel columns and sample rows here."}
          </p>
        </CardHeader>
        <CardContent>
          {!hasExcelPreview ? (
            <p className="text-sm text-gray-500">
              Upload a file or paste a link above, then click <strong>Load preview</strong>.
            </p>
          ) : excelColumnRows.length > 0 ? (
            <div className="space-y-2">
              <div
                className="overflow-auto rounded-lg border"
                style={{ maxHeight: excelPreviewMaxHeight }}
              >
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs text-gray-500 shadow-sm">
                    <tr>
                      {excelColumnRows.map((col) => (
                        <th key={col.mapKey} className="px-3 py-2 whitespace-nowrap">
                          {col.label || col.mapKey}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreviewRows.length > 0 ? (
                      excelPreviewRows.map((row, rowIdx) => (
                        <tr key={`${row.tower}-${row.unitNo}-${rowIdx}`} className="border-t">
                          {excelColumnRows.map((col) => {
                            const value =
                              getMappedCellValue(row, col.mapKey, columnMapDraft) ??
                              (rowIdx === 0 ? col.sampleValue : null);
                            return (
                              <td
                                key={col.mapKey}
                                className="px-3 py-2 whitespace-nowrap max-w-[14rem] truncate"
                                title={value != null ? String(value) : undefined}
                              >
                                {value != null && value !== "" ? String(value) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t">
                        {excelColumnRows.map((col) => (
                          <td
                            key={col.mapKey}
                            className="px-3 py-2 whitespace-nowrap max-w-[14rem] truncate"
                            title={col.sampleValue ?? undefined}
                          >
                            {col.sampleValue ?? "—"}
                          </td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {excelPreviewRows.length > 0 && excelPreviewTotalRows > excelPreviewRows.length ? (
                <p className="text-xs text-gray-500">
                  Showing {excelPreviewRows.length} of {excelPreviewTotalRows} rows — scroll the
                  table for more.
                </p>
              ) : null}
            </div>
          ) : activePreview ? (
            <div
              className="overflow-auto rounded-lg border"
              style={{ maxHeight: excelPreviewMaxHeight }}
            >
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 text-left text-xs text-gray-500 shadow-sm">
                  <tr>
                    {previewColumns.map((col) => (
                      <th
                        key={col.key}
                        className={`px-3 py-2 whitespace-nowrap ${col.kind === "line" || col.key.includes("Rate") || col.key.includes("sale") || col.key.includes("gross") ? "text-right" : ""}`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activePreview.sampleRows.length === 0 ? (
                    <tr>
                      <td colSpan={previewColumns.length} className="px-3 py-4 text-gray-400">
                        No rows parsed — map Wing and Unit No columns in step 3
                      </td>
                    </tr>
                  ) : (
                    activePreview.sampleRows.map((row, rowIdx) => (
                      <tr key={`${row.tower}-${row.unitNo}-${rowIdx}`} className="border-t">
                        {previewColumns.map((col) => {
                          const value =
                            col.key === "tower"
                              ? row.tower
                              : col.key === "unitNo"
                                ? row.unitNo
                                : row.values?.[col.key];
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-2 whitespace-nowrap ${col.key === "unitNo" ? "font-medium" : ""} ${col.kind === "line" || col.key.includes("Rate") || col.key.includes("sale") || col.key.includes("gross") ? "text-right" : ""}`}
                            >
                              {formatPreviewCell(col.key, value ?? null)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Cost sheet elements</CardTitle>
          <p className="text-sm text-gray-600">
            Define Part A rows, map Excel columns to cost sheet lines, then sync pricing and
            inventory.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProjectCostSheetPartAPanel
            projectId={projectId}
            onLinesChange={handleCostSheetLinesChange}
            excelColumns={excelColumnOptions}
            columnMap={columnMapDraft}
            onColumnMapChange={(map) => {
              publishColumnMap(map);
              setServerMappingComplete(
                columnMapCoversSystemField(map, "unitNo", lineDefinitions) &&
                  columnMapCoversSystemField(map, "tower", lineDefinitions)
              );
            }}
          />

          {columnMapping && columnMapping.rows.length > 0 ? (
            <ProjectCostExcelMappingPanel
              projectId={projectId}
              rows={columnMapping.rows}
              columnMap={columnMapDraft}
              sheetName={sheetMeta.sheetName || mappingSheet}
              headerRowIndex={sheetMeta.headerRowIndex}
              excelSourceUrl={excelSourceUrl}
              mappedCount={columnMapping.mappedCount}
              unmappedCount={columnMapping.unmappedCount}
              lineOptions={lineDefinitions}
              onColumnMapChange={(map) => {
                publishColumnMap(map);
                setServerMappingComplete(
                  columnMapCoversSystemField(map, "unitNo", lineDefinitions) &&
                    columnMapCoversSystemField(map, "tower", lineDefinitions)
                );
              }}
              onSaved={() => {
                showAck(
                  "success",
                  "Mapping saved",
                  "Column mapping saved. Click Sync to inventory to apply."
                );
                load();
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">
              Load preview in step 1 to map Excel columns to cost sheet lines.
            </p>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={replaceInventory}
                onChange={(e) => setReplaceInventory(e.target.checked)}
              />
              <span>
                <strong>Replace inventory from Excel</strong> — deletes existing towers/units for
                this project and recreates them from mapped tower + unit columns.
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={runSync} disabled={syncing || extracting || !canSyncInventory}>
              {syncing ? "Syncing…" : "Sync to inventory"}
            </Button>
            {!canSyncInventory && (columnMapping || uploadFile || excelSourceUrl.trim()) ? (
              <span className="text-sm text-amber-700">
                {previewLoaded
                  ? "Map Tower/Wing + Unit No above to enable sync."
                  : "Click Load preview in step 1 to enable sync."}
              </span>
            ) : null}
          </div>

          {lastSync ? (
            <div className="rounded-lg border bg-white p-3 text-sm">
              <p>
                Last sync: <strong>{lastSync.imported}</strong> pricing rows,{" "}
                <strong>{lastSync.skipped}</strong> skipped ·{" "}
                <strong>{lastSync.columnMapCount}</strong> columns auto-matched
              </p>
              {lastSync.inventory ? (
                <p className="mt-1 text-gray-700">
                  Inventory: removed <strong>{lastSync.inventory.deletedUnits}</strong> units /{" "}
                  <strong>{lastSync.inventory.deletedTowers}</strong> towers · created{" "}
                  <strong>{lastSync.inventory.createdUnits}</strong> units in{" "}
                  <strong>{lastSync.inventory.towersCreated}</strong> towers · linked{" "}
                  <strong>{lastSync.inventory.masterRowsLinked}</strong> master rows
                </p>
              ) : null}
              {lastSync.warnings?.length ? (
                <ul className="mt-2 list-disc pl-5 text-amber-700">
                  {lastSync.warnings.slice(0, 5).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              {lastSync.errors?.length ? (
                <ul className="mt-2 list-disc pl-5 text-red-600">
                  {lastSync.errors.slice(0, 5).map((e) => (
                    <li key={e.rowIndex}>
                      Row {e.rowIndex}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Cost sheet preview</CardTitle>
          <p className="text-sm text-gray-600">
            Per-unit cost sheet after mapping and sync. Select a unit to preview Part A and Part B
            totals.
          </p>
        </CardHeader>
        <CardContent>
          {!loading ? (
            <ProjectCostExcelInventoryPreview
              key={inventoryPreviewKey}
              projectId={projectId}
              units={activePreview?.inventoryUnits ?? inventoryUnits}
              initialUnitId={activePreview?.sampleUnit?.id}
              onUnitsChange={setInventoryUnits}
              showInventoryTable={false}
              showCostSheetPreview={true}
              embedded={true}
            />
          ) : null}
        </CardContent>
      </Card>

      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sync history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.slice(0, 10).map((b) => (
                    <tr key={b.id} className="border-t">
                      <td className="px-3 py-2">{new Date(b.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 max-w-md truncate">{b.fileName}</td>
                      <td className="px-3 py-2">{b.rowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
