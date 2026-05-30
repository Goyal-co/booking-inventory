"use client";

import { useState } from "react";
import { Button, Card, CardContent, Input, Label, Modal, FloorPlanViewer } from "@booking/ui";
import { toast } from "sonner";
import { uploadFloorPlanFile } from "@/lib/upload-floor-plan-client";
import { formatApiError } from "@/lib/format-api-error";

export interface FloorPlanTypeRow {
  id: string;
  name: string;
  bhkType: string;
  carpetArea: number;
  superArea: number | null;
  balconyArea: number | null;
  sizeType: string;
  imageUrl: string | null;
  pdfUrl: string | null;
  amenities: string[];
}

export type PlanFormState = {
  name: string;
  bhkType: string;
  carpetArea: number;
  superArea: number;
  balconyArea: number;
  sizeType: "SBA" | "CARPET";
  amenities: string;
};

export const emptyPlanForm: PlanFormState = {
  name: "",
  bhkType: "",
  carpetArea: 900,
  superArea: 1200,
  balconyArea: 80,
  sizeType: "SBA",
  amenities: "",
};

interface FloorPlanPanelProps {
  projectId: string;
  plans: FloorPlanTypeRow[];
  onRefresh: () => void;
}

interface PlanFormFieldsProps {
  form: PlanFormState;
  onChange: (form: PlanFormState) => void;
  pdfFile: File | null;
  onPdfChange: (file: File | null) => void;
  imageFile: File | null;
  onImageChange: (file: File | null) => void;
  uploading: boolean;
  isEdit?: boolean;
  onSubmit: () => void;
}

function PlanFormFields({
  form,
  onChange,
  pdfFile,
  onPdfChange,
  imageFile,
  onImageChange,
  uploading,
  isEdit,
  onSubmit,
}: PlanFormFieldsProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
      </div>
      <div>
        <Label>BHK Type</Label>
        <Input value={form.bhkType} onChange={(e) => onChange({ ...form, bhkType: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Super Built-up Area (sqft)</Label>
          <Input type="number" value={form.superArea} onChange={(e) => onChange({ ...form, superArea: +e.target.value })} />
        </div>
        <div>
          <Label>Carpet Area (sqft)</Label>
          <Input type="number" value={form.carpetArea} onChange={(e) => onChange({ ...form, carpetArea: +e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Balcony Area (sqft)</Label>
          <Input type="number" value={form.balconyArea} onChange={(e) => onChange({ ...form, balconyArea: +e.target.value })} />
        </div>
        <div>
          <Label>Size Type</Label>
          <select
            className="w-full rounded-lg border p-2"
            value={form.sizeType}
            onChange={(e) => onChange({ ...form, sizeType: e.target.value as "SBA" | "CARPET" })}
          >
            <option value="SBA">SBA</option>
            <option value="CARPET">Carpet</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Amenities (comma separated)</Label>
        <Input value={form.amenities} onChange={(e) => onChange({ ...form, amenities: e.target.value })} />
      </div>
      <div>
        <Label>Floor plan PDF</Label>
        <Input type="file" accept="application/pdf" className="mt-1" onChange={(e) => onPdfChange(e.target.files?.[0] ?? null)} />
      </div>
      <div>
        <Label>Floor plan image (JPEG/PNG)</Label>
        <Input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1" onChange={(e) => onImageChange(e.target.files?.[0] ?? null)} />
      </div>
      <Button className="w-full" disabled={uploading} onClick={onSubmit}>
        {uploading ? "Saving..." : isEdit ? "Save changes" : "Add floor plan"}
      </Button>
    </div>
  );
}

export function FloorPlanPanel({ projectId, plans, onRefresh }: FloorPlanPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [viewPlan, setViewPlan] = useState<FloorPlanTypeRow | null>(null);
  const [editPlan, setEditPlan] = useState<FloorPlanTypeRow | null>(null);
  const [form, setForm] = useState(emptyPlanForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setForm(emptyPlanForm);
    setPdfFile(null);
    setImageFile(null);
  };

  const openEdit = (plan: FloorPlanTypeRow) => {
    setEditPlan(plan);
    setForm({
      name: plan.name,
      bhkType: plan.bhkType,
      carpetArea: plan.carpetArea,
      superArea: plan.superArea ?? 1200,
      balconyArea: plan.balconyArea ?? 0,
      sizeType: (plan.sizeType as "SBA" | "CARPET") || "SBA",
      amenities: plan.amenities.join(", "),
    });
    setPdfFile(null);
    setImageFile(null);
  };

  const createPlan = async () => {
    if (!form.name || !form.bhkType || !form.superArea) {
      toast.error("Name, BHK type, and super built-up area are required");
      return;
    }
    setUploading(true);
    try {
      let pdfUrl = "";
      let imageUrl = "";
      if (pdfFile) pdfUrl = await uploadFloorPlanFile(pdfFile, "pdf");
      if (imageFile) imageUrl = await uploadFloorPlanFile(imageFile, "image");
      const res = await fetch(`/api/projects/${projectId}/floor-plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
          pdfUrl: pdfUrl || undefined,
          imageUrl: imageUrl || undefined,
          balconyArea: form.balconyArea || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Floor plan created");
        setShowCreate(false);
        resetForm();
        onRefresh();
      } else {
        toast.error(formatApiError(data.error, "Failed to create floor plan"));
      }
    } finally {
      setUploading(false);
    }
  };

  const saveEdit = async () => {
    if (!editPlan) return;
    setUploading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        bhkType: form.bhkType,
        carpetArea: form.carpetArea,
        superArea: form.superArea,
        balconyArea: form.balconyArea || undefined,
        sizeType: form.sizeType,
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (pdfFile) payload.pdfUrl = await uploadFloorPlanFile(pdfFile, "pdf");
      if (imageFile) payload.imageUrl = await uploadFloorPlanFile(imageFile, "image");
      const res = await fetch(`/api/projects/${projectId}/floor-plans/${editPlan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Floor plan updated");
        setEditPlan(null);
        resetForm();
        onRefresh();
      } else {
        toast.error(formatApiError(data.error, "Failed to update floor plan"));
      }
    } finally {
      setUploading(false);
    }
  };

  const deletePlan = async (plan: FloorPlanTypeRow) => {
    if (!confirm(`Delete floor plan "${plan.name}"?`)) return;
    const res = await fetch(`/api/projects/${projectId}/floor-plans/${plan.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Floor plan deleted");
      onRefresh();
    } else {
      toast.error(formatApiError(data.error, "Cannot delete floor plan"));
    }
  };

  const formFieldsProps = {
    form,
    onChange: setForm,
    pdfFile,
    onPdfChange: setPdfFile,
    imageFile,
    onImageChange: setImageFile,
    uploading,
  };

  return (
    <div>
      <div className="mb-4 flex justify-between">
        <h2 className="text-lg font-semibold">Floor Plan Types</h2>
        <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>Add Floor Plan</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-500">
                  {p.bhkType} · SBA {p.superArea ?? "—"} · Carpet {p.carpetArea} sqft
                  {p.balconyArea ? ` · Balcony ${p.balconyArea}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {p.pdfUrl && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">PDF</span>}
                {p.imageUrl && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Image</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewPlan(p)}>View</Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => deletePlan(p)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-gray-500">No floor plans yet.</p>}
      </div>

      <Modal open={showCreate} onOpenChange={setShowCreate} title="Add Floor Plan Type">
        <PlanFormFields {...formFieldsProps} onSubmit={createPlan} />
      </Modal>

      <Modal open={!!editPlan} onOpenChange={(o) => !o && setEditPlan(null)} title={`Edit — ${editPlan?.name ?? ""}`}>
        <PlanFormFields {...formFieldsProps} isEdit onSubmit={saveEdit} />
      </Modal>

      <Modal open={!!viewPlan} onOpenChange={(o) => !o && setViewPlan(null)} title={viewPlan?.name ?? "Floor plan"}>
        {viewPlan && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-gray-500">BHK</dt><dd>{viewPlan.bhkType}</dd>
              <dt className="text-gray-500">Super area</dt><dd>{viewPlan.superArea ?? "—"} sqft</dd>
              <dt className="text-gray-500">Carpet</dt><dd>{viewPlan.carpetArea} sqft</dd>
              <dt className="text-gray-500">Balcony</dt><dd>{viewPlan.balconyArea ?? "—"} sqft</dd>
            </dl>
            <FloorPlanViewer
              imageUrl={viewPlan.imageUrl}
              pdfUrl={viewPlan.pdfUrl}
              name={viewPlan.name}
              bhkType={viewPlan.bhkType}
              carpetArea={viewPlan.carpetArea}
              amenities={viewPlan.amenities}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
