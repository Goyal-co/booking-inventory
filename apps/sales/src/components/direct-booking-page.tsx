"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, PageHeader } from "@booking/ui";
import { toast, Toaster } from "sonner";

type VisitHistoryRow = {
  id: string;
  status: string;
  checkedInAt: string;
  projectName?: string | null;
  visitingCpName?: string | null;
  salesUserName?: string | null;
};

type DirectLead = {
  id: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  source?: string;
  intentType?: string | null;
  siteVisitStatus: string;
  siteVisitDone?: boolean;
  isBooked?: boolean;
  currentProjectName?: string | null;
  visitHistory?: VisitHistoryRow[];
  isPresales?: boolean;
  project?: { id: string; name: string } | null;
  visitingCp?: {
    partnerName: string;
    cpId?: string;
  } | null;
  cpId?: string | null;
};

export function DirectBookingPage() {
  const [leads, setLeads] = useState<DirectLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/direct-leads");
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error ?? "Failed to load assigned leads");
        return;
      }
      setLeads(d.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayProject = (l: DirectLead) =>
    l.currentProjectName || l.project?.name || null;

  const isBooked = (l: DirectLead) =>
    Boolean(l.isBooked) || (l.intentType ?? "").includes("|booked");

  return (
    <div className="p-4 md:p-6">
      <Toaster richColors />
      <PageHeader
        title="Assigned Leads"
        description="Leads checked in by reception. Site visit is marked done in CRM and EOI Partner Portal at assignment. Use Live Booking to block a unit and send the customer the digital booking form — booking is confirmed in CRM and EOI after admin approval."
      />

      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Site visit is completed when reception assigns you a lead. To book a unit, go to{" "}
        <strong>Live Booking</strong>, block the unit, enter customer details, and the system
        emails them a secure booking form link.
      </div>

      <div className="mb-3 flex justify-end">
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">CP</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-gray-500">
                  No leads assigned to you yet. Reception assigns them after check-in.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    {l.customerName}
                    {l.isPresales || l.source === "PRESALES" ? (
                      <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                        Presales
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">{l.leadId}</p>
                  <p className="text-xs text-gray-600">{l.customerPhone}</p>
                  {l.customerEmail ? (
                    <p className="text-xs text-gray-500">{l.customerEmail}</p>
                  ) : null}
                  {displayProject(l) ? (
                    <p className="text-xs font-medium text-brand-600">{displayProject(l)}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {l.visitingCp
                    ? `${l.visitingCp.partnerName}${
                        l.visitingCp.cpId ? ` (${l.visitingCp.cpId})` : ""
                      }`
                    : l.cpId || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex w-fit rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      Site visit done
                    </span>
                    {isBooked(l) ? (
                      <span className="inline-flex w-fit rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-600">
                        Unit booked
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">
                        Pending unit booking (Live Booking → admin approval)
                      </span>
                    )}
                    {(l.visitHistory?.length ?? 0) > 0 ? (
                      <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer">
                          Visit history ({l.visitHistory?.length})
                        </summary>
                        <ul className="mt-1 space-y-1 pl-2">
                          {l.visitHistory?.map((v) => (
                            <li key={v.id}>
                              {v.projectName || "—"} · {v.status} ·{" "}
                              {new Date(v.checkedInAt).toLocaleDateString()}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
