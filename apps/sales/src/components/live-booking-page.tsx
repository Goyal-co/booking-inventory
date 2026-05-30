"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast, Toaster } from "sonner";
import {
  UnitGrid,
  FilterBar,
  ActivityFeed,
  StatusLegend,
  Modal,
  MaxBlocksDialog,
  Button,
  Input,
  Label,
  TabsRoot,
  TabsList,
  TabsTrigger,
  TabsContent,
  FloorPlanViewer,
  CostSheetTable,
  BlockTimer,
  ProjectSwitcher,
  ProjectStatusBadge,
  formatBlockDuration,
  formatPrice,
  useBreakpoint,
  filterDimensionToQueryKey,
  type UnitCardData,
  type FilterConfig,
  type ActivityItem,
} from "@booking/ui";
import { useRealtime } from "@booking/realtime";
import { REALTIME_EVENTS } from "@booking/realtime";
import { TopBar } from "@/components/top-bar";
import { useSelectedProject } from "@/hooks/use-selected-project";

function LiveBookingContent() {
  const { data: session } = useSession();
  const { projects, selectedProject, setSelectedProject, refetchProjects, loading: projectLoading } =
    useSelectedProject();
  const [units, setUnits] = useState<UnitCardData[]>([]);
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [myBlocks, setMyBlocks] = useState<
    Array<{
      id: string;
      unitId: string;
      expiresAt: string;
      pendingApproval?: boolean;
      unit: {
        unitNumber: string;
        towerName: string;
        bhkType: string | null;
        price: number | null;
      };
    }>
  >([]);
  const [selectedUnit, setSelectedUnit] = useState<UnitCardData | null>(null);
  const [showMaxBlocks, setShowMaxBlocks] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [bookingBlockId, setBookingBlockId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [mobilePanel, setMobilePanel] = useState<"units" | "blocks">("units");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { isLgUp } = useBreakpoint();

  const project = selectedProject;
  const canBlock = project?.canBlock ?? false;
  const blockDurationLabel = project
    ? project.blockDurationLabel ?? formatBlockDuration(project.blockDurationMs)
    : "";

  const { subscribe, isConnected } = useRealtime(project?.id ?? null);

  const fetchUnits = useCallback(async () => {
    if (!project) return;
    const params = new URLSearchParams({ projectId: project.id, ...filterValues, search });
    Object.keys(filterValues).forEach((k) => {
      if (!filterValues[k]) params.delete(k);
    });
    if (!search) params.delete("search");

    const res = await fetch(`/api/units?${params}`);
    const data = await res.json().catch(() => ({}));
    setUnits(data.units ?? []);
  }, [project, filterValues, search]);

  const fetchMyBlocks = useCallback(async () => {
    if (!project) return;
    const res = await fetch(`/api/my-blocks?projectId=${project.id}`);
    const data = await res.json().catch(() => ({}));
    setMyBlocks(data.blocks ?? []);
  }, [project]);

  const fetchActivities = useCallback(async () => {
    if (!project) return;
    const res = await fetch(`/api/activities?projectId=${project.id}`);
    const data = await res.json().catch(() => ({}));
    setActivities(data.activities ?? []);
  }, [project]);

  useEffect(() => {
    if (!project) return;
    setFilterValues({});
    setSearch("");
    fetch(`/api/filters?projectId=${project.id}`)
      .then((r) => r.json())
      .then((d) => setFilters(d.filters ?? []));
  }, [project]);

  useEffect(() => {
    if (project) {
      fetchUnits();
      fetchMyBlocks();
      fetchActivities();
    }
  }, [project, fetchUnits, fetchMyBlocks, fetchActivities]);

  useEffect(() => {
    if (!project) return;

    const unsubs = [
      subscribe(REALTIME_EVENTS.UNIT_UPDATED, () => {
        fetchUnits();
        fetchMyBlocks();
      }),
      subscribe(REALTIME_EVENTS.BLOCK_EXPIRED, (payload: { unitNumber: string }) => {
        toast.info(`Unit ${payload.unitNumber} has been released`);
        fetchUnits();
        fetchMyBlocks();
      }),
      subscribe(REALTIME_EVENTS.ACTIVITY_NEW, (payload: ActivityItem) => {
        setActivities((prev) => [payload, ...prev].slice(0, 30));
      }),
      subscribe(REALTIME_EVENTS.BOOKING_CONFIRMED, () => {
        fetchUnits();
        fetchMyBlocks();
        fetchActivities();
      }),
      subscribe(REALTIME_EVENTS.BOOKING_SUBMITTED, () => {
        fetchUnits();
        fetchMyBlocks();
        fetchActivities();
      }),
      subscribe(REALTIME_EVENTS.BOOKING_REJECTED, () => {
        fetchUnits();
        fetchMyBlocks();
        fetchActivities();
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [project, subscribe, fetchUnits, fetchMyBlocks, fetchActivities]);

  const handleBlock = async (unit: UnitCardData) => {
    if (!project || !canBlock) return;
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: unit.id, projectId: project.id }),
    });
    const data = await res.json();

    if (data.code === "MAX_BLOCKS") {
      setShowMaxBlocks(true);
      return;
    }

    if (data.code === "BLOCKING_DISABLED") {
      toast.error("Blocking is not available for this project yet");
      return;
    }

    if (!res.ok) {
      toast.error(data.error ?? "Failed to block unit");
      return;
    }

    toast.success(`Blocked ${unit.unitNumber} for ${blockDurationLabel}`);
    setSelectedUnit(null);
    fetchUnits();
    fetchMyBlocks();
    fetchActivities();
  };

  const handleRelease = async (blockId: string) => {
    const res = await fetch(`/api/blocks/${blockId}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Unit released");
      fetchUnits();
      fetchMyBlocks();
    }
  };

  const handleBooking = async () => {
    if (!bookingBlockId || !project) return;
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: bookingBlockId, customerName, customerPhone }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Booking failed");
      return;
    }

    if (project.requiresBookingApproval && !data.pending) {
      toast.error(
        "Booking was confirmed instantly — approval setting may not be saved for this project. Contact admin."
      );
    } else if (data.pending) {
      toast.success("Submitted for approval — unit stays blocked until admin acts");
    } else {
      toast.success("Booking confirmed!");
    }
    setShowBooking(false);
    setCustomerName("");
    setCustomerPhone("");
    setBookingBlockId(null);
    fetchUnits();
    fetchMyBlocks();
    fetchActivities();
    refetchProjects();
  };

  if (projectLoading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-center text-gray-500">No projects assigned. Contact your admin.</p>
      </div>
    );
  }

  const blocksPanel = (
    <>
      <h2 className="mb-3 text-sm font-semibold text-gray-900">My Blocked Units</h2>
      {myBlocks.length === 0 ? (
        <p className="text-xs text-gray-400">No active blocks</p>
      ) : (
        <div className="space-y-3">
          {myBlocks.map((block) => (
            <div key={block.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="font-semibold text-gray-900">{block.unit.unitNumber}</p>
              <p className="text-xs text-gray-500">
                {block.unit.towerName} · {block.unit.bhkType}
              </p>
              {block.pendingApproval && (
                <p className="mt-1 text-xs font-medium text-blue-700">Pending approval</p>
              )}
              <BlockTimer expiresAt={block.expiresAt} className="mt-2" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={block.pendingApproval}
                  onClick={() => handleRelease(block.id)}
                >
                  Release
                </Button>
                {!block.pendingApproval && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setBookingBlockId(block.id);
                      setShowBooking(true);
                    }}
                  >
                    Proceed to Booking
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6">
        <ActivityFeed activities={activities} />
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Toaster position="top-right" richColors />
      <TopBar activeBlocks={myBlocks.length} maxBlocks={project.maxBlocksPerUser}>
        <ProjectSwitcher
          projects={projects}
          selectedId={project.id}
          onChange={setSelectedProject}
        />
        <div className="flex w-full flex-col gap-2 lg:w-auto">
          <FilterBar
            filters={isLgUp ? filters : []}
            values={filterValues}
            onChange={(k, v) => setFilterValues((prev) => ({ ...prev, [k]: v }))}
            search={search}
            onSearchChange={setSearch}
            compact={!isLgUp}
          />
          {!isLgUp && filters.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                {showMobileFilters ? "Hide filters" : "Filters"}
              </Button>
              {showMobileFilters && (
                <div className="flex flex-col gap-2">
                  {filters.map((filter) => {
                    const queryKey = filterDimensionToQueryKey(filter.dimension);
                    return (
                      <select
                        key={filter.dimension}
                        value={filterValues[queryKey] ?? ""}
                        onChange={(e) =>
                          setFilterValues((prev) => ({ ...prev, [queryKey]: e.target.value }))
                        }
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                      >
                        <option value="">{filter.label}</option>
                        {filter.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showHeatmap}
            onChange={(e) => {
              setShowHeatmap(e.target.checked);
              if (e.target.checked) {
                fetch(`/api/heatmap?projectId=${project.id}`)
                  .then((r) => r.json())
                  .then((d) => setHeatmapData(d.heatmap ?? {}));
              }
            }}
          />
          Heatmap
        </label>
        <span className={`text-xs ${isConnected ? "text-emerald-600" : "text-gray-400"}`}>
          {isConnected ? "● Live" : "○ Offline"}
        </span>
      </TopBar>

      {project.lifecycleStatus === "UPCOMING" && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-800">
          View-only mode — blocking opens on launch day. You can browse inventory but cannot block
          units.
        </div>
      )}

      {project.requiresBookingApproval && (
        <div className="border-b border-blue-200 bg-blue-50 px-6 py-2 text-sm text-blue-800">
          Bookings for this project require admin approval. After you submit, the unit stays blocked
          until an admin approves or rejects.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          {!isLgUp && (
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setMobilePanel("units")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mobilePanel === "units"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                Units
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel("blocks")}
                className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                  mobilePanel === "blocks"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                My Blocks ({myBlocks.length})
              </button>
            </div>
          )}
          {(isLgUp || mobilePanel === "units") && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <StatusLegend />
                <ProjectStatusBadge status={project.lifecycleStatus} />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <UnitGrid
                  units={units}
                  currentUserId={session?.user?.id}
                  onUnitClick={setSelectedUnit}
                  maxColumns={4}
                  showHeatmap={showHeatmap}
                  heatmapData={heatmapData}
                  blockingAllowed={canBlock}
                />
              </div>
            </>
          )}
          {!isLgUp && mobilePanel === "blocks" && (
            <div className="min-h-0 flex-1 overflow-y-auto">{blocksPanel}</div>
          )}
        </div>

        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4 lg:block">
          {blocksPanel}
        </aside>
      </div>

      <Modal
        open={!!selectedUnit}
        onOpenChange={(open) => !open && setSelectedUnit(null)}
        title={selectedUnit?.unitNumber ?? ""}
        description={`${selectedUnit?.towerName} · ${selectedUnit?.bhkType}`}
        className="max-w-2xl"
      >
        {selectedUnit && (
          <TabsRoot defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="floorplan">Floor Plan</TabsTrigger>
              <TabsTrigger value="costsheet">Cost Sheet</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Status:</strong> {selectedUnit.status}
                </p>
                <p>
                  <strong>Carpet:</strong> {selectedUnit.carpetArea ?? "N/A"} sqft
                </p>
                <p>
                  <strong>Super built-up:</strong> {selectedUnit.superArea ?? "N/A"} sqft
                </p>
                <p>
                  <strong>Facing:</strong> {selectedUnit.facing ?? "N/A"}
                </p>
                {selectedUnit.price && (
                  <p>
                    <strong>Price:</strong> {formatPrice(selectedUnit.price)}
                  </p>
                )}
              </div>
              {selectedUnit.status === "AVAILABLE" && canBlock && (
                <Button className="mt-4 w-full" onClick={() => handleBlock(selectedUnit)}>
                  Block Unit ({blockDurationLabel})
                </Button>
              )}
              {selectedUnit.status === "AVAILABLE" && !canBlock && (
                <p className="mt-4 text-center text-sm text-gray-500">
                  Blocking not available — project is in view-only mode
                </p>
              )}
            </TabsContent>
            <TabsContent value="floorplan">
              <FloorPlanViewer
                name={selectedUnit.floorPlan?.name ?? selectedUnit.unitNumber}
                imageUrl={selectedUnit.floorPlan?.imageUrl ?? selectedUnit.floorPlanImageUrl}
                pdfUrl={selectedUnit.floorPlan?.pdfUrl}
                bhkType={selectedUnit.bhkType ?? undefined}
                carpetArea={selectedUnit.carpetArea ?? undefined}
                amenities={selectedUnit.floorPlan?.amenities}
              />
            </TabsContent>
            <TabsContent value="costsheet">
              {selectedUnit &&
              (
                selectedUnit as UnitCardData & {
                  costSheet?: {
                    name: string;
                    lineItems: Array<{ label: string; amount: number }>;
                    totalPrice: number;
                  };
                }
              ).costSheet ? (
                <CostSheetTable
                  costSheet={
                    (
                      selectedUnit as UnitCardData & {
                        costSheet: {
                          name: string;
                          lineItems: Array<{ label: string; amount: number }>;
                          totalPrice: number;
                        };
                      }
                    ).costSheet
                  }
                />
              ) : (
                <p className="text-sm text-gray-400">No cost sheet assigned</p>
              )}
            </TabsContent>
          </TabsRoot>
        )}
      </Modal>

      <MaxBlocksDialog
        open={showMaxBlocks}
        onOpenChange={setShowMaxBlocks}
        maxBlocks={project.maxBlocksPerUser}
      />

      <Modal
        open={showBooking}
        onOpenChange={setShowBooking}
        title={project.requiresBookingApproval ? "Submit for Approval" : "Confirm Booking"}
        description={
          project.requiresBookingApproval
            ? "Enter customer details. An admin must approve before the unit is booked."
            : "Enter customer details to complete the booking"
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Customer Name</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="10-digit phone"
            />
          </div>
          <Button
            className="w-full"
            onClick={handleBooking}
            disabled={!customerName || customerPhone.length < 10}
          >
            {project.requiresBookingApproval ? "Submit for Approval" : "Confirm Booking"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function LiveBookingPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <LiveBookingContent />
    </Suspense>
  );
}
