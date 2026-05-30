"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BlockTimer, Button, Card, CardContent, FilterBar, type FilterConfig } from "@booking/ui";
import { TopBar } from "@/components/top-bar";
import { SalesProjectScopeSelect } from "@/components/sales-project-scope-select";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { toast, Toaster } from "sonner";

interface BlockRow {
  id: string;
  expiresAt: string;
  projectId: string;
  projectName: string;
  pendingApproval?: boolean;
  unit: { unitNumber: string; towerName: string; bhkType: string | null };
}

function BlockedUnitsContent() {
  const { projects, loading } = useSelectedProject();
  const [scopeProjectId, setScopeProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const filterProjectId = scopeProjectId ?? projects[0]?.id ?? null;

  const assignedProjectIds = new Set(projects.map((p) => p.id));
  const showProjectColumn = scopeProjectId === null;

  useEffect(() => {
    if (!filterProjectId) {
      setFilters([]);
      return;
    }
    setFilterValues({});
    fetch(`/api/filters?projectId=${filterProjectId}`)
      .then((r) => r.json())
      .then((d) => setFilters(d.filters ?? []));
  }, [filterProjectId]);

  const loadBlocks = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    const params = new URLSearchParams(scopeProjectId ? { projectId: scopeProjectId } : { projectId: "all" });
    if (search.trim()) params.set("search", search.trim());
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    try {
      const res = await fetch(`/api/my-blocks?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setFetchError(d.error ?? "Failed to load blocks");
        setBlocks([]);
      } else {
        setBlocks(d.blocks ?? []);
      }
    } catch {
      setFetchError("Failed to load blocks");
      setBlocks([]);
    } finally {
      setFetching(false);
    }
  }, [scopeProjectId, search, filterValues]);

  useEffect(() => {
    if (!loading) loadBlocks();
  }, [loading, loadBlocks]);

  const handleRelease = async (blockId: string) => {
    const res = await fetch(`/api/blocks/${blockId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast.success("Unit released");
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } else {
      toast.error(data.error ?? "Failed to release block");
    }
  };

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterValues({});
  }, []);

  const hasActiveFilters = useMemo(
    () => search.trim() !== "" || Object.values(filterValues).some(Boolean),
    [search, filterValues]
  );

  if (loading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <Toaster position="top-right" richColors />
      <TopBar activeBlocks={blocks.length}>
        <SalesProjectScopeSelect
          projects={projects}
          scopeProjectId={scopeProjectId}
          onChange={setScopeProjectId}
        />
      </TopBar>
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <h1 className="mb-4 text-xl font-bold">My Blocked Units</h1>
        <div className="mb-4">
          <FilterBar
            filters={filters}
            values={filterValues}
            onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search unit number or tower..."
            onClearAll={hasActiveFilters ? clearFilters : undefined}
          />
        </div>
        {projects.length === 0 ? (
          <p className="text-gray-500">No projects assigned. Contact your admin.</p>
        ) : fetchError ? (
          <p className="text-red-600">{fetchError}</p>
        ) : fetching ? (
          <p className="text-gray-500">Loading blocks...</p>
        ) : blocks.length === 0 ? (
          <p className="text-gray-500">No active blocks. Go to Live Booking to block units.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {blocks.map((block) => {
              const revoked = !assignedProjectIds.has(block.projectId);
              return (
                <Card key={block.id} className="border-amber-200 bg-amber-50">
                  <CardContent className="p-4">
                    {showProjectColumn && (
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-gray-600">{block.projectName}</span>
                        {revoked && (
                          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                            No longer assigned
                          </span>
                        )}
                      </div>
                    )}
                    <p className="text-lg font-bold">{block.unit.unitNumber}</p>
                    <p className="text-sm text-gray-500">
                      {block.unit.towerName} · {block.unit.bhkType}
                    </p>
                    {block.pendingApproval && (
                      <p className="mt-1 text-xs font-medium text-blue-700">Pending approval</p>
                    )}
                    <BlockTimer expiresAt={block.expiresAt} className="mt-2" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={block.pendingApproval}
                      onClick={() => handleRelease(block.id)}
                    >
                      Release
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BlockedUnitsPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <BlockedUnitsContent />
    </Suspense>
  );
}
