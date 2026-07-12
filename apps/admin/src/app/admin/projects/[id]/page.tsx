"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Modal, ProjectStatusBadge, formatBlockDuration } from "@booking/ui";
import { toast, Toaster } from "sonner";
import { useAdminSession } from "@/hooks/use-admin-session";
import { FloorPlanPanel } from "@/components/floor-plan-panel";
import { UnitStackGenerator } from "@/components/unit-stack-generator";

const FILTER_DIMENSIONS = [
  "TOWER",
  "BHK",
  "STATUS",
  "FLOOR",
  "FACING",
  "PRICE_BAND",
  "CUSTOM_TAG",
  "CARPET_AREA",
  "SUPER_BUILT_UP",
] as const;

type FilterDimension = (typeof FILTER_DIMENSIONS)[number];

const DIMENSION_LABELS: Record<FilterDimension, string> = {
  TOWER: "Tower",
  BHK: "Unit Type (BHK)",
  STATUS: "Status",
  FLOOR: "Floor",
  FACING: "Facing",
  PRICE_BAND: "Price Band",
  CUSTOM_TAG: "Custom Tag",
  CARPET_AREA: "Carpet Area",
  SUPER_BUILT_UP: "Super Built-up Area",
};

interface FilterConfigRow {
  id: string;
  dimension: FilterDimension;
  label: string;
  options: Array<{ value: string; label: string }>;
  sortOrder: number;
  isActive: boolean;
}

interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublished: boolean;
  requiresBookingApproval: boolean;
  blockDurationMs: number;
  maxBlocksPerUser: number;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  statusAutoManage: boolean;
  launchDate: string | null;
  ongoingBlockDurationDays: number | null;
  filterConfigs: FilterConfigRow[];
  floorPlanTypes: Array<{
    id: string;
    name: string;
    bhkType: string;
    carpetArea: number;
    imageUrl: string | null;
    pdfUrl: string | null;
  }>;
  costSheetTemplates: Array<{ id: string; name: string; totalPrice: string }>;
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
    floors: Array<{ id: string; number: number; _count: { units: number } }>;
  }>;
}

const emptyFilterForm = () => ({
  dimension: "TOWER" as FilterDimension,
  label: "",
  options: [{ value: "", label: "" }],
});

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isSuperAdmin } = useAdminSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [step, setStep] = useState(1);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showTowerModal, setShowTowerModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

  const [costForm, setCostForm] = useState({ name: "", basePrice: 8500000, floorRise: 200000, plc: 150000, parking: 300000, floorPlanTypeId: "" });
  const [towerForm, setTowerForm] = useState({ name: "", code: "" });
  const [filterForm, setFilterForm] = useState(emptyFilterForm);
  const [savingFilter, setSavingFilter] = useState(false);

  const [lifecycleForm, setLifecycleForm] = useState({
    lifecycleStatus: "UPCOMING" as "UPCOMING" | "LAUNCH_DAY" | "ONGOING",
    blockDurationMinutes: 15,
    blockDurationDays: 3,
    maxBlocksPerUser: 3,
    statusAutoManage: true,
    launchDate: "",
    requiresBookingApproval: false,
  });
  const [savingLifecycle, setSavingLifecycle] = useState(false);
  const [metadataForm, setMetadataForm] = useState({ name: "", slug: "", description: "", isPublished: false });
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(
        typeof data.error === "string"
          ? data.error
          : "Failed to load project. Run pnpm db:push:schema against your dev database."
      );
      return;
    }
    const p = data.project;
    setProject(p);
    if (p) {
      setMetadataForm({
        name: p.name ?? "",
        slug: p.slug ?? "",
        description: p.description ?? "",
        isPublished: p.isPublished ?? false,
      });
      setLifecycleForm({
        lifecycleStatus: p.lifecycleStatus ?? "UPCOMING",
        blockDurationMinutes: Math.round((p.blockDurationMs ?? 900000) / 60000),
        blockDurationDays: p.ongoingBlockDurationDays ?? Math.round((p.blockDurationMs ?? 259200000) / 86400000),
        maxBlocksPerUser: p.maxBlocksPerUser ?? 3,
        statusAutoManage: p.statusAutoManage ?? true,
        launchDate: p.launchDate ? new Date(p.launchDate).toISOString().slice(0, 10) : "",
        requiresBookingApproval: p.requiresBookingApproval ?? false,
      });
    }
  };

  useEffect(() => { load(); }, [id]);

  const editFilterConfig = (config: FilterConfigRow) => {
    setFilterForm({
      dimension: config.dimension,
      label: config.label,
      options: config.options.length > 0 ? config.options : [{ value: "", label: "" }],
    });
  };

  const saveFilterConfig = async () => {
    const options = filterForm.options
      .map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
      .filter((o) => o.value && o.label);
    if (!filterForm.label.trim() || options.length === 0) {
      toast.error("Label and at least one option are required");
      return;
    }
    setSavingFilter(true);
    const res = await fetch(`/api/projects/${id}/filter-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dimension: filterForm.dimension,
        label: filterForm.label.trim(),
        options,
      }),
    });
    setSavingFilter(false);
    if (res.ok) {
      toast.success("Filter saved");
      setFilterForm(emptyFilterForm());
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Failed to save filter");
    }
  };

  const addCostSheet = async () => {
    const lineItems = [
      { label: "Base Price", amount: costForm.basePrice },
      { label: "Floor Rise", amount: costForm.floorRise },
      { label: "PLC", amount: costForm.plc },
      { label: "Parking", amount: costForm.parking },
      { label: "GST (5%)", amount: Math.round((costForm.basePrice + costForm.floorRise + costForm.plc + costForm.parking) * 0.05) },
    ];
    const res = await fetch(`/api/projects/${id}/cost-sheets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: costForm.name, lineItems, floorPlanTypeId: costForm.floorPlanTypeId || undefined }),
    });
    if (res.ok) { toast.success("Cost sheet added"); setShowCostModal(false); load(); }
  };

  const addTower = async () => {
    const res = await fetch(`/api/projects/${id}/towers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(towerForm),
    });
    if (res.ok) { toast.success("Tower added"); setShowTowerModal(false); load(); }
  };

  const publish = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: true }),
    });
    toast.success("Project published!");
    load();
  };

  const saveMetadata = async () => {
    setSavingMetadata(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: metadataForm.name,
        slug: metadataForm.slug,
        description: metadataForm.description || undefined,
        isPublished: metadataForm.isPublished,
      }),
    });
    setSavingMetadata(false);
    if (res.ok) {
      toast.success("Project details saved");
      load();
    } else {
      const data = await res.json();
      toast.error(typeof data.error === "string" ? data.error : "Failed to save project details");
    }
  };

  const deleteProject = async () => {
    setDeleting(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success("Project deleted");
      router.push("/admin/projects");
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to delete project");
    }
  };

  const saveApprovalSetting = async (enabled: boolean) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiresBookingApproval: enabled }),
    });
    if (res.ok) {
      toast.success(enabled ? "Booking approval enabled" : "Instant booking enabled");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to update approval setting");
      setLifecycleForm((prev) => ({ ...prev, requiresBookingApproval: !enabled }));
    }
  };

  const saveLifecycle = async () => {
    setSavingLifecycle(true);
    const payload: Record<string, unknown> = {
      lifecycleStatus: lifecycleForm.lifecycleStatus,
      maxBlocksPerUser: lifecycleForm.maxBlocksPerUser,
      statusAutoManage: lifecycleForm.statusAutoManage,
      requiresBookingApproval: lifecycleForm.requiresBookingApproval,
      launchDate: lifecycleForm.launchDate
        ? new Date(lifecycleForm.launchDate).toISOString()
        : null,
    };

    if (lifecycleForm.lifecycleStatus === "LAUNCH_DAY") {
      payload.blockDurationMs = lifecycleForm.blockDurationMinutes * 60_000;
    } else if (lifecycleForm.lifecycleStatus === "ONGOING") {
      payload.blockDurationDays = lifecycleForm.blockDurationDays;
    }

    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSavingLifecycle(false);
    if (res.ok) {
      toast.success("Project settings saved");
      load();
    } else {
      toast.error("Failed to save settings");
    }
  };

  if (!project) return <div className="p-6">Loading...</div>;

  const steps = [
    { n: 1, title: "Floor Plans", count: project.floorPlanTypes.length },
    { n: 2, title: "Cost Sheets", count: project.costSheetTemplates.length, action: () => setShowCostModal(true) },
    { n: 3, title: "Towers", count: project.towers.length, action: () => setShowTowerModal(true) },
    { n: 4, title: "Generate Inventory", count: project.towers.reduce((s, t) => s + t.floors.reduce((fs, f) => fs + f._count.units, 0), 0), action: () => setShowGenModal(true) },
  ];

  return (
    <div className="p-6">
      <Toaster position="top-right" richColors />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <ProjectStatusBadge status={project.lifecycleStatus} />
          </div>
          <p className="text-sm text-gray-500">Project Setup Wizard</p>
        </div>
        {!project.isPublished && (
          <Button variant="success" onClick={publish}>Publish Project</Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/projects/${id}/cost-config`}>
            <Button variant="outline">Cost Sheet Config</Button>
          </Link>
          <Link href={`/admin/projects/${id}/booking-form-template`}>
            <Button variant="outline">Booking Form Template</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">General</CardTitle>
          <p className="text-sm text-gray-500">Name, slug, and visibility settings.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Project Name</Label>
              <Input
                className="mt-1"
                value={metadataForm.name}
                onChange={(e) => setMetadataForm({ ...metadataForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                className="mt-1"
                value={metadataForm.slug}
                onChange={(e) => setMetadataForm({ ...metadataForm, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                placeholder="skyline-heights"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              rows={3}
              value={metadataForm.description}
              onChange={(e) => setMetadataForm({ ...metadataForm, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={metadataForm.isPublished}
              onChange={(e) => setMetadataForm({ ...metadataForm, isPublished: e.target.checked })}
            />
            Published (visible to assigned sales users)
          </label>
          <Button onClick={saveMetadata} disabled={savingMetadata}>
            {savingMetadata ? "Saving..." : "Save Details"}
          </Button>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <Card className="mb-8 border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">Danger Zone</CardTitle>
            <p className="text-sm text-gray-500">
              Permanently delete this project and all towers, units, and access records.
              Only allowed when there are no bookings.
            </p>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
              Delete Project
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Project Settings</CardTitle>
          <p className="text-sm text-gray-500">
            Lifecycle status controls when sales can block units and for how long.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Lifecycle Status</Label>
              <select
                className="mt-1 w-full rounded-lg border p-2"
                value={lifecycleForm.lifecycleStatus}
                onChange={(e) =>
                  setLifecycleForm({
                    ...lifecycleForm,
                    lifecycleStatus: e.target.value as "UPCOMING" | "LAUNCH_DAY" | "ONGOING",
                  })
                }
              >
                <option value="UPCOMING">Upcoming (view only)</option>
                <option value="LAUNCH_DAY">Launch Day</option>
                <option value="ONGOING">Ongoing</option>
              </select>
            </div>
            <div>
              <Label>Launch Date</Label>
              <Input
                type="date"
                className="mt-1"
                value={lifecycleForm.launchDate}
                onChange={(e) => setLifecycleForm({ ...lifecycleForm, launchDate: e.target.value })}
              />
            </div>
            <div>
              <Label>Max Blocks Per User</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="mt-1"
                value={lifecycleForm.maxBlocksPerUser}
                onChange={(e) =>
                  setLifecycleForm({ ...lifecycleForm, maxBlocksPerUser: +e.target.value })
                }
              />
            </div>
          </div>

          {lifecycleForm.lifecycleStatus === "LAUNCH_DAY" && (
            <div className="max-w-xs">
              <Label>Block Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                className="mt-1"
                value={lifecycleForm.blockDurationMinutes}
                onChange={(e) =>
                  setLifecycleForm({ ...lifecycleForm, blockDurationMinutes: +e.target.value })
                }
              />
            </div>
          )}

          {lifecycleForm.lifecycleStatus === "ONGOING" && (
            <div className="max-w-xs">
              <Label>Block Duration (days, 1–7)</Label>
              <Input
                type="number"
                min={1}
                max={7}
                className="mt-1"
                value={lifecycleForm.blockDurationDays}
                onChange={(e) =>
                  setLifecycleForm({ ...lifecycleForm, blockDurationDays: +e.target.value })
                }
              />
            </div>
          )}

          {lifecycleForm.lifecycleStatus === "UPCOMING" && (
            <p className="text-sm text-gray-500">Blocking not available until launch day.</p>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lifecycleForm.statusAutoManage}
              onChange={(e) =>
                setLifecycleForm({ ...lifecycleForm, statusAutoManage: e.target.checked })
              }
            />
            Auto-switch to Launch Day on launch date
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lifecycleForm.requiresBookingApproval}
              onChange={(e) => {
                const enabled = e.target.checked;
                setLifecycleForm({
                  ...lifecycleForm,
                  requiresBookingApproval: enabled,
                });
                saveApprovalSetting(enabled);
              }}
            />
            Require admin approval for bookings (saves immediately)
          </label>

          <div className="flex items-center gap-3">
            <Button onClick={saveLifecycle} disabled={savingLifecycle}>
              {savingLifecycle ? "Saving..." : "Save Settings"}
            </Button>
            {project.requiresBookingApproval && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                Booking approval ON
              </span>
            )}
            {project.lifecycleStatus !== "UPCOMING" && (
              <span className="text-sm text-gray-500">
                Current: {formatBlockDuration(project.blockDurationMs)} blocks
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mb-8 flex gap-2">
        {steps.map((s) => (
          <button
            key={s.n}
            type="button"
            onClick={() => {
              setStep(s.n);
              s.action?.();
            }}
            className={`flex-1 rounded-xl border p-4 text-left transition-colors ${step === s.n ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white"}`}
          >
            <p className="text-xs font-semibold text-gray-500">Step {s.n}</p>
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-gray-500">{s.count} items</p>
          </button>
        ))}
      </div>

      {step === 1 && (
        <>
          <FloorPlanPanel
            projectId={id}
            plans={project.floorPlanTypes.map((p) => ({
              ...p,
              superArea: (p as { superArea?: number }).superArea ?? null,
              balconyArea: (p as { balconyArea?: number }).balconyArea ?? null,
              sizeType: (p as { sizeType?: string }).sizeType ?? "SBA",
              amenities: (p as { amenities?: string[] }).amenities ?? [],
            }))}
            onRefresh={load}
          />

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Inventory Filters</CardTitle>
              <p className="text-sm text-gray-500">
                Configure dropdown filters shown to sales on live booking, blocked units, and bookings pages.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {project.filterConfigs.length === 0 ? (
                <p className="text-sm text-gray-500">No filters configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {project.filterConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3"
                    >
                      <div>
                        <p className="font-medium">{config.label}</p>
                        <p className="text-xs text-gray-500">
                          {config.dimension} · {config.options.length} option{config.options.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => editFilterConfig(config)}>
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-gray-200 p-4">
                <p className="mb-3 text-sm font-semibold text-gray-900">
                  {project.filterConfigs.some((c) => c.dimension === filterForm.dimension) ? "Update" : "Add"} filter
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Dimension</Label>
                    <select
                      className="mt-1 w-full rounded-lg border p-2 text-sm"
                      value={filterForm.dimension}
                      onChange={(e) =>
                        setFilterForm({ ...filterForm, dimension: e.target.value as FilterDimension })
                      }
                    >
                      {FILTER_DIMENSIONS.map((d) => (
                        <option key={d} value={d}>{DIMENSION_LABELS[d]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Label</Label>
                    <Input
                      className="mt-1"
                      value={filterForm.label}
                      onChange={(e) => setFilterForm({ ...filterForm, label: e.target.value })}
                      placeholder="e.g. Tower"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Options</Label>
                  {filterForm.options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder="Value"
                        value={opt.value}
                        onChange={(e) => {
                          const options = [...filterForm.options];
                          options[idx] = { ...options[idx], value: e.target.value };
                          setFilterForm({ ...filterForm, options });
                        }}
                      />
                      <Input
                        placeholder="Label"
                        value={opt.label}
                        onChange={(e) => {
                          const options = [...filterForm.options];
                          options[idx] = { ...options[idx], label: e.target.value };
                          setFilterForm({ ...filterForm, options });
                        }}
                      />
                      {filterForm.options.length > 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setFilterForm({
                              ...filterForm,
                              options: filterForm.options.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setFilterForm({
                        ...filterForm,
                        options: [...filterForm.options, { value: "", label: "" }],
                      })
                    }
                  >
                    Add option
                  </Button>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button onClick={saveFilterConfig} disabled={savingFilter}>
                    {savingFilter ? "Saving..." : "Save filter"}
                  </Button>
                  <Button variant="outline" onClick={() => setFilterForm(emptyFilterForm())}>
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {step === 2 && (
        <div>
          <div className="mb-4 flex justify-between">
            <h2 className="text-lg font-semibold">Cost Sheet Templates</h2>
            <Button size="sm" onClick={() => setShowCostModal(true)}>Add Cost Sheet</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {project.costSheetTemplates.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-brand-600">₹{Number(c.totalPrice).toLocaleString("en-IN")}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <div className="mb-4 flex justify-between">
            <h2 className="text-lg font-semibold">Towers</h2>
            <Button size="sm" onClick={() => setShowTowerModal(true)}>Add Tower</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {project.towers.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-4">
                  <p className="font-semibold">{t.name} ({t.code})</p>
                  <p className="text-sm text-gray-500">{t.floors.length} floors</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <div className="mb-4 flex justify-between">
            <h2 className="text-lg font-semibold">Inventory Generator</h2>
            <Button size="sm" onClick={() => setShowGenModal(true)}>Generate Units</Button>
          </div>
          <p className="text-sm text-gray-500">Generate units using tower, floor range, and unit stack patterns.</p>
        </div>
      )}

      <Modal open={showCostModal} onOpenChange={setShowCostModal} title="Add Cost Sheet">
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={costForm.name} onChange={(e) => setCostForm({ ...costForm, name: e.target.value })} /></div>
          <div><Label>Base Price</Label><Input type="number" value={costForm.basePrice} onChange={(e) => setCostForm({ ...costForm, basePrice: +e.target.value })} /></div>
          <div><Label>Floor Rise</Label><Input type="number" value={costForm.floorRise} onChange={(e) => setCostForm({ ...costForm, floorRise: +e.target.value })} /></div>
          <div><Label>PLC</Label><Input type="number" value={costForm.plc} onChange={(e) => setCostForm({ ...costForm, plc: +e.target.value })} /></div>
          <div><Label>Parking</Label><Input type="number" value={costForm.parking} onChange={(e) => setCostForm({ ...costForm, parking: +e.target.value })} /></div>
          <select className="w-full rounded-lg border p-2" value={costForm.floorPlanTypeId} onChange={(e) => setCostForm({ ...costForm, floorPlanTypeId: e.target.value })}>
            <option value="">Link to floor plan (optional)</option>
            {project.floorPlanTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button className="w-full" onClick={addCostSheet}>Add</Button>
        </div>
      </Modal>

      <Modal open={showTowerModal} onOpenChange={setShowTowerModal} title="Add Tower">
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={towerForm.name} onChange={(e) => setTowerForm({ ...towerForm, name: e.target.value })} /></div>
          <div><Label>Code</Label><Input value={towerForm.code} onChange={(e) => setTowerForm({ ...towerForm, code: e.target.value })} placeholder="A" /></div>
          <Button className="w-full" onClick={addTower}>Add</Button>
        </div>
      </Modal>

      <UnitStackGenerator
        open={showGenModal}
        onOpenChange={setShowGenModal}
        projectId={id}
        towers={project.towers}
        floorPlans={project.floorPlanTypes.map((p) => ({
          id: p.id,
          name: p.name,
          bhkType: p.bhkType,
          superArea: (p as { superArea?: number }).superArea ?? null,
        }))}
        costSheets={project.costSheetTemplates.map((c) => ({
          ...c,
          floorPlanTypeId: (c as { floorPlanTypeId?: string | null }).floorPlanTypeId ?? null,
        }))}
        onSuccess={load}
      />

      <Modal open={showDeleteModal} onOpenChange={setShowDeleteModal} title="Delete Project">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will permanently delete <strong>{project.name}</strong> and all related inventory.
            This action cannot be undone.
          </p>
          <p className="text-sm text-red-600">
            Deletion is blocked if any units have bookings.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700"
              disabled={deleting}
              onClick={deleteProject}
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
