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
  source?: string;
  goyalCrmId?: string | null;
  goyalLeadCode?: string | null;
  intentType?: string | null;
  siteVisitStatus: string;
  siteVisitDone?: boolean;
  isBooked?: boolean;
  updatedAt?: string;
  project?: { id: string; name: string } | null;
  visitingCp?: {
    partnerName: string;
    cpId?: string;
    fromToday?: boolean;
    checkedInAt?: string | null;
    salesUserName?: string | null;
  } | null;
  cpId?: string | null;
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

  const isBooked = (l: DirectLead) =>
    Boolean(l.isBooked) || (l.intentType ?? "").includes("|booked");
  const isVisitDone = (l: DirectLead) =>
    Boolean(l.siteVisitDone) || l.siteVisitStatus === "COMPLETED" || isBooked(l);

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
      if (d.crmSynced) toast.success("Site visit marked done");
      else toast.success("Site visit marked done", { description: d.crmError || "Saved locally" });
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
      toast.success("Marked booked (site visit + booking)", {
        description: d.crmSynced
          ? "CRM updated"
          : d.crmError || "Saved locally — CRM optional",
      });
      setBookLead(null);
      setKyc(emptyKyc);
      void load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <Toaster richColors />
      <PageHeader
        title="Direct Booking"
        description="Leads assigned to you from reception. Mark site visit done, or mark booked (counts as both site visit + booking)."
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
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">CP</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-gray-500">
                  No leads assigned to you yet. Reception assigns them from Walk-in / EOI desk.
                </td>
              </tr>
            )}
            {leads.map((l) => (
              <tr key={l.id} className="border-b last:border-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{l.customerName}</p>
                  <p className="text-xs text-gray-500">{l.leadId}</p>
                  <p className="text-xs text-gray-600">{l.customerPhone}</p>
                  {l.customerEmail ? (
                    <p className="text-xs text-gray-500">{l.customerEmail}</p>
                  ) : null}
                  {l.project?.name ? (
                    <p className="text-xs text-gray-500">{l.project.name}</p>
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
                    <span className="text-xs text-gray-600">
                      Visit: {isVisitDone(l) ? "Done" : l.siteVisitStatus}
                    </span>
                    {isBooked(l) ? (
                      <span className="inline-flex w-fit rounded-full bg-success-50 px-2 py-0.5 text-xs text-success-600">
                        Booked
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Not booked</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {!isVisitDone(l) && (
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
        onOpenChange={(open) => {
          if (!open) {
            setBookLead(null);
            setKyc(emptyKyc);
          }
        }}
        title="Mark as booked"
        description="This marks both site visit done and booking done. KYC fields help push to CRM when available."
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {bookLead?.customerName} · {bookLead?.customerPhone}
            {bookLead?.visitingCp ? ` · CP ${bookLead.visitingCp.partnerName}` : ""}
          </p>
          {(
            [
              ["bookedDate", "Booked date"],
              ["dateOfBirth", "Date of birth"],
              ["maritalStatus", "Marital status"],
              ["nationality", "Nationality"],
              ["communicationAddress", "Communication address"],
              ["permanentAddress", "Permanent address"],
              ["occupation", "Occupation"],
              ["organizationName", "Organization"],
              ["designation", "Designation"],
              ["sourceOfFund", "Source of fund"],
              ["sourceOfEnquiry", "Source of enquiry"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                value={kyc[key]}
                onChange={(e) => setKyc((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBookLead(null)}>
              Cancel
            </Button>
            <Button disabled={busyId === bookLead?.id} onClick={() => void submitBook()}>
              Confirm booked
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
