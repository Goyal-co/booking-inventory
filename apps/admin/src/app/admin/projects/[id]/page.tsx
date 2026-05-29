"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Modal, ProjectStatusBadge, formatBlockDuration } from "@booking/ui";
import { toast, Toaster } from "sonner";
import { uploadFloorPlanFile } from "@/lib/upload-floor-plan-client";
import { useAdminSession } from "@/hooks/use-admin-session";

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
  floorPlanTypes: Array<{
    id: string;
    name: string;
    bhkType: string;
    carpetArea: number;
    imageUrl: string | null;
    pdfUrl: string | null;
  }>;
  costSheetTemplates: Array<{ id: string; name: string; totalPrice: string }>;
  towers: Array<{ id: string; name: string; code: string; floors: Array<{ id: string; number: number; _count: { units: number } }> }>;
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isSuperAdmin } = useAdminSession();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [step, setStep] = useState(1);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProjectDetail["floorPlanTypes"][number] | null>(null);
  const [planPdfFile, setPlanPdfFile] = useState<File | null>(null);
  const [planImageFile, setPlanImageFile] = useState<File | null>(null);
  const [uploadingPlan, setUploadingPlan] = useState(false);
  const [showCostModal, setShowCostModal] = useState(false);
  const [showTowerModal, setShowTowerModal] = useState(false);
  const [showGenModal, setShowGenModal] = useState(false);

  const [planForm, setPlanForm] = useState({ name: "", bhkType: "2 BHK", carpetArea: 950, superArea: 1200, amenities: "" });
  const [costForm, setCostForm] = useState({ name: "", basePrice: 8500000, floorRise: 200000, plc: 150000, parking: 300000, floorPlanTypeId: "" });
  const [towerForm, setTowerForm] = useState({ name: "", code: "" });
  const [genForm, setGenForm] = useState({ towerId: "", fromFloor: 1, toFloor: 5, unitsPerFloor: 4, floorPlanTypeId: "", costSheetTemplateId: "" });

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
    const data = await res.json();
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

  const addFloorPlan = async () => {
    setUploadingPlan(true);
    try {
      let pdfUrl: string | undefined;
      let imageUrl: string | undefined;
      if (planPdfFile) pdfUrl = await uploadFloorPlanFile(planPdfFile, "pdf");
      if (planImageFile) imageUrl = await uploadFloorPlanFile(planImageFile, "image");

      const res = await fetch(`/api/projects/${id}/floor-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...planForm,
          pdfUrl,
          imageUrl,
          amenities: planForm.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (res.ok) {
        toast.success("Floor plan added");
        setShowPlanModal(false);
        setPlanPdfFile(null);
        setPlanImageFile(null);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Failed to add floor plan");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingPlan(false);
    }
  };

  const updateFloorPlanAssets = async () => {
    if (!editingPlan) return;
    setUploadingPlan(true);
    try {
      const payload: Record<string, string> = {};
      if (planPdfFile) payload.pdfUrl = await uploadFloorPlanFile(planPdfFile, "pdf");
      if (planImageFile) payload.imageUrl = await uploadFloorPlanFile(planImageFile, "image");
      if (Object.keys(payload).length === 0) {
        toast.error("Select a PDF or image to upload");
        return;
      }

      const res = await fetch(`/api/projects/${id}/floor-plans/${editingPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Floor plan updated");
        setEditingPlan(null);
        setPlanPdfFile(null);
        setPlanImageFile(null);
        load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(typeof data.error === "string" ? data.error : "Failed to update floor plan");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingPlan(false);
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

  const generateInventory = async () => {
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "generate", ...genForm }),
    });
    const data = await res.json();
    if (res.ok) { toast.success(`Created ${data.created} units`); setShowGenModal(false); load(); }
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
    { n: 1, title: "Floor Plans", count: project.floorPlanTypes.length, action: () => setShowPlanModal(true) },
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
            onClick={() => setStep(s.n)}
            className={`flex-1 rounded-xl border p-4 text-left transition-colors ${step === s.n ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white"}`}
          >
            <p className="text-xs font-semibold text-gray-500">Step {s.n}</p>
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-gray-500">{s.count} items</p>
          </button>
        ))}
      </div>

      {step === 1 && (
        <div>
          <div className="mb-4 flex justify-between">
            <h2 className="text-lg font-semibold">Floor Plan Types</h2>
            <Button size="sm" onClick={() => setShowPlanModal(true)}>Add Floor Plan</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {project.floorPlanTypes.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-sm text-gray-500">{p.bhkType} · {p.carpetArea} sqft</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.pdfUrl && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            PDF uploaded
                          </span>
                        )}
                        {p.imageUrl && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Image uploaded
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlan(p);
                        setPlanPdfFile(null);
                        setPlanImageFile(null);
                      }}
                    >
                      Upload
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
          <p className="text-sm text-gray-500">Bulk generate units by floor with floor plan and cost sheet assignment.</p>
        </div>
      )}

      <Modal open={showPlanModal} onOpenChange={setShowPlanModal} title="Add Floor Plan Type">
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} /></div>
          <div><Label>BHK Type</Label><Input value={planForm.bhkType} onChange={(e) => setPlanForm({ ...planForm, bhkType: e.target.value })} /></div>
          <div><Label>Carpet Area (sqft)</Label><Input type="number" value={planForm.carpetArea} onChange={(e) => setPlanForm({ ...planForm, carpetArea: +e.target.value })} /></div>
          <div><Label>Amenities (comma separated)</Label><Input value={planForm.amenities} onChange={(e) => setPlanForm({ ...planForm, amenities: e.target.value })} /></div>
          <div>
            <Label>Floor plan PDF</Label>
            <Input
              type="file"
              accept="application/pdf"
              className="mt-1"
              onChange={(e) => setPlanPdfFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-gray-500">PDF shown in sales floor plan tab (max 20MB)</p>
          </div>
          <div>
            <Label>Preview image (optional)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-1"
              onChange={(e) => setPlanImageFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button className="w-full" disabled={uploadingPlan} onClick={addFloorPlan}>
            {uploadingPlan ? "Uploading..." : "Add"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!editingPlan}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPlan(null);
            setPlanPdfFile(null);
            setPlanImageFile(null);
          }
        }}
        title={editingPlan ? `Upload files — ${editingPlan.name}` : "Upload floor plan"}
      >
        {editingPlan && (
          <div className="space-y-3">
            <div>
              <Label>Replace or add PDF</Label>
              <Input
                type="file"
                accept="application/pdf"
                className="mt-1"
                onChange={(e) => setPlanPdfFile(e.target.files?.[0] ?? null)}
              />
              {editingPlan.pdfUrl && (
                <a
                  href={editingPlan.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-brand-600 hover:underline"
                >
                  View current PDF
                </a>
              )}
            </div>
            <div>
              <Label>Replace or add preview image</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="mt-1"
                onChange={(e) => setPlanImageFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button className="w-full" disabled={uploadingPlan} onClick={updateFloorPlanAssets}>
              {uploadingPlan ? "Uploading..." : "Save files"}
            </Button>
          </div>
        )}
      </Modal>

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

      <Modal open={showGenModal} onOpenChange={setShowGenModal} title="Generate Inventory">
        <div className="space-y-3">
          <select className="w-full rounded-lg border p-2" value={genForm.towerId} onChange={(e) => setGenForm({ ...genForm, towerId: e.target.value })}>
            <option value="">Select Tower</option>
            {project.towers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>From Floor</Label><Input type="number" value={genForm.fromFloor} onChange={(e) => setGenForm({ ...genForm, fromFloor: +e.target.value })} /></div>
            <div><Label>To Floor</Label><Input type="number" value={genForm.toFloor} onChange={(e) => setGenForm({ ...genForm, toFloor: +e.target.value })} /></div>
          </div>
          <div>
            <Label>Units per Floor</Label>
            <Input type="number" value={genForm.unitsPerFloor} onChange={(e) => setGenForm({ ...genForm, unitsPerFloor: +e.target.value })} />
            <p className="mt-1 text-xs text-gray-500">
              For uneven floors (e.g. 1 flat on one floor and 3 on another), use Inventory → Manage after bulk generate.
            </p>
          </div>
          <select className="w-full rounded-lg border p-2" value={genForm.floorPlanTypeId} onChange={(e) => setGenForm({ ...genForm, floorPlanTypeId: e.target.value })}>
            <option value="">Floor Plan</option>
            {project.floorPlanTypes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="w-full rounded-lg border p-2" value={genForm.costSheetTemplateId} onChange={(e) => setGenForm({ ...genForm, costSheetTemplateId: e.target.value })}>
            <option value="">Cost Sheet</option>
            {project.costSheetTemplates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button className="w-full" onClick={generateInventory}>Generate</Button>
        </div>
      </Modal>

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
