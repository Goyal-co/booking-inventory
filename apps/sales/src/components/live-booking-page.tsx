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
  CostSheetEngineView,
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
  type CostSheetEngineData,
} from "@booking/ui";
import { useRealtime } from "@booking/realtime";
import { REALTIME_EVENTS } from "@booking/realtime";
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
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  /** Actual price fixed into the booking form (not estimation). */
  const [discountedPricePerSqft, setDiscountedPricePerSqft] = useState("");
  const [defaultSaleablePricePerSqft, setDefaultSaleablePricePerSqft] = useState<number | null>(null);
  const [defaultCostSheet, setDefaultCostSheet] = useState<CostSheetEngineData | null>(null);
  const [bookingFormCostSheet, setBookingFormCostSheet] = useState<CostSheetEngineData | null>(null);
  /** Preview-only estimate — never sent to booking form. */
  const [estimatePrice, setEstimatePrice] = useState("");
  const [estimatePreviewSheet, setEstimatePreviewSheet] = useState<CostSheetEngineData | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [loadingDefaultSheet, setLoadingDefaultSheet] = useState(false);
  const [unitDefaultPrice, setUnitDefaultPrice] = useState<number | null>(null);
  const [unitDefaultSheet, setUnitDefaultSheet] = useState<CostSheetEngineData | null>(null);
  const [unitEstimatePrice, setUnitEstimatePrice] = useState("");
  const [unitEstimatePreview, setUnitEstimatePreview] = useState<CostSheetEngineData | null>(null);
  const [unitEstimating, setUnitEstimating] = useState(false);
  const [unitLoadingDefault, setUnitLoadingDefault] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadResults, setLeadResults] = useState<
    Array<{ leadId: string; customerName: string; customerPhone: string }>
  >([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [customerUrl, setCustomerUrl] = useState<string | null>(null);
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

  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

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
    const data = await parseJsonSafe(res);

    if (data.code === "MAX_BLOCKS") {
      setShowMaxBlocks(true);
      return;
    }

    if (data.code === "BLOCKING_DISABLED") {
      toast.error("Blocking is not available for this project yet");
      return;
    }

    if (!res.ok) {
      toast.error(
        typeof data.error === "string" ? data.error : "Failed to block unit"
      );
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
    const discounted = discountedPricePerSqft.trim();
    const res = await fetch(`/api/blocks/${bookingBlockId}/customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerEmail,
        customerPhone,
        ...(discounted ? { saleablePricePerSqft: Number(discounted) } : {}),
        ...(selectedLeadId ? { leadId: selectedLeadId } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(data.error ?? "Failed to send booking link");
      return;
    }

    setCustomerUrl(data.customerUrl ?? null);
    if (data.costSheet) {
      setBookingFormCostSheet(data.costSheet as CostSheetEngineData);
    }
    if (data.emailSent) {
      toast.success("Booking form link emailed to customer (Brevo)");
    } else if (data.emailMocked) {
      toast.message("Booking link ready — email mocked (add BREVO_API_KEY to sales .env.local)");
      if (data.devBookingUrl || data.customerUrl) {
        toast.message(`Dev link: ${data.devBookingUrl ?? data.customerUrl}`);
      }
    } else if (data.emailError) {
      toast.error(String(data.emailError));
      if (data.customerUrl) toast.message(`Share this link: ${data.customerUrl}`);
    } else {
      toast.success("Digital booking link sent — booking form uses the discounted price (not estimate)");
    }
    fetchMyBlocks();
    fetchActivities();
  };

  const searchLeads = async (q: string) => {
    setLeadSearch(q);
    if (q.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    const res = await fetch(`/api/leads/search?q=${encodeURIComponent(q)}`);
    const data = await res.json().catch(() => ({}));
    setLeadResults(data.leads ?? []);
  };

  const loadUnitDefaultCostSheet = useCallback(async (unitId: string) => {
    setUnitLoadingDefault(true);
    try {
      const res = await fetch(`/api/units/${unitId}/cost-sheet/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Unable to load default cost sheet");
        return;
      }
      if (data.costSheet) {
        setUnitDefaultSheet(data.costSheet as CostSheetEngineData);
        const def =
          typeof data.defaultSaleablePricePerSqft === "number"
            ? data.defaultSaleablePricePerSqft
            : Number((data.costSheet as CostSheetEngineData).saleablePricePerSqft) || null;
        setUnitDefaultPrice(def);
        setUnitEstimatePrice("");
        setUnitEstimatePreview(null);
      }
    } finally {
      setUnitLoadingDefault(false);
    }
  }, []);

  const loadBlockDefaultCostSheet = useCallback(async (blockId: string) => {
    setLoadingDefaultSheet(true);
    try {
      const res = await fetch(`/api/blocks/${blockId}/cost-sheet/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Unable to load default cost sheet");
        return;
      }
      if (data.costSheet) {
        setDefaultCostSheet(data.costSheet as CostSheetEngineData);
        const def =
          typeof data.defaultSaleablePricePerSqft === "number"
            ? data.defaultSaleablePricePerSqft
            : Number((data.costSheet as CostSheetEngineData).saleablePricePerSqft) || null;
        setDefaultSaleablePricePerSqft(def);
        // Prefill discounted booking price with admin default; user can change it.
        setDiscountedPricePerSqft(def != null ? String(def) : "");
        setEstimatePrice("");
        setEstimatePreviewSheet(null);
        setBookingFormCostSheet(null);
      }
    } finally {
      setLoadingDefaultSheet(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedUnit) return;
    void loadUnitDefaultCostSheet(selectedUnit.id);
  }, [selectedUnit?.id, loadUnitDefaultCostSheet]);

  useEffect(() => {
    if (!showBooking || !bookingBlockId) return;
    void loadBlockDefaultCostSheet(bookingBlockId);
  }, [showBooking, bookingBlockId, loadBlockDefaultCostSheet]);

  const estimateBlockCostSheet = async () => {
    if (!bookingBlockId) return;
    const entered = estimatePrice.trim();
    if (!entered || Number(entered) <= 0) {
      toast.error("Enter a price / sq.ft to estimate");
      return;
    }
    setEstimating(true);
    try {
      const res = await fetch(`/api/blocks/${bookingBlockId}/cost-sheet/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleablePricePerSqft: Number(entered) }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Unable to estimate cost sheet");
        return;
      }
      if (data.costSheet) {
        setEstimatePreviewSheet(data.costSheet as CostSheetEngineData);
        toast.success("Estimate ready (preview only — not used for booking form)");
      }
    } finally {
      setEstimating(false);
    }
  };

  const estimateUnitCostSheet = async (unitId: string) => {
    const entered = unitEstimatePrice.trim();
    if (!entered || Number(entered) <= 0) {
      toast.error("Enter a price / sq.ft to estimate");
      return;
    }
    setUnitEstimating(true);
    try {
      const res = await fetch(`/api/units/${unitId}/cost-sheet/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleablePricePerSqft: Number(entered) }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Unable to estimate cost sheet");
        return;
      }
      if (data.costSheet) {
        setUnitEstimatePreview(data.costSheet as CostSheetEngineData);
        toast.success("Estimate ready (preview only)");
      }
    } finally {
      setUnitEstimating(false);
    }
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
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Live Booking
            </h1>
            <p className="text-sm text-gray-500">
              Project: {project.name}
              {project.lifecycleStatus === "LAUNCH_DAY" && (
                <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  Launch Day
                </span>
              )}
            </p>
          </div>
          <ProjectSwitcher
            projects={projects}
            selectedId={project.id}
            onChange={setSelectedProject}
          />
        </div>
        <div className="mt-3 flex w-full flex-col gap-2 lg:flex-row lg:items-center">
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
      </div>

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
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUnit(null);
            setUnitEstimatePrice("");
            setUnitDefaultPrice(null);
            setUnitDefaultSheet(null);
            setUnitEstimatePreview(null);
          }
        }}
        title={selectedUnit?.unitNumber ?? ""}
        description={`${selectedUnit?.towerName} · ${selectedUnit?.bhkType}`}
        className="max-w-3xl"
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
              <div className="space-y-4">
                {unitDefaultPrice != null && (
                  <p className="text-xs text-gray-500">
                    Admin default: <strong>{formatPrice(unitDefaultPrice)}</strong> / sq.ft
                  </p>
                )}

                {unitLoadingDefault && !unitDefaultSheet ? (
                  <p className="text-sm text-gray-500">Loading default cost sheet…</p>
                ) : unitDefaultSheet ? (
                  <CostSheetEngineView
                    costSheet={unitDefaultSheet}
                    title="Cost Sheet (Admin Default)"
                    compact
                  />
                ) : (
                  <p className="text-sm text-gray-500">
                    Default cost sheet is unavailable. Set a project default saleable price in Admin → Cost Sheet Config.
                  </p>
                )}

                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Label htmlFor="unit-estimate-price">Estimate (preview only)</Label>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      Not used for booking
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Input
                      id="unit-estimate-price"
                      type="number"
                      value={unitEstimatePrice}
                      onChange={(e) => setUnitEstimatePrice(e.target.value)}
                      placeholder="Enter a rate to estimate"
                      className="min-w-[160px] flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={unitEstimating}
                      onClick={() => estimateUnitCostSheet(selectedUnit.id)}
                    >
                      {unitEstimating ? "Estimating..." : "Estimate"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-amber-800/80">
                    Estimation is for reference only. Booking form cost is set later using the Discounted Price field.
                  </p>
                  {unitEstimatePreview && (
                    <div className="mt-3">
                      <CostSheetEngineView
                        costSheet={unitEstimatePreview}
                        title="Estimated Cost Sheet (Preview)"
                        compact
                      />
                    </div>
                  )}
                </div>
              </div>
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
        onOpenChange={(open) => {
          setShowBooking(open);
          if (!open) {
            setCustomerName("");
            setCustomerEmail("");
            setCustomerPhone("");
            setDiscountedPricePerSqft("");
            setDefaultSaleablePricePerSqft(null);
            setDefaultCostSheet(null);
            setBookingFormCostSheet(null);
            setEstimatePrice("");
            setEstimatePreviewSheet(null);
            setLeadSearch("");
            setLeadResults([]);
            setSelectedLeadId(undefined);
            setCustomerUrl(null);
            setBookingBlockId(null);
          }
        }}
        title="Send Digital Booking Form"
        description="Estimation is preview only. Use Discounted Price / sq.ft to fix the cost sheet on the booking form."
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="lead-search">Search Lead (optional)</Label>
            <Input
              id="lead-search"
              value={leadSearch}
              onChange={(e) => searchLeads(e.target.value)}
              placeholder="Lead ID, phone, or name"
            />
            {leadResults.length > 0 && (
              <div className="mt-1 max-h-32 overflow-y-auto rounded border text-sm">
                {leadResults.map((lead) => (
                  <button
                    key={lead.leadId}
                    type="button"
                    className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${
                      selectedLeadId === lead.leadId ? "bg-brand-50" : ""
                    }`}
                    onClick={() => {
                      setSelectedLeadId(lead.leadId);
                      setCustomerName(lead.customerName);
                      setCustomerPhone(lead.customerPhone);
                    }}
                  >
                    {lead.leadId} — {lead.customerName}
                  </button>
                ))}
              </div>
            )}
          </div>
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
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
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

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="discounted-price">Discounted Price / sq.ft (for booking form)</Label>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                Fixed into booking form
              </span>
            </div>
            {defaultSaleablePricePerSqft != null && (
              <p className="mb-2 text-xs text-gray-500">
                Admin default: <strong>{formatPrice(defaultSaleablePricePerSqft)}</strong> / sq.ft
              </p>
            )}
            <Input
              id="discounted-price"
              type="number"
              value={discountedPricePerSqft}
              onChange={(e) => setDiscountedPricePerSqft(e.target.value)}
              placeholder="Enter discounted saleable price / sq.ft"
            />
            <p className="mt-2 text-xs text-gray-500">
              This value is saved on the block and used to generate the customer booking form cost sheet. Leave as admin default if no discount.
            </p>
          </div>

          {loadingDefaultSheet && !defaultCostSheet ? (
            <p className="text-sm text-gray-500">Loading default cost sheet…</p>
          ) : defaultCostSheet ? (
            <CostSheetEngineView
              costSheet={defaultCostSheet}
              title="Cost Sheet (Admin Default)"
              compact
            />
          ) : null}

          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="estimate-price">Estimate (preview only)</Label>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Not used for booking form
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              <Input
                id="estimate-price"
                type="number"
                value={estimatePrice}
                onChange={(e) => setEstimatePrice(e.target.value)}
                placeholder="Enter a rate to estimate"
                className="min-w-[160px] flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={estimating || !bookingBlockId}
                onClick={estimateBlockCostSheet}
              >
                {estimating ? "Estimating..." : "Estimate"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-amber-800/80">
              Use Estimate only to compare scenarios. It does not change the booking form cost.
            </p>
            {estimatePreviewSheet && (
              <div className="mt-3">
                <CostSheetEngineView
                  costSheet={estimatePreviewSheet}
                  title="Estimated Cost Sheet (Preview)"
                  compact
                />
              </div>
            )}
          </div>

          {bookingFormCostSheet && (
            <CostSheetEngineView
              costSheet={bookingFormCostSheet}
              title="Booking Form Cost Sheet (Locked)"
              compact
            />
          )}

          {customerUrl && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="font-medium text-emerald-800">Booking link ready</p>
              <a href={customerUrl} target="_blank" rel="noreferrer" className="break-all text-brand-600 underline">
                {customerUrl}
              </a>
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleBooking}
            disabled={!customerName || !customerEmail || customerPhone.length < 10}
          >
            {customerUrl ? "Resend Booking Link" : "Send Booking Link"}
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
