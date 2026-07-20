"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@booking/ui";
import { toast } from "sonner";

interface ScheduleRow {
  id?: string;
  stageName: string;
  stageType: "FIXED" | "PERCENTAGE" | "FORMULA";
  percentage?: number | null;
  fixedAmount?: number | null;
  formulaKey?: string | null;
  sortOrder?: number;
}

interface ChargeRow {
  id?: string;
  name: string;
  calcMode: "FIXED" | "RATE_PER_AREA";
  amount?: number | null;
  rate?: number | null;
  areaField?: string | null;
  months?: number | null;
  sortOrder?: number;
}

interface UnitMasterRow {
  id?: string;
  tower: string;
  unitNo: string;
  floor: number | string;
  configuration: string;
  saleableAreaSqft: number | string;
  saleableAreaSqm?: number | string | null;
  carpetAreaSqft?: number | string | null;
  carpetAreaSqm?: number | string | null;
  balconyAreaSqft?: number | string | null;
  balconyAreaSqm?: number | string | null;
}

const emptyUnitRow = (): UnitMasterRow => ({
  tower: "",
  unitNo: "",
  floor: "",
  configuration: "",
  saleableAreaSqft: "",
  saleableAreaSqm: "",
  carpetAreaSqft: "",
  carpetAreaSqm: "",
  balconyAreaSqft: "",
  balconyAreaSqm: "",
});

export function ProjectCostConfigPanel({ projectId }: { projectId: string }) {
  const [projectName, setProjectName] = useState("");
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [defaultPrice, setDefaultPrice] = useState("");
  const [gstPercent, setGstPercent] = useState("5");
  const [brochureUrl, setBrochureUrl] = useState("");
  const [unitMaster, setUnitMaster] = useState<UnitMasterRow[]>([]);
  const [unitDraft, setUnitDraft] = useState<UnitMasterRow>(emptyUnitRow());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [schedRes, chargeRes, defaultsRes, masterRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/payment-schedules`),
      fetch(`/api/projects/${projectId}/other-charges`),
      fetch(`/api/projects/${projectId}/pricing-defaults`),
      fetch(`/api/projects/${projectId}/unit-master`),
    ]);
    const [schedData, chargeData, defaultsData, masterData] = await Promise.all([
      schedRes.json().catch(() => ({})),
      chargeRes.json().catch(() => ({})),
      defaultsRes.json().catch(() => ({})),
      masterRes.json().catch(() => ({})),
    ]);
    setSchedules(schedData.schedules ?? []);
    setCharges(chargeData.charges ?? []);
    setDefaultPrice(
      defaultsData.defaults?.defaultSaleablePricePerSqft != null
        ? String(defaultsData.defaults.defaultSaleablePricePerSqft)
        : ""
    );
    setGstPercent(
      defaultsData.defaults?.gstPercent != null ? String(defaultsData.defaults.gstPercent) : "5"
    );
    setBrochureUrl(defaultsData.defaults?.brochureUrl ?? "");
    setProjectName(defaultsData.defaults?.projectName ?? "");
    setUnitMaster(masterData.rows ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveSchedule = async (row: ScheduleRow) => {
    if (!row.stageName.trim()) {
      toast.error("Stage name is required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/payment-schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...row,
        percentage: row.percentage === null || row.percentage === undefined ? undefined : Number(row.percentage),
        fixedAmount:
          row.fixedAmount === null || row.fixedAmount === undefined ? undefined : Number(row.fixedAmount),
        sortOrder: row.sortOrder ?? 0,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save payment schedule");
      return;
    }
    toast.success("Payment schedule saved");
    load();
  };

  const deleteSchedule = async (scheduleId?: string) => {
    if (!scheduleId) {
      setSchedules((rows) => rows.filter((r) => r.id));
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/payment-schedules?scheduleId=${encodeURIComponent(scheduleId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete payment stage");
      return;
    }
    toast.success("Payment stage deleted");
    load();
  };

  const saveCharge = async (row: ChargeRow) => {
    if (!row.name.trim()) {
      toast.error("Charge name is required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/other-charges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...row,
        amount: row.amount === null || row.amount === undefined ? undefined : Number(row.amount),
        rate: row.rate === null || row.rate === undefined ? undefined : Number(row.rate),
        months: row.months === null || row.months === undefined ? undefined : Number(row.months),
        sortOrder: row.sortOrder ?? 0,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save charge");
      return;
    }
    toast.success("Other charge saved");
    load();
  };

  const deleteCharge = async (chargeId?: string) => {
    if (!chargeId) {
      setCharges((rows) => rows.filter((r) => r.id));
      return;
    }
    const res = await fetch(
      `/api/projects/${projectId}/other-charges?chargeId=${encodeURIComponent(chargeId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete charge");
      return;
    }
    toast.success("Other charge deleted");
    load();
  };

  const saveDefaults = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/pricing-defaults`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultSaleablePricePerSqft: defaultPrice ? Number(defaultPrice) : null,
        gstPercent: gstPercent ? Number(gstPercent) : 5,
        brochureUrl,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data.error === "string" ? data.error : "Failed to save pricing defaults");
      return;
    }
    toast.success("Pricing defaults saved");
    load();
  };

  const saveUnitRow = async () => {
    if (!unitDraft.tower || !unitDraft.unitNo || unitDraft.floor === "" || !unitDraft.saleableAreaSqft) {
      toast.error("Tower, Unit No, Floor and Saleable Area are required");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/unit-master`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tower: String(unitDraft.tower),
        unitNo: String(unitDraft.unitNo),
        floor: Number(unitDraft.floor),
        configuration: String(unitDraft.configuration || ""),
        saleableAreaSqft: Number(unitDraft.saleableAreaSqft),
        saleableAreaSqm: unitDraft.saleableAreaSqm ? Number(unitDraft.saleableAreaSqm) : null,
        carpetAreaSqft: unitDraft.carpetAreaSqft ? Number(unitDraft.carpetAreaSqft) : null,
        carpetAreaSqm: unitDraft.carpetAreaSqm ? Number(unitDraft.carpetAreaSqm) : null,
        balconyAreaSqft: unitDraft.balconyAreaSqft ? Number(unitDraft.balconyAreaSqft) : null,
        balconyAreaSqm: unitDraft.balconyAreaSqm ? Number(unitDraft.balconyAreaSqm) : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save unit master row");
      return;
    }
    toast.success("Unit master row saved");
    setUnitDraft(emptyUnitRow());
    load();
  };

  const deleteUnitRow = async (rowId: string) => {
    const res = await fetch(
      `/api/projects/${projectId}/unit-master?rowId=${encodeURIComponent(rowId)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      toast.error("Failed to delete unit master row");
      return;
    }
    toast.success("Unit master row deleted");
    load();
  };

  const importUnitMaster = async (file: File) => {
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0]?.split(",").map((h) => h.trim()) ?? [];
    const rows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      return row;
    });
    const res = await fetch(`/api/projects/${projectId}/unit-master/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      toast.error("Unit master import failed");
      return;
    }
    const data = await res.json().catch(() => ({}));
    toast.success(`Imported ${data.imported ?? rows.length} unit master rows`);
    load();
  };

  const seedTemplates = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/cost-config/seed`, { method: "POST" });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Failed to seed templates");
      return;
    }
    toast.success(`Seeded ${data.schedules} payment stages and ${data.charges} other charges`);
    load();
  };

  if (loading) return <p className="text-sm text-gray-500">Loading cost configuration…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <h2 className="font-semibold text-navy-700">
          Cost Sheet Config{projectName ? ` — ${projectName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure all cost sheet fields for this project: default ₹/sq.ft, GST, payment milestones,
          other charges, and unit inventory master data used by Sales and the customer booking form.
        </p>
        <div className="mt-3">
          <Button variant="outline" size="sm" disabled={saving} onClick={seedTemplates}>
            Seed sample payment + other charge templates
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Pricing Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Default saleable price / sq.ft (Rs.)</Label>
            <Input
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(e.target.value)}
              type="number"
              placeholder="e.g. 11701"
            />
          </div>
          <div>
            <Label>GST % on Basic Sale Value</Label>
            <Input
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              type="number"
              placeholder="5"
            />
          </div>
          <div>
            <Label>Brochure URL</Label>
            <Input
              value={brochureUrl}
              onChange={(e) => setBrochureUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="md:col-span-3">
            <Button onClick={saveDefaults} disabled={saving}>
              Save pricing defaults
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>2. Payment Schedule (on Basic Sale Value with GST — A)</CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Configure milestones with Fixed amount, Percentage of (A), or Formula (Balance Booking).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSchedules((s) => [
                ...s,
                {
                  stageName: "",
                  stageType: "PERCENTAGE",
                  percentage: 5,
                  sortOrder: s.length,
                },
              ])
            }
          >
            Add stage
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {schedules.length === 0 && (
            <p className="text-sm text-gray-400">No payment stages yet. Add stages or seed sample templates.</p>
          )}
          {schedules.map((row, i) => (
            <div key={row.id ?? `new-sched-${i}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label>Milestone description</Label>
                <Input
                  placeholder="e.g. On Completion of Ground Floor Slab"
                  value={row.stageName}
                  onChange={(e) => {
                    const next = [...schedules];
                    next[i] = { ...row, stageName: e.target.value };
                    setSchedules(next);
                  }}
                />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  className="w-full rounded border p-2 text-sm"
                  value={row.stageType}
                  onChange={(e) => {
                    const next = [...schedules];
                    next[i] = { ...row, stageType: e.target.value as ScheduleRow["stageType"] };
                    setSchedules(next);
                  }}
                >
                  <option value="FIXED">Fixed amount</option>
                  <option value="PERCENTAGE">Percentage of (A)</option>
                  <option value="FORMULA">Formula</option>
                </select>
              </div>
              {row.stageType === "PERCENTAGE" && (
                <div>
                  <Label>Percentage (%)</Label>
                  <Input
                    type="number"
                    value={row.percentage ?? ""}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[i] = { ...row, percentage: Number(e.target.value) };
                      setSchedules(next);
                    }}
                  />
                </div>
              )}
              {row.stageType === "FIXED" && (
                <div>
                  <Label>Fixed amount (Rs.)</Label>
                  <Input
                    type="number"
                    value={row.fixedAmount ?? ""}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[i] = { ...row, fixedAmount: Number(e.target.value) };
                      setSchedules(next);
                    }}
                  />
                </div>
              )}
              {row.stageType === "FORMULA" && (
                <div>
                  <Label>Formula key</Label>
                  <select
                    className="w-full rounded border p-2 text-sm"
                    value={row.formulaKey ?? "BALANCE_BOOKING"}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[i] = { ...row, formulaKey: e.target.value };
                      setSchedules(next);
                    }}
                  >
                    <option value="BALANCE_BOOKING">BALANCE_BOOKING (10% − READ)</option>
                  </select>
                </div>
              )}
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={row.sortOrder ?? i}
                  onChange={(e) => {
                    const next = [...schedules];
                    next[i] = { ...row, sortOrder: Number(e.target.value) };
                    setSchedules(next);
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" disabled={saving} onClick={() => saveSchedule(row)}>
                  Save
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteSchedule(row.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>3. Other Cost Charges &amp; Expenses (B)</CardTitle>
            <p className="mt-1 text-xs text-gray-500">
              Fixed amounts or rate × area × months (e.g. maintenance = ₹5 × saleable sq.ft × 24).
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setCharges((c) => [
                ...c,
                { name: "", calcMode: "FIXED", amount: 0, sortOrder: c.length },
              ])
            }
          >
            Add charge
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {charges.length === 0 && (
            <p className="text-sm text-gray-400">No other charges yet. Add charges or seed sample templates.</p>
          )}
          {charges.map((row, i) => (
            <div key={row.id ?? `charge-${i}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <Label>Charge name</Label>
                <Input
                  placeholder="e.g. Clubhouse Charges"
                  value={row.name}
                  onChange={(e) => {
                    const next = [...charges];
                    next[i] = { ...row, name: e.target.value };
                    setCharges(next);
                  }}
                />
              </div>
              <div>
                <Label>Calc mode</Label>
                <select
                  className="w-full rounded border p-2 text-sm"
                  value={row.calcMode}
                  onChange={(e) => {
                    const next = [...charges];
                    next[i] = { ...row, calcMode: e.target.value as ChargeRow["calcMode"] };
                    setCharges(next);
                  }}
                >
                  <option value="FIXED">Fixed amount</option>
                  <option value="RATE_PER_AREA">Rate × area × months</option>
                </select>
              </div>
              {row.calcMode === "FIXED" ? (
                <div>
                  <Label>Amount (Rs.)</Label>
                  <Input
                    type="number"
                    value={row.amount ?? ""}
                    onChange={(e) => {
                      const next = [...charges];
                      next[i] = { ...row, amount: Number(e.target.value) };
                      setCharges(next);
                    }}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <Label>Rate (Rs.)</Label>
                    <Input
                      type="number"
                      value={row.rate ?? ""}
                      onChange={(e) => {
                        const next = [...charges];
                        next[i] = { ...row, rate: Number(e.target.value) };
                        setCharges(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Area field</Label>
                    <select
                      className="w-full rounded border p-2 text-sm"
                      value={row.areaField ?? "saleable"}
                      onChange={(e) => {
                        const next = [...charges];
                        next[i] = { ...row, areaField: e.target.value };
                        setCharges(next);
                      }}
                    >
                      <option value="saleable">Saleable area</option>
                      <option value="carpet">Carpet area</option>
                      <option value="balcony">Balcony area</option>
                    </select>
                  </div>
                  <div>
                    <Label>Months</Label>
                    <Input
                      type="number"
                      value={row.months ?? ""}
                      onChange={(e) => {
                        const next = [...charges];
                        next[i] = {
                          ...row,
                          months: e.target.value === "" ? null : Number(e.target.value),
                        };
                        setCharges(next);
                      }}
                    />
                    <p className="mt-1 text-[11px] text-gray-500">
                      Required for maintenance (e.g. 24). Rate × area × months.
                    </p>
                  </div>
                </>
              )}
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={row.sortOrder ?? i}
                  onChange={(e) => {
                    const next = [...charges];
                    next[i] = { ...row, sortOrder: Number(e.target.value) };
                    setCharges(next);
                  }}
                />
              </div>
              <div className="flex items-end gap-2 md:col-span-2">
                <Button size="sm" disabled={saving} onClick={() => saveCharge(row)}>
                  Save
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => deleteCharge(row.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Unit Master Inventory ({unitMaster.length} flats)</CardTitle>
          <p className="mt-1 text-xs text-gray-500">
            Wing/Tower, Apartment No., Floor, Accommodation, Saleable/Carpet/Balcony areas (sq.ft + sq.m).
            These feed the cost sheet inventory section for each flat.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 rounded-lg border bg-gray-50 p-3 md:grid-cols-5">
            {(
              [
                ["tower", "Wing / Tower"],
                ["unitNo", "Apartment No."],
                ["floor", "Floor"],
                ["configuration", "Accommodation Type"],
                ["saleableAreaSqft", "Saleable Sq.ft"],
                ["saleableAreaSqm", "Saleable Sq.m"],
                ["carpetAreaSqft", "Carpet Sq.ft"],
                ["carpetAreaSqm", "Carpet Sq.m"],
                ["balconyAreaSqft", "Balcony Sq.ft"],
                ["balconyAreaSqm", "Balcony Sq.m"],
              ] as Array<[keyof UnitMasterRow, string]>
            ).map(([key, label]) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input
                  value={String(unitDraft[key] ?? "")}
                  onChange={(e) => setUnitDraft((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="flex items-end md:col-span-5">
              <Button onClick={saveUnitRow} disabled={saving}>
                Save unit master row
              </Button>
            </div>
          </div>

          <div>
            <Label>Import CSV</Label>
            <input
              type="file"
              accept=".csv"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importUnitMaster(file);
              }}
            />
            <p className="mt-2 text-xs text-gray-500">
              CSV columns: tower, unitNo, floor, configuration, saleableAreaSqft, saleableAreaSqm,
              carpetAreaSqft, carpetAreaSqm, balconyAreaSqft, balconyAreaSqm
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">Wing</th>
                  <th className="px-3 py-2">Apt No.</th>
                  <th className="px-3 py-2">Floor</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Saleable</th>
                  <th className="px-3 py-2">Carpet</th>
                  <th className="px-3 py-2">Balcony</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {unitMaster.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-gray-400">
                      No unit master rows yet
                    </td>
                  </tr>
                ) : (
                  unitMaster.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">{row.tower}</td>
                      <td className="px-3 py-2">{row.unitNo}</td>
                      <td className="px-3 py-2">{row.floor}</td>
                      <td className="px-3 py-2">{row.configuration || "—"}</td>
                      <td className="px-3 py-2">
                        {String(row.saleableAreaSqft)}
                        {row.saleableAreaSqm ? ` / ${row.saleableAreaSqm} m²` : ""}
                      </td>
                      <td className="px-3 py-2">
                        {row.carpetAreaSqft != null ? String(row.carpetAreaSqft) : "—"}
                        {row.carpetAreaSqm ? ` / ${row.carpetAreaSqm} m²` : ""}
                      </td>
                      <td className="px-3 py-2">
                        {row.balconyAreaSqft != null ? String(row.balconyAreaSqft) : "—"}
                        {row.balconyAreaSqm ? ` / ${row.balconyAreaSqm} m²` : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => row.id && deleteUnitRow(row.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
