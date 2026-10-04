"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, PageHeader, Modal, Label } from "@booking/ui";
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
  salesFeedback?: string | null;
  salesFeedbackAt?: string | null;
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
  const [feedbackLead, setFeedbackLead] = useState<DirectLead | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);

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

  const openFeedback = (lead: DirectLead) => {
    setFeedbackLead(lead);
    setFeedbackText(lead.salesFeedback ?? "");
  };

  const saveFeedback = async () => {
    if (!feedbackLead) return;
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      toast.error("Enter feedback before saving");
      return;
    }
    setFeedbackBusy(true);
    try {
      const res = await fetch(`/api/direct-leads/${feedbackLead.id}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error ?? "Failed to save feedback");
        return;
      }
      toast.success("Feedback saved");
      setFeedbackLead(null);
      setFeedbackText("");
      await load();
    } finally {
      setFeedbackBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster richColors />
      <PageHeader
        title="Assigned Leads"
        description="Leads checked in by reception. Add feedback after your meeting. Use Live Booking to block a unit and send the customer the digital booking form."
      />

      <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        Site visit is completed when reception assigns you a lead. Capture meeting notes with{" "}
        <strong>Add feedback</strong>. To book a unit, go to <strong>Live Booking</strong>.
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
              <th className="px-4 py-3">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
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
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    {l.salesFeedback ? (
                      <p className="max-w-xs whitespace-pre-wrap text-xs text-gray-700">
                        {l.salesFeedback}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">No feedback yet</p>
                    )}
                    {l.salesFeedbackAt ? (
                      <p className="text-[11px] text-gray-400">
                        Updated {new Date(l.salesFeedbackAt).toLocaleString()}
                      </p>
                    ) : null}
                    <Button
                      variant="outline"
                      className="h-8 px-2 text-xs"
                      onClick={() => openFeedback(l)}
                    >
                      {l.salesFeedback ? "Edit feedback" : "Add feedback"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(feedbackLead)}
        onOpenChange={(open) => {
          if (!open) {
            setFeedbackLead(null);
            setFeedbackText("");
          }
        }}
        title={feedbackLead ? `Feedback · ${feedbackLead.customerName}` : "Feedback"}
        description="Notes from your meeting with this lead (visible on your Assigned Leads list)."
        className="sm:max-w-lg"
      >
        <div className="space-y-3">
          <div>
            <Label>Feedback</Label>
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value.slice(0, 4000))}
              placeholder="Interest level, budget, follow-up needed…"
            />
            <p className="mt-1 text-xs text-gray-400">{feedbackText.length}/4000</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFeedbackLead(null);
                setFeedbackText("");
              }}
            >
              Cancel
            </Button>
            <Button disabled={feedbackBusy || !feedbackText.trim()} onClick={() => void saveFeedback()}>
              {feedbackBusy ? "Saving…" : "Save feedback"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
