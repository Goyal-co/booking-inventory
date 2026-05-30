"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label, Modal, StatusBadge } from "@booking/ui";
import { toast } from "sonner";
import { formatApiError } from "@/lib/format-api-error";

type UnitStatus = "AVAILABLE" | "BLOCKED" | "BOOKED" | "SOLD" | "HOLD";

interface StructureUnit {
  id: string;
  unitNumber: string;
  status: UnitStatus;
  bhkType: string | null;
  facing: string | null;
  remarks: string | null;
  priceOverride: number | null;
  floorPlanTypeId: string | null;
  costSheetTemplateId: string | null;
  carpetArea: number | null;
  superArea: number | null;
}

interface StructureFloor {
  id: string;
  number: number;
  label: string | null;
  unitCount: number;
  units: StructureUnit[];
}

interface StructureTower {
  id: string;
  name: string;
  code: string;
  floors: StructureFloor[];
}

interface FloorPlanType {
  id: string;
  name: string;
  bhkType: string;
  carpetArea: number;
}

interface CostSheetTemplate {
  id: string;
  name: string;
  totalPrice: string;
  floorPlanTypeId: string | null;
}

interface InventoryStructure {
  floorPlanTypes: FloorPlanType[];
  costSheetTemplates: CostSheetTemplate[];
  towers: StructureTower[];
}

export type { InventoryStructure };

interface InventoryFloorListProps {
  projectId: string;
  onChanged: () => void;
  sharedStructure?: InventoryStructure | null;
  sharedLoading?: boolean;
}

interface UnitFormState {
  towerId: string;
  floorNumber: number;
  unitNumber: string;
  floorPlanTypeId: string;
  costSheetTemplateId: string;
  facing: string;
  remarks: string;
  priceOverride: string;
  status?: UnitStatus;
}

const EMPTY_FORM: UnitFormState = {
  towerId: "",
  floorNumber: 1,
  unitNumber: "",
  floorPlanTypeId: "",
  costSheetTemplateId: "",
  facing: "",
  remarks: "",
  priceOverride: "",
};

function suggestNextUnitNumber(
  towerCode: string,
  floorNumber: number,
  units: { unitNumber: string }[]
) {
  const prefix = `${towerCode}-${floorNumber}`;
  let maxIndex = 0;
  for (const u of units) {
    const match = u.unitNumber.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`));
    if (match) maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
  }
  return `${prefix}${String(maxIndex + 1).padStart(2, "0")}`;
}

function isUnitDeleteDisabled(status: UnitStatus): boolean {
  return status === "BOOKED" || status === "SOLD" || status === "BLOCKED";
}

function isStatusLocked(status: UnitStatus): boolean {
  return status === "BOOKED" || status === "SOLD";
}

function editModalDescription(unit: StructureUnit | null): string {
  if (!unit) return "Add a unit to a specific floor. Floor is created automatically if it does not exist.";
  if (isStatusLocked(unit.status)) {
    return "This unit is tied to a booking or sale. Status and unit number cannot be changed here.";
  }
  if (unit.status === "BLOCKED") {
    return "This unit has an active block. Use Grid → Mass Unblock to release it, or change status carefully.";
  }
  if (unit.status === "HOLD") {
    return "This unit is on hold. You can update metadata or change status below.";
  }
  return "Update unit details. Status changes apply immediately.";
}

function StatusWarningBanner({ status }: { status: UnitStatus }) {
  if (status === "AVAILABLE") return null;

  const styles: Record<Exclude<UnitStatus, "AVAILABLE">, { className: string; message: string }> = {
    HOLD: {
      className: "border-blue-200 bg-blue-50 text-blue-800",
      message: "This unit is on hold. Status can be changed, but verify before releasing.",
    },
    BLOCKED: {
      className: "border-amber-200 bg-amber-50 text-amber-800",
      message:
        "This unit has an active block. Prefer Grid → Mass Unblock to release it safely.",
    },
    BOOKED: {
      className: "border-red-200 bg-red-50 text-red-800",
      message:
        "This unit is booked. Do not change status manually — use the Bookings page to manage the booking.",
    },
    SOLD: {
      className: "border-red-200 bg-red-50 text-red-800",
      message:
        "This unit is sold. Status and unit number are locked. Only metadata fields can be updated.",
    },
  };

  const { className, message } = styles[status];
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${className}`}>{message}</div>
  );
}

export function InventoryFloorList({
  projectId,
  onChanged,
  sharedStructure,
  sharedLoading,
}: InventoryFloorListProps) {
  const usesSharedStructure = sharedStructure !== undefined;
  const [structure, setStructure] = useState<InventoryStructure | null>(
    sharedStructure ?? null
  );
  const [loading, setLoading] = useState(!usesSharedStructure);
  const [showForm, setShowForm] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<StructureUnit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<StructureUnit | null>(null);
  const [form, setForm] = useState<UnitFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/inventory-structure`);
    const data = await res.json();
    if (res.ok) {
      setStructure(data);
    } else {
      toast.error(data.error ?? "Failed to load inventory");
      setStructure(null);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (usesSharedStructure) {
      setStructure(sharedStructure ?? null);
      setLoading(sharedLoading ?? false);
      return;
    }
    load();
  }, [usesSharedStructure, sharedStructure, sharedLoading, load]);

  const openAdd = (tower: StructureTower, floor?: StructureFloor) => {
    const floorNumber = floor?.number ?? 1;
    const units = floor?.units ?? [];
    const defaultPlan = structure?.floorPlanTypes[0];
    const defaultCost =
      structure?.costSheetTemplates.find((c) => c.floorPlanTypeId === defaultPlan?.id) ??
      structure?.costSheetTemplates[0];
    setForm({
      ...EMPTY_FORM,
      towerId: tower.id,
      floorNumber,
      unitNumber: suggestNextUnitNumber(tower.code, floorNumber, units),
      floorPlanTypeId: defaultPlan?.id ?? "",
      costSheetTemplateId: defaultCost?.id ?? "",
    });
    setEditingUnitId(null);
    setEditingUnit(null);
    setShowForm(true);
  };

  const openEdit = (tower: StructureTower, floor: StructureFloor, unit: StructureUnit) => {
    setForm({
      towerId: tower.id,
      floorNumber: floor.number,
      unitNumber: unit.unitNumber,
      floorPlanTypeId: unit.floorPlanTypeId ?? "",
      costSheetTemplateId: unit.costSheetTemplateId ?? "",
      facing: unit.facing ?? "",
      remarks: unit.remarks ?? "",
      priceOverride: unit.priceOverride != null ? String(unit.priceOverride) : "",
      status: unit.status,
    });
    setEditingUnitId(unit.id);
    setEditingUnit(unit);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.unitNumber || !form.floorPlanTypeId || !form.costSheetTemplateId) {
      toast.error("Unit number, floor plan, and cost sheet are required");
      return;
    }
    setSubmitting(true);
    const payload = {
      unitNumber: form.unitNumber,
      floorPlanTypeId: form.floorPlanTypeId,
      costSheetTemplateId: form.costSheetTemplateId,
      facing: form.facing || undefined,
      remarks: form.remarks || undefined,
      priceOverride: form.priceOverride ? Number(form.priceOverride) : undefined,
    };

    const patchBody =
      editingUnitId && editingUnit && isStatusLocked(editingUnit.status)
        ? {
            floorPlanTypeId: payload.floorPlanTypeId,
            costSheetTemplateId: payload.costSheetTemplateId,
            facing: payload.facing,
            remarks: payload.remarks,
            priceOverride: payload.priceOverride,
          }
        : { ...payload, status: form.status };

    const res = editingUnitId
      ? await fetch(`/api/units/${editingUnitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        })
      : await fetch("/api/units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            towerId: form.towerId,
            floorNumber: form.floorNumber,
            ...payload,
          }),
        });

    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(editingUnitId ? "Unit updated" : "Unit added");
      setShowForm(false);
      setEditingUnit(null);
      load();
      onChanged();
    } else {
      toast.error(formatApiError(data.error, "Failed to save unit"));
    }
  };

  const handleDelete = async () => {
    if (!deletingUnit) return;
    setSubmitting(true);
    const res = await fetch(`/api/units/${deletingUnit.id}`, { method: "DELETE" });
    setSubmitting(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Unit deleted");
      setDeletingUnit(null);
      load();
      onChanged();
    } else {
      toast.error(formatApiError(data.error, "Cannot delete unit"));
    }
  };

  if (loading) {
    return <p className="text-gray-500">Loading inventory structure...</p>;
  }

  if (!structure || structure.towers.length === 0) {
    return (
      <p className="text-gray-500">
        No towers yet. Add towers in the project setup wizard, then return here to manage units
        per floor.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {structure.towers.map((tower) => (
        <div key={tower.id} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-gray-900">
              {tower.name}{" "}
              <span className="text-sm font-normal text-gray-500">({tower.code})</span>
            </h3>
            <Button size="sm" variant="outline" onClick={() => openAdd(tower)}>
              Add unit on new floor
            </Button>
          </div>

          {tower.floors.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No floors yet — add a unit to create one.</p>
          ) : (
            tower.floors.map((floor) => (
              <div key={floor.id} className="border-b border-gray-50 last:border-b-0">
                <div className="flex flex-col gap-2 bg-gray-50 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {floor.label ?? `Floor ${floor.number}`} · {floor.unitCount} unit
                    {floor.unitCount !== 1 ? "s" : ""}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openAdd(tower, floor)}>
                    Add unit
                  </Button>
                </div>
                {floor.units.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No units on this floor.</p>
                ) : (
                  <>
                    <div className="space-y-2 p-3 md:hidden">
                      {floor.units.map((unit) => (
                        <div
                          key={unit.id}
                          className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{unit.unitNumber}</p>
                              <p className="text-xs text-gray-500">
                                {unit.bhkType ?? "—"} · Carpet {unit.carpetArea ?? "—"} · SBA{" "}
                                {unit.superArea ?? "—"}
                              </p>
                            </div>
                            <StatusBadge status={unit.status} />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(tower, floor, unit)}
                            >
                              Edit
                            </Button>
                            {!isUnitDeleteDisabled(unit.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600"
                                onClick={() => setDeletingUnit(unit)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-left text-xs text-gray-500">
                            <th className="px-4 py-2 font-medium">Unit</th>
                            <th className="px-4 py-2 font-medium">Type</th>
                            <th className="px-4 py-2 font-medium">Carpet (sqft)</th>
                            <th className="px-4 py-2 font-medium">SBA (sqft)</th>
                            <th className="px-4 py-2 font-medium">Facing</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {floor.units.map((unit) => (
                            <tr key={unit.id} className="border-t border-gray-100">
                              <td className="px-4 py-2 font-medium">{unit.unitNumber}</td>
                              <td className="px-4 py-2 text-gray-600">{unit.bhkType ?? "—"}</td>
                              <td className="px-4 py-2 text-gray-600">{unit.carpetArea ?? "—"}</td>
                              <td className="px-4 py-2 text-gray-600">{unit.superArea ?? "—"}</td>
                              <td className="px-4 py-2 text-gray-600">{unit.facing ?? "—"}</td>
                              <td className="px-4 py-2">
                                <StatusBadge status={unit.status} />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEdit(tower, floor, unit)}
                                  >
                                    Edit
                                  </Button>
                                  {!isUnitDeleteDisabled(unit.status) && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600"
                                      onClick={() => setDeletingUnit(unit)}
                                    >
                                      Delete
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      ))}

      <Modal
        open={showForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowForm(false);
            setEditingUnit(null);
          }
        }}
        title={editingUnitId ? "Edit Unit" : "Add Unit"}
        description={editModalDescription(editingUnit)}
      >
        <div className="space-y-3">
          {editingUnit && <StatusWarningBanner status={editingUnit.status} />}
          {!editingUnitId && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Floor number</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={form.floorNumber}
                  onChange={(e) =>
                    setForm({ ...form, floorNumber: parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
              <div>
                <Label>Unit number</Label>
                <Input
                  className="mt-1"
                  value={form.unitNumber}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                  placeholder="A-101"
                />
              </div>
            </div>
          )}
          {editingUnitId && (
            <>
              <div>
                <Label>Unit number</Label>
                <Input
                  className="mt-1"
                  value={form.unitNumber}
                  disabled={editingUnit ? isStatusLocked(editingUnit.status) : false}
                  onChange={(e) => setForm({ ...form, unitNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                {editingUnit && isStatusLocked(editingUnit.status) ? (
                  <div className="mt-1">
                    <StatusBadge status={editingUnit.status} />
                  </div>
                ) : (
                  <select
                    className="mt-1 w-full rounded-lg border p-2 text-sm"
                    value={form.status ?? "AVAILABLE"}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as UnitStatus })
                    }
                  >
                    {(["AVAILABLE", "BLOCKED", "BOOKED", "SOLD", "HOLD"] as UnitStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      )
                    )}
                  </select>
                )}
              </div>
            </>
          )}
          <div>
            <Label>Floor plan</Label>
            <select
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              value={form.floorPlanTypeId}
              onChange={(e) => {
                const planId = e.target.value;
                const cost =
                  structure?.costSheetTemplates.find((c) => c.floorPlanTypeId === planId) ??
                  structure?.costSheetTemplates[0];
                setForm({
                  ...form,
                  floorPlanTypeId: planId,
                  costSheetTemplateId: cost?.id ?? form.costSheetTemplateId,
                });
              }}
            >
              <option value="">Select plan</option>
              {structure?.floorPlanTypes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.bhkType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Cost sheet</Label>
            <select
              className="mt-1 w-full rounded-lg border p-2 text-sm"
              value={form.costSheetTemplateId}
              onChange={(e) => setForm({ ...form, costSheetTemplateId: e.target.value })}
            >
              <option value="">Select cost sheet</option>
              {structure?.costSheetTemplates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Facing (optional)</Label>
            <Input
              className="mt-1"
              value={form.facing}
              onChange={(e) => setForm({ ...form, facing: e.target.value })}
              placeholder="East"
            />
          </div>
          <div>
            <Label>Remarks (optional)</Label>
            <Input
              className="mt-1"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>
          <div>
            <Label>Price override (optional)</Label>
            <Input
              type="number"
              className="mt-1"
              value={form.priceOverride}
              onChange={(e) => setForm({ ...form, priceOverride: e.target.value })}
            />
          </div>
          <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Saving..." : editingUnitId ? "Save changes" : "Add unit"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deletingUnit}
        onOpenChange={(open) => !open && setDeletingUnit(null)}
        title="Delete Unit"
      >
        {deletingUnit && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Permanently remove <strong>{deletingUnit.unitNumber}</strong>? This cannot be undone.
              Units that are blocked, booked, or sold cannot be deleted.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingUnit(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
                onClick={handleDelete}
              >
                {submitting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
