"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Label, Modal, PageHeader } from "@booking/ui";
import { toast, Toaster } from "sonner";

type DirectLead = {
  id: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  goyalCrmId?: string | null;
  goyalLeadCode?: string | null;
  intentType?: string | null;
  siteVisitStatus: string;
  updatedAt: string;
};

const emptyKyc = {
  bookedDate: new Date().toISOString().slice(0, 10),
  dateOfBirth: "",
  maritalStatus: "",
  nationality: "Indian",
  communicationAddress: "",
  permanentAddress: "",
  occupation: "",
  organizationName: "",
  designation: "",
  sourceOfFund: "",
  sourceOfEnquiry: "Direct Booking",
};

export function DirectBookingPage() {
  const [leads, setLeads] = useState<DirectLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [canPushCrm, setCanPushCrm] = useState(false);
  const [bookLead, setBookLead] = useState<DirectLead | null>(null);
  const [kyc, setKyc] = useState(emptyKyc);

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
      setCanPushCrm(Boolean(d.capabilities?.staffApi || d.capabilities?.canBook));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markSiteVisit = async (lead: DirectLead) => {
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/direct-leads/${lead.id}/site-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Site visit done — Direct Booking" }),
      });
      const d = await res.json();
      if (!res.ok && !d.lead) {
        toast.error(typeof d.error === "string" ? d.error : "Update failed");
        return;
      }
      if (d.crmSynced) toast.success("Site visit marked — CRM updated");
      else toast.message("Saved locally", { description: d.crmError || "CRM not synced" });
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const submitBook = async () => {
    if (!bookLead) return;
    setBusyId(bookLead.id);
    try {
      const res = await fetch(`/api/direct-leads/${bookLead.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kyc),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : d.crmError || "Book failed");
        return;
      }
      toast.success("Lead marked booked in CRM");
      setBookLead(null);
      setKyc(emptyKyc);
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const isBooked = (l: DirectLead) => (l.intentType ?? "").includes("|booked");

  return (
    <div className="p-4 md:p-6">
      <Toaster richColors />
      <PageHeader
        title="Direct Booking"
        description="Leads assigned to you from reception (Goyal CRM). Mark site visit or booked without the inventory booking form."
      />

      {!canPushCrm && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          CRM push needs <code className="rounded bg-amber-100 px-1">GOYAL_CRM_API_TOKEN</code> on
          the sales service. Local status still updates when you act.
        </div>
      )}

      <div className="mb-3 flex justify-end">
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">CRM</th>
              <th className="px-4 py-3">Visit</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  No CRM leads assigned to you yet. Reception assigns them from EOI Leads.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{l.customerName}</p>
                  <p className="text-xs text-gray-500">{l.leadId}</p>
                </td>
                <td className="px-4 py-3">{l.customerPhone}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {l.goyalLeadCode || l.goyalCrmId?.slice(0, 8) || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-600">{l.siteVisitStatus}</span>
                  {isBooked(l) ? (
                    <span className="ml-2 inline-flex rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-600">
                      Booked
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {l.siteVisitStatus !== "COMPLETED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === l.id}
                        onClick={() => void markSiteVisit(l)}
                      >
                        Site visit done
                      </Button>
                    )}
                    {!isBooked(l) && (
                      <Button
                        size="sm"
                        disabled={busyId === l.id}
                        onClick={() => {
                          setBookLead(l);
                          setKyc(emptyKyc);
                        }}
                      >
                        Mark booked
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={Boolean(bookLead)}
        onOpenChange={(open) => !open && setBookLead(null)}
        title="Mark booked in CRM"
        description="Pushes to Goyal CRM without the inventory booking form. KYC is required for EOI leads."
        className="sm:max-w-xl"
      >
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2">
          {(
            [
              ["bookedDate", "Booked date", "date"],
              ["dateOfBirth", "Date of birth *", "date"],
              ["maritalStatus", "Marital status *", "text"],
              ["nationality", "Nationality *", "text"],
              ["occupation", "Occupation *", "text"],
              ["organizationName", "Organization *", "text"],
              ["designation", "Designation *", "text"],
              ["sourceOfFund", "Source of fund *", "text"],
              ["sourceOfEnquiry", "Source of enquiry *", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                type={type}
                value={kyc[key]}
                onChange={(e) => setKyc({ ...kyc, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Communication address *</Label>
            <Input
              value={kyc.communicationAddress}
              onChange={(e) => setKyc({ ...kyc, communicationAddress: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Permanent address *</Label>
            <Input
              value={kyc.permanentAddress}
              onChange={(e) => setKyc({ ...kyc, permanentAddress: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBookLead(null)}>
            Cancel
          </Button>
          <Button disabled={busyId === bookLead?.id} onClick={() => void submitBook()}>
            {busyId === bookLead?.id ? "Saving…" : "Push booked to CRM"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
