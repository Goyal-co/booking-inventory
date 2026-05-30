"use client";

import { useEffect, useState } from "react";
import { Button, Input, Label, Modal } from "@booking/ui";
import { toast } from "sonner";
import { formatApiError } from "@/lib/format-api-error";

interface TowerOption {
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
}

interface FloorPlanOption {
  id: string;
  name: string;
  bhkType: string;
  superArea: number | null;
}

interface CostSheetOption {
  id: string;
  name: string;
  floorPlanTypeId: string | null;
  totalPrice: string;
}

export interface StackRow {
  stackNumber: number;
  floorPlanTypeId: string;
  costSheetTemplateId: string;
  sizeType: "SBA" | "CARPET";
  activeFromFloor: number;
  activeToFloor: number;
}

interface UnitStackGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  towers: TowerOption[];
  floorPlans: FloorPlanOption[];
  costSheets: CostSheetOption[];
  onSuccess: () => void;
}

function defaultStack(n: number, from: number, to: number): StackRow {
  return {
    stackNumber: n,
    floorPlanTypeId: "",
    costSheetTemplateId: "",
    sizeType: "SBA",
    activeFromFloor: from,
    activeToFloor: to,
  };
}

export function UnitStackGenerator({
  open,
  onOpenChange,
  towers,
  floorPlans,
  costSheets,
  onSuccess,
}: UnitStackGeneratorProps) {
  const [towerId, setTowerId] = useState("");
  const [fromFloor, setFromFloor] = useState(1);
  const [toFloor, setToFloor] = useState(13);
  const [stacks, setStacks] = useState<StackRow[]>([defaultStack(1, 1, 13)]);
  const [saveTemplate, setSaveTemplate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const tower = towers.find((t) => t.id === towerId);
    if (tower?.unitStackTemplates?.length) {
      setStacks(
        tower.unitStackTemplates.map((s) => ({
          stackNumber: s.stackNumber,
          floorPlanTypeId: s.floorPlanTypeId,
          costSheetTemplateId: s.costSheetTemplateId,
          sizeType: (s.sizeType as "SBA" | "CARPET") || "SBA",
          activeFromFloor: s.activeFromFloor,
          activeToFloor: s.activeToFloor,
        }))
      );
    }
  }, [towerId, towers, open]);

  const selectedTower = towers.find((t) => t.id === towerId);
  const planForStack = (planId: string) => floorPlans.find((p) => p.id === planId);
  const sheetsForPlan = (planId: string) =>
    costSheets.filter((c) => !c.floorPlanTypeId || c.floorPlanTypeId === planId);

  const addStack = () => {
    const next = stacks.length > 0 ? Math.max(...stacks.map((s) => s.stackNumber)) + 1 : 1;
    setStacks([...stacks, defaultStack(next, fromFloor, toFloor)]);
  };

  const removeStack = (idx: number) => {
    setStacks(stacks.filter((_, i) => i !== idx));
  };

  const updateStack = (idx: number, patch: Partial<StackRow>) => {
    setStacks(stacks.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const generate = async () => {
    if (!towerId) {
      toast.error("Select a tower");
      return;
    }
    if (stacks.some((s) => !s.floorPlanTypeId || !s.costSheetTemplateId)) {
      toast.error("Each stack needs a floor plan and cost sheet");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "generate",
          towerId,
          fromFloor,
          toFloor,
          stacks,
          saveTemplate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Created ${data.created}, updated ${data.updated}, skipped ${data.skipped}`);
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(formatApiError(data.error, "Generation failed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Generate Inventory — Unit Stacks">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <div>
          <Label>1. Select Tower</Label>
          <select className="mt-1 w-full rounded-lg border p-2" value={towerId} onChange={(e) => setTowerId(e.target.value)}>
            <option value="">Choose tower...</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>2. From Floor</Label>
            <Input type="number" min={1} value={fromFloor} onChange={(e) => setFromFloor(+e.target.value)} />
          </div>
          <div>
            <Label>To Floor</Label>
            <Input type="number" min={1} value={toFloor} onChange={(e) => setToFloor(+e.target.value)} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>3. Unit Stack Setup</Label>
            <Button type="button" size="sm" variant="outline" onClick={addStack}>Add stack</Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left">Stack</th>
                  <th className="px-2 py-2 text-left">Config</th>
                  <th className="px-2 py-2 text-left">Size</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Cost Sheet</th>
                  <th className="px-2 py-2 text-left">From</th>
                  <th className="px-2 py-2 text-left">To</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {stacks.map((stack, idx) => {
                  const plan = planForStack(stack.floorPlanTypeId);
                  return (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-2 font-mono">{String(stack.stackNumber).padStart(2, "0")}</td>
                      <td className="px-2 py-2">
                        <select
                          className="w-full rounded border p-1"
                          value={stack.floorPlanTypeId}
                          onChange={(e) => {
                            const planId = e.target.value;
                            const sheets = sheetsForPlan(planId);
                            updateStack(idx, {
                              floorPlanTypeId: planId,
                              costSheetTemplateId: sheets[0]?.id ?? "",
                            });
                          }}
                        >
                          <option value="">Select...</option>
                          {floorPlans.map((p) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.bhkType})</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-gray-600">{plan?.superArea ?? "—"}</td>
                      <td className="px-2 py-2">
                        <select className="w-full rounded border p-1" value={stack.sizeType} onChange={(e) => updateStack(idx, { sizeType: e.target.value as "SBA" | "CARPET" })}>
                          <option value="SBA">SBA</option>
                          <option value="CARPET">Carpet</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select className="w-full rounded border p-1" value={stack.costSheetTemplateId} onChange={(e) => updateStack(idx, { costSheetTemplateId: e.target.value })}>
                          <option value="">Select...</option>
                          {sheetsForPlan(stack.floorPlanTypeId).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" className="h-8 w-16" value={stack.activeFromFloor} onChange={(e) => updateStack(idx, { activeFromFloor: +e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" className="h-8 w-16" value={stack.activeToFloor} onChange={(e) => updateStack(idx, { activeToFloor: +e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        {stacks.length > 1 && (
                          <button type="button" className="text-xs text-red-600" onClick={() => removeStack(idx)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saveTemplate} onChange={(e) => setSaveTemplate(e.target.checked)} />
          Save as tower template for next time
        </label>

        {selectedTower && (
          <p className="text-xs text-gray-500">
            Units will be numbered like {selectedTower.code}-{fromFloor}-01 (tower-floor-stack).
          </p>
        )}

        <Button className="w-full" disabled={submitting} onClick={generate}>
          {submitting ? "Generating..." : "Generate inventory"}
        </Button>
      </div>
    </Modal>
  );
}
