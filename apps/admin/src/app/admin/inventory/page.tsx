"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import {
  UnitGrid,
  Button,
  StatusLegend,
  FilterBar,
  PageHeader,
  useBreakpoint,
  type UnitCardData,
  type FilterConfig,
} from "@booking/ui";
import { toast, Toaster } from "sonner";
import { AdminProjectSelect } from "@/components/admin-project-select";
import { InventoryFloorList, type InventoryStructure } from "@/components/inventory-floor-list";
import { FloorPlanPanel, type FloorPlanTypeRow } from "@/components/floor-plan-panel";
import { UnitStackGenerator } from "@/components/unit-stack-generator";
import { useAdminProject } from "@/hooks/use-admin-project";
import { formatApiError } from "@/lib/format-api-error";

type InventoryTab = "manage" | "grid" | "floor-plans";
type MassAction = "block" | "unblock" | "hold" | "release_hold";

const MASS_ACTION_LABELS: Record<MassAction, { idle: string; loading: string; success: (n: number) => string }> = {
  block: { idle: "Mass Block", loading: "Blocking...", success: (n) => `Blocked ${n} unit${n !== 1 ? "s" : ""}` },
  unblock: { idle: "Mass Unblock", loading: "Unblocking...", success: (n) => `Unblocked ${n} unit${n !== 1 ? "s" : ""}` },
  hold: { idle: "Hold", loading: "Holding...", success: (n) => `Placed ${n} unit${n !== 1 ? "s" : ""} on hold` },
  release_hold: { idle: "Release Hold", loading: "Releasing...", success: (n) => `Released hold on ${n} unit${n !== 1 ? "s" : ""}` },
};

function InventoryContent() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading } =
    useAdminProject();
  const { isLgUp } = useBreakpoint();
  const [tab, setTab] = useState<InventoryTab>("manage");
  const [units, setUnits] = useState<UnitCardData[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [gridSearch, setGridSearch] = useState("");
  const [massActionLoading, setMassActionLoading] = useState<MassAction | null>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [filterConfigs, setFilterConfigs] = useState<FilterConfig[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [floorPlans, setFloorPlans] = useState<FloorPlanTypeRow[]>([]);
  const [inventoryStructure, setInventoryStructure] = useState<InventoryStructure | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [projectMeta, setProjectMeta] = useState<{
    towers: Array<{
      id: string;
      name: string;
      code: string;
      unitStackTemplates?: Array<{
        stackNumber: number;
        floorPlanTypeId: string;
        costSheetTemplateId: string;
        sizeType: string;
        activeFromFloor: number;
        activeToFloor: number;
      }>;
    }>;
    costSheets: Array<{ id: string; name: string; floorPlanTypeId: string | null; totalPrice: string }>;
  } | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  const loadUnits = useCallback(async (pid: string, search?: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ projectId: pid });
    if (search?.trim()) params.set("search", search.trim());
    Object.entries(filters ?? {}).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const res = await fetch(`/api/units?${params}`);
    const data = await res.json().catch(() => ({}));
    setUnits(data.units ?? []);
  }, []);

  const loadProjectMeta = useCallback(async (pid: string) => {
    setMetaLoading(true);
    try {
      const [fRes, sRes] = await Promise.all([
        fetch(`/api/filters?projectId=${pid}`),
        fetch(`/api/projects/${pid}/inventory-structure`),
      ]);
      const fData = await fRes.json().catch(() => ({}));
      const sData = await sRes.json().catch(() => ({}));
      setFilterConfigs(fData.filters ?? []);
      setInventoryStructure(sRes.ok ? sData : null);
      setFloorPlans(sData.floorPlanTypes ?? []);
      setProjectMeta({
        towers: (sData.towers ?? []).map(
          (t: {
            id: string;
            name: string;
            code: string;
            unitStackTemplates?: Array<{
              stackNumber: number;
              floorPlanTypeId: string;
              costSheetTemplateId: string;
              sizeType: string;
              activeFromFloor: number;
              activeToFloor: number;
            }>;
          }) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            unitStackTemplates: t.unitStackTemplates,
          })
        ),
        costSheets: (sData.costSheetTemplates ?? []).map(
          (c: { id: string; name: string; floorPlanTypeId: string | null; totalPrice: string | number }) => ({
            ...c,
            totalPrice: String(c.totalPrice),
          })
        ),
      });
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (selectedProjectId) {
      loadProjectMeta(selectedProjectId);
      setSelected([]);
    } else {
      setUnits([]);
      setSelected([]);
      setFilterConfigs([]);
      setFloorPlans([]);
      setInventoryStructure(null);
      setProjectMeta(null);
    }
  }, [selectedProjectId, loading, loadProjectMeta, refreshKey]);

  useEffect(() => {
    if (loading || tab !== "grid" || !selectedProjectId) return;
    loadUnits(selectedProjectId, gridSearch, filterValues);
  }, [selectedProjectId, loading, tab, loadUnits, refreshKey, gridSearch, filterValues]);

  const refreshAll = () => setRefreshKey((k) => k + 1);

  const massAction = async (action: MassAction) => {
    if (!selectedProjectId || selected.length === 0) return;
    setMassActionLoading(action);
    setShowMobileActions(false);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "mass-block",
          projectId: selectedProjectId,
          unitIds: selected,
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(MASS_ACTION_LABELS[action].success(selected.length));
        setSelected([]);
        refreshAll();
      } else {
        toast.error(formatApiError(data.error, "Mass action failed"));
      }
    } catch {
      toast.error("Mass action failed — check your connection and try again");
    } finally {
      setMassActionLoading(null);
    }
  };

  const toggleSelect = (unit: UnitCardData) => {
    setSelected((prev) =>
      prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id]
    );
  };

  const massActionButtons = (action: MassAction) => (
    <Button
      key={action}
      size="sm"
      variant={action === "block" ? "warning" : action === "hold" ? "secondary" : "outline"}
      disabled={!!massActionLoading}
      onClick={() => massAction(action)}
    >
      {massActionLoading === action ? MASS_ACTION_LABELS[action].loading : MASS_ACTION_LABELS[action].idle}
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col p-4 pb-24 md:p-6 md:pb-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Inventory Management"
        description={
          selectedProject ? selectedProject.name : "Select a project to manage inventory"
        }
        actions={
          <>
            <AdminProjectSelect
              projects={projects}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
              showAllOption={false}
            />
            {tab === "manage" && selectedProjectId && (
              <Button size="sm" onClick={() => setShowGenerate(true)}>Generate units</Button>
            )}
            {tab === "grid" && selected.length > 0 && isLgUp && (
              <>
                <span className="self-center text-sm text-gray-500">{selected.length} selected</span>
                {massActionButtons("block")}
                {massActionButtons("unblock")}
                {massActionButtons("hold")}
                {massActionButtons("release_hold")}
              </>
            )}
          </>
        }
      />

      <div className="mb-4 flex gap-2">
        {(["manage", "grid", "floor-plans"] as InventoryTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {t === "floor-plans" ? "Floor plans" : t}
          </button>
        ))}
      </div>

      {!selectedProjectId ? (
        <p className="text-gray-500">Choose a project from the dropdown to view and manage units.</p>
      ) : tab === "floor-plans" ? (
        <FloorPlanPanel
          projectId={selectedProjectId}
          plans={floorPlans}
          onRefresh={() => loadProjectMeta(selectedProjectId)}
        />
      ) : tab === "manage" ? (
        <InventoryFloorList
          projectId={selectedProjectId}
          onChanged={refreshAll}
          sharedStructure={inventoryStructure}
          sharedLoading={metaLoading}
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 shrink-0 space-y-3">
            <FilterBar
              filters={filterConfigs}
              values={filterValues}
              onChange={(key, value) =>
                setFilterValues((prev) => ({ ...prev, [key]: value }))
              }
              search={gridSearch}
              onSearchChange={setGridSearch}
              searchPlaceholder="Search unit number, tower, or BHK..."
              onClearAll={() => {
                setFilterValues({});
                setGridSearch("");
              }}
            />
            <StatusLegend />
            <p className="text-xs text-gray-500">
              Tap units to select for mass actions. Blocked and hold units can be selected.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
            <UnitGrid
              units={units}
              onUnitClick={toggleSelect}
              selectedUnitIds={selected}
              maxColumns={5}
              selectionMode="admin"
            />
          </div>
        </div>
      )}

      {tab === "grid" && selected.length > 0 && !isLgUp && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white p-3 shadow-lg lg:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{selected.length} selected</span>
            <div className="relative ml-auto">
              <Button
                size="sm"
                disabled={!!massActionLoading}
                onClick={() => setShowMobileActions((v) => !v)}
              >
                Actions
              </Button>
              {showMobileActions && (
                <div className="absolute bottom-full right-0 mb-2 flex w-44 flex-col gap-1 rounded-lg border bg-white p-2 shadow-lg">
                  {(["block", "unblock", "hold", "release_hold"] as MassAction[]).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="rounded px-3 py-2 text-left text-sm hover:bg-gray-50"
                      onClick={() => massAction(action)}
                    >
                      {MASS_ACTION_LABELS[action].idle}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedProjectId && projectMeta && (
        <UnitStackGenerator
          open={showGenerate}
          onOpenChange={setShowGenerate}
          projectId={selectedProjectId}
          towers={projectMeta.towers}
          floorPlans={floorPlans.map((p) => ({
            id: p.id,
            name: p.name,
            bhkType: p.bhkType,
            superArea: p.superArea,
          }))}
          costSheets={projectMeta.costSheets}
          onSuccess={refreshAll}
        />
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading inventory...</div>}>
      <InventoryContent />
    </Suspense>
  );
}
