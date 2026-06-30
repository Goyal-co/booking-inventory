"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BlockTimer, Button, FilterBar, PageHeader, KpiGrid, StatCard, TablePagination, formatPrice, type FilterConfig } from "@booking/ui";
import { Lock, Clock, Timer } from "lucide-react";
import Link from "next/link";
import { SalesProjectScopeSelect } from "@/components/sales-project-scope-select";
import { useSelectedProject } from "@/hooks/use-selected-project";
import { toast, Toaster } from "sonner";

interface BlockRow {
  id: string;
  expiresAt: string;
  projectId: string;
  projectName: string;
  pendingApproval?: boolean;
  unit: {
    unitNumber: string;
    towerName: string;
    bhkType: string | null;
    carpetArea: number | null;
    superArea: number | null;
    price: number | null;
  };
}

function formatAvgTimeLeft(blocks: BlockRow[]): string {
  if (blocks.length === 0) return "—";
  const avgMs =
    blocks.reduce((s, b) => s + Math.max(0, new Date(b.expiresAt).getTime() - Date.now()), 0) /
    blocks.length;
  const totalMin = Math.floor(avgMs / 60000);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return hrs > 0 ? `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")} hr` : `${mins} min`;
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
  const [page, setPage] = useState(1);
  const pageSize = 4;

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

  const expiringSoon = blocks.filter((b) => new Date(b.expiresAt).getTime() - Date.now() < 3600000).length;
  const sortedBlocks = [...blocks].sort(
    (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime()
  );
  const pagedBlocks = sortedBlocks.slice((page - 1) * pageSize, page * pageSize);

  if (loading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="My Blocked Units"
        description="Units currently reserved by you. They will expire automatically if not booked."
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800">
              <Lock className="h-3.5 w-3.5" />
              {blocks.length} Active Blocks
            </span>
            <SalesProjectScopeSelect
              projects={projects}
              scopeProjectId={scopeProjectId}
              onChange={setScopeProjectId}
            />
          </div>
        }
      />

      <KpiGrid className="mb-6 max-w-3xl">
        <StatCard label="Active Blocks" value={blocks.length} subtitle="Units blocked by you" icon={<Lock className="h-5 w-5" />} />
        <StatCard label="Expiring Soon" value={expiringSoon} subtitle="Within next hour" icon={<Clock className="h-5 w-5" />} iconClassName="bg-amber-50 text-amber-600" />
        <StatCard label="Avg Time Left" value={formatAvgTimeLeft(blocks)} subtitle="Average time remaining" icon={<Timer className="h-5 w-5" />} />
      </KpiGrid>

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
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {pagedBlocks.map((block) => {
              const revoked = !assignedProjectIds.has(block.projectId);
              const msLeft = new Date(block.expiresAt).getTime() - Date.now();
              const expiresSoon = msLeft > 0 && msLeft < 3600000;
              return (
                <div
                  key={block.id}
                  className={`rounded-xl border p-5 ${
                    expiresSoon
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50/60"
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      {showProjectColumn && (
                        <p className="text-xs font-medium text-gray-500">{block.projectName}</p>
                      )}
                      <p className="text-2xl font-bold text-gray-900">{block.unit.unitNumber}</p>
                      <p className="text-sm text-gray-600">
                        {block.unit.towerName} · {block.unit.bhkType ?? "—"}
                      </p>
                      {revoked && (
                        <span className="mt-1 inline-block rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                          No longer assigned
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {expiresSoon && (
                        <span className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Expires Soon
                        </span>
                      )}
                      <p className="text-xs text-gray-500">Time Left</p>
                      <BlockTimer expiresAt={block.expiresAt} className="text-lg font-bold text-amber-700" />
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-3 gap-3 rounded-lg bg-white/70 p-3 text-center text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Carpet Area</p>
                      <p className="font-semibold">{block.unit.carpetArea ? `${block.unit.carpetArea} sqft` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">SBA</p>
                      <p className="font-semibold">{block.unit.superArea ? `${block.unit.superArea} sqft` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="font-semibold">{block.unit.price != null ? formatPrice(block.unit.price) : "—"}</p>
                    </div>
                  </div>

                  {block.pendingApproval && (
                    <p className="mb-3 text-xs font-medium text-blue-700">Pending approval</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 bg-white"
                      disabled={block.pendingApproval}
                      onClick={() => handleRelease(block.id)}
                    >
                      Release
                    </Button>
                    <Button className="flex-1" asChild>
                      <Link href={`/app/live?projectId=${block.projectId}`}>Proceed to Booking</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <TablePagination
            className="mt-6"
            page={page}
            pageSize={pageSize}
            total={blocks.length}
            onPageChange={setPage}
          />
        </>
      )}
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
