"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  Button,
  Input,
  Label,
  Modal,
  SegmentedTabs,
} from "@booking/ui";
import { toast, Toaster } from "sonner";

interface LocalLead {
  id: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  source: string;
  cpId?: string | null;
  titanCrmId?: string | null;
  createdAt?: string;
  project?: { name: string } | null;
  assignedSales?: { id: string; name: string } | null;
}

interface PartnerOption {
  leadId: string | null;
  publicLeadId: string;
  cpId: string;
  partnerName: string;
  submittedAt: string;
  source: string;
  tag?: string;
}

type SearchScenario =
  | "found_single"
  | "found_multi_partner"
  | "titan_needs_partner"
  | "not_found"
  | "empty_query";


interface Visit {
  id: string;
  checkedInAt: string;
  lead?: { leadId: string; customerName: string; customerPhone: string } | null;
  salesUser?: { name: string } | null;
}

interface EoiLead {
  id: string;
  leadCode?: string;
  fullName?: string;
  phone?: string;
  email?: string | null;
  projectName?: string | null;
  city?: string | null;
  booked?: boolean;
  bookedDate?: string | null;
  source?: string;
  dateOfBirth?: string | null;
  maritalStatus?: string | null;
  nationality?: string | null;
  communicationAddress?: string | null;
  permanentAddress?: string | null;
  occupation?: string | null;
  organizationName?: string | null;
  designation?: string | null;
  sourceOfFund?: string | null;
  sourceOfEnquiry?: string | null;
}

const emptyCreate = {
  fullName: "",
  phone: "",
  email: "",
  projectName: "",
  city: "",
};

const emptyBook = {
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
  sourceOfEnquiry: "",
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ReceptionDashboard() {
  const [tab, setTab] = useState("walkin");

  // Walk-in / local (Rudra Step 3)
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [scenario, setScenario] = useState<SearchScenario>("empty_query");
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [selectedPartnerCpId, setSelectedPartnerCpId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [assignSalesId, setAssignSalesId] = useState("");
  const [searched, setSearched] = useState(false);
  const [titanResult, setTitanResult] = useState<Record<string, unknown> | null>(null);
  const [sales, setSales] = useState<Array<{ id: string; name: string }>>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [walkIn, setWalkIn] = useState({ customerName: "", customerPhone: "", customerEmail: "" });
  const [walkInSalesId, setWalkInSalesId] = useState("");

  // EOI CRM
  const [eoiLeads, setEoiLeads] = useState<EoiLead[]>([]);
  const [eoiSearch, setEoiSearch] = useState("");
  const [eoiBookedFilter, setEoiBookedFilter] = useState<"all" | "false" | "true">("all");
  const [eoiPage, setEoiPage] = useState(1);
  const [eoiTotal, setEoiTotal] = useState<number | null>(null);
  const [eoiLoading, setEoiLoading] = useState(false);
  const [eoiError, setEoiError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createBusy, setCreateBusy] = useState(false);
  const [selected, setSelected] = useState<EoiLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [bookBusy, setBookBusy] = useState(false);

  const refreshVisits = async () => {
    const v = await fetch("/api/visits/today").then((r) => r.json());
    setVisits(v.visits ?? []);
  };

  const searchLocal = async () => {
    const res = await fetch(`/api/leads/search?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    if (!res.ok) {
      toast.error(d.error ?? "Search failed");
      return;
    }
    const nextLeads: LocalLead[] = d.leads ?? [];
    const nextPartners: PartnerOption[] = d.partnerOptions ?? [];
    const nextScenario = (d.scenario ?? "not_found") as SearchScenario;
    setLeads(nextLeads);
    setPartnerOptions(nextPartners);
    setScenario(nextScenario);
    setTitanResult(d.titanResult ?? null);
    setSearched(true);
    setSelectedPartnerCpId(nextPartners[0]?.cpId ?? nextLeads[0]?.cpId ?? "");
    setSelectedLeadId(nextLeads[0]?.id ?? "");
    setAssignSalesId("");

    if (nextScenario === "not_found") {
      const digits = query.replace(/\D/g, "");
      setWalkIn((w) => ({
        ...w,
        customerPhone: digits.length >= 10 ? digits.slice(-10) : query,
      }));
    }
  };

  const loadEoi = useCallback(async (page = 1) => {
    setEoiLoading(true);
    setEoiError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      source: "eoi",
    });
    if (eoiSearch.trim()) params.set("search", eoiSearch.trim());
    if (eoiBookedFilter !== "all") params.set("booked", eoiBookedFilter);

    try {
      const res = await fetch(`/api/eoi/leads?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setEoiLeads([]);
        setEoiTotal(null);
        setEoiError(typeof d.error === "string" ? d.error : "Failed to load EOI leads");
        return;
      }
      setEoiLeads(d.leads ?? []);
      setEoiTotal(d.total ?? null);
      setEoiPage(d.page ?? page);
    } catch {
      setEoiError("Failed to reach CRM");
      setEoiLeads([]);
    } finally {
      setEoiLoading(false);
    }
  }, [eoiSearch, eoiBookedFilter]);

  useEffect(() => {
    fetch("/api/salespersons/available")
      .then((r) => r.json())
      .then((d) => setSales(d.sales ?? []));
    void refreshVisits();
  }, []);

  useEffect(() => {
    if (tab === "eoi") void loadEoi(1);
  }, [tab, loadEoi]);

  const registerWalkIn = async (alsoAssign = false) => {
    const res = await fetch("/api/leads/walkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(walkIn),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(typeof d.error === "string" ? d.error : "Registration failed");
      return;
    }
    toast.success(`Direct walk-in registered: ${d.lead.leadId}`);
    if (alsoAssign && walkInSalesId && d.lead?.id) {
      await assign(d.lead.id, walkInSalesId);
    }
    setWalkIn({ customerName: "", customerPhone: "", customerEmail: "" });
    setWalkInSalesId("");
    void refreshVisits();
  };

  const assign = async (
    leadId: string,
    salesUserId: string,
    partner?: { visitingPartnerCpId?: string; visitingPartnerName?: string }
  ) => {
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salesUserId,
        visitingPartnerCpId: partner?.visitingPartnerCpId,
        visitingPartnerName: partner?.visitingPartnerName,
      }),
    });
    if (res.ok) {
      toast.success("Assigned to salesperson — site visit checked in");
      await searchLocal();
      await refreshVisits();
      setAssignSalesId("");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(typeof d.error === "string" ? d.error : "Assign failed");
    }
  };

  const materializeFromTitan = async (opts: {
    cpId?: string;
    partnerName?: string;
    publicLeadId?: string;
    tag?: string;
  }) => {
    const titanCrmId = String(titanResult?.leadId ?? opts.publicLeadId ?? "").trim();
    if (!titanCrmId) {
      toast.error("Missing Titan lead id");
      return null;
    }
    const res = await fetch("/api/leads/from-titan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titanCrmId,
        customerName: String(titanResult?.customerName ?? "Titan Guest"),
        customerPhone: String(titanResult?.phone ?? query.replace(/\D/g, "").slice(-10) ?? ""),
        cpId: opts.cpId,
        partnerName: opts.partnerName,
        intentType: opts.tag,
        publicLeadId: opts.publicLeadId || titanCrmId,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(typeof d.error === "string" ? d.error : "Could not save Titan lead locally");
      return null;
    }
    return d.lead as { id: string; leadId: string };
  };

  const confirmAndAssign = async () => {
    if (!assignSalesId) {
      toast.error("Select a salesperson");
      return;
    }
    let leadId = selectedLeadId;

    if (scenario === "found_multi_partner") {
      const opt = partnerOptions.find((p) => p.cpId === selectedPartnerCpId);
      if (!opt) {
        toast.error("Select which channel partner they are visiting with today");
        return;
      }
      leadId = opt.leadId || leads.find((l) => l.cpId === opt.cpId)?.id || leadId;
      if (!leadId) {
        const created = await materializeFromTitan({
          cpId: opt.cpId,
          partnerName: opt.partnerName,
          publicLeadId: opt.publicLeadId,
          tag: opt.tag,
        });
        if (!created) return;
        leadId = created.id;
      }
      await assign(leadId, assignSalesId, {
        visitingPartnerCpId: opt.cpId,
        visitingPartnerName: opt.partnerName,
      });
      return;
    }

    if (!leadId && leads[0]) leadId = leads[0].id;

    // Titan-only single partner / single hit — materialize then assign
    if (!leadId && titanResult?.found) {
      const opt =
        partnerOptions.find((p) => p.cpId === selectedPartnerCpId) || partnerOptions[0];
      const created = await materializeFromTitan({
        cpId: opt?.cpId,
        partnerName: opt?.partnerName,
        publicLeadId: opt?.publicLeadId || String(titanResult.leadId ?? ""),
        tag: opt?.tag,
      });
      if (!created) return;
      leadId = created.id;
      await assign(leadId, assignSalesId, {
        visitingPartnerCpId: opt?.cpId,
        visitingPartnerName: opt?.partnerName,
      });
      return;
    }

    if (!leadId) {
      toast.error("No lead selected");
      return;
    }
    const lead = leads.find((l) => l.id === leadId) ?? leads[0];
    await assign(leadId, assignSalesId, {
      visitingPartnerCpId: lead?.cpId ?? undefined,
      visitingPartnerName: lead?.cpId ?? undefined,
    });
  };

  const formatStamp = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const createEoi = async () => {
    setCreateBusy(true);
    try {
      const res = await fetch("/api/eoi/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: createForm.fullName,
          phone: createForm.phone,
          email: createForm.email || undefined,
          projectName: createForm.projectName || undefined,
          city: createForm.city || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      toast.success(`EOI lead created${d.lead?.leadCode ? `: ${d.lead.leadCode}` : ""}`);
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      void loadEoi(1);
    } finally {
      setCreateBusy(false);
    }
  };

  const openDetail = async (lead: EoiLead) => {
    setSelected(lead);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/eoi/leads/${lead.id}`);
      const d = await res.json();
      if (res.ok && d.lead) setSelected(d.lead);
    } catch {
      /* keep list row */
    }
  };

  const openBook = (lead: EoiLead) => {
    setSelected(lead);
    setBookForm({
      ...emptyBook,
      dateOfBirth: lead.dateOfBirth ?? "",
      maritalStatus: lead.maritalStatus ?? "",
      nationality: lead.nationality || "Indian",
      communicationAddress: lead.communicationAddress ?? "",
      permanentAddress: lead.permanentAddress ?? "",
      occupation: lead.occupation ?? "",
      organizationName: lead.organizationName ?? "",
      designation: lead.designation ?? "",
      sourceOfFund: lead.sourceOfFund ?? "",
      sourceOfEnquiry: lead.sourceOfEnquiry ?? "",
    });
    setBookOpen(true);
  };

  const submitBook = async () => {
    if (!selected) return;
    setBookBusy(true);
    try {
      const res = await fetch(`/api/eoi/leads/${selected.id}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booked: true, ...bookForm }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : "Booking failed");
        return;
      }
      toast.success("Lead marked as booked");
      setBookOpen(false);
      setDetailOpen(false);
      void loadEoi(eoiPage);
    } finally {
      setBookBusy(false);
    }
  };

  const totalPages =
    eoiTotal != null && eoiTotal > 0 ? Math.max(1, Math.ceil(eoiTotal / 20)) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster richColors />
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-navy-600">Reception</h1>
            <p className="text-sm text-gray-500">Walk-ins, site visits &amp; EOI leads</p>
          </div>
          <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <SegmentedTabs
          tabs={[
            { id: "walkin", label: "Walk-in Desk" },
            { id: "eoi", label: "EOI Leads" },
            { id: "visits", label: "Today's Visits", count: visits.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "eoi" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <div className="min-w-[200px] flex-1">
                <Label>Search</Label>
                <Input
                  placeholder="Name, phone, lead code…"
                  value={eoiSearch}
                  onChange={(e) => setEoiSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadEoi(1)}
                />
              </div>
              <div>
                <Label>Booked</Label>
                <select
                  className="mt-1 block w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={eoiBookedFilter}
                  onChange={(e) => setEoiBookedFilter(e.target.value as typeof eoiBookedFilter)}
                >
                  <option value="all">All</option>
                  <option value="false">Not booked</option>
                  <option value="true">Booked</option>
                </select>
              </div>
              <Button onClick={() => void loadEoi(1)} disabled={eoiLoading}>
                {eoiLoading ? "Loading…" : "Refresh"}
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Create EOI lead</Button>
            </div>

            {eoiError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {eoiError}
                <p className="mt-1 text-amber-800/80">
                  Set a valid <code className="rounded bg-amber-100 px-1">GOYAL_CRM_API_TOKEN</code>{" "}
                  (Bearer) on the reception service. CRM may reject revoked keys.
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eoiLeads.length === 0 && !eoiLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No EOI leads found
                      </td>
                    </tr>
                  )}
                  {eoiLeads.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{l.fullName || "—"}</p>
                        <p className="text-xs text-gray-500">{l.leadCode || l.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3">{l.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <p>{l.projectName || "—"}</p>
                        {l.city ? <p className="text-xs text-gray-500">{l.city}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            l.booked
                              ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                          }
                        >
                          {l.booked ? "Booked" : "Open"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => void openDetail(l)}>
                            View
                          </Button>
                          {!l.booked && (
                            <Button size="sm" onClick={() => openBook(l)}>
                              Book
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages && totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Page {eoiPage}
                  {eoiTotal != null ? ` · ${eoiTotal} total` : ""}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={eoiPage <= 1 || eoiLoading}
                    onClick={() => void loadEoi(eoiPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={eoiPage >= totalPages || eoiLoading}
                    onClick={() => void loadEoi(eoiPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "walkin" && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-white p-5">
              <h2 className="mb-1 font-semibold">Ask for Lead ID or phone</h2>
              <p className="mb-3 text-sm text-gray-500">
                Confirms partner portal / Titan leads, or registers a direct walk-in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[220px] flex-1"
                  placeholder="Lead ID or phone number"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void searchLocal()}
                />
                <Button onClick={() => void searchLocal()} disabled={!query.trim()}>
                  Search
                </Button>
              </div>
            </div>

            {searched && scenario === "titan_needs_partner" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                <p className="font-semibold">Partner registration required</p>
                <p className="mt-1">
                  Lead exists in Titan CRM
                  {titanResult?.leadId ? ` (${String(titanResult.leadId)})` : ""}, but no channel
                  partner is linked. Ask the partner to register in the partner portal first, then
                  check the visitor in.
                </p>
              </div>
            )}

            {searched && scenario === "found_multi_partner" && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold">Multiple channel partners</h3>
                <p className="mt-1 text-sm text-gray-500">
                  This visitor is registered with more than one partner. Select who they are with
                  today, then assign a salesperson.
                </p>
                <div className="mt-4 space-y-2">
                  {partnerOptions.map((p) => (
                    <label
                      key={`${p.cpId}-${p.submittedAt}-${p.leadId ?? "t"}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
                        selectedPartnerCpId === p.cpId ? "border-brand-500 bg-brand-50/40" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        className="mt-1"
                        name="visiting-partner"
                        checked={selectedPartnerCpId === p.cpId}
                        onChange={() => {
                          setSelectedPartnerCpId(p.cpId);
                          if (p.leadId) setSelectedLeadId(p.leadId);
                        }}
                      />
                      <span>
                        <span className="font-medium">{p.partnerName}</span>
                        <span className="text-gray-500"> · {p.cpId}</span>
                        {p.tag ? (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{p.tag}</span>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-gray-500">
                          Submitted {formatStamp(p.submittedAt)}
                          {p.publicLeadId ? ` · ${p.publicLeadId}` : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Label>Assign salesperson</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={assignSalesId}
                      onChange={(e) => setAssignSalesId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {sales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={() => void confirmAndAssign()}>Confirm partner &amp; assign</Button>
                </div>
              </div>
            )}

            {searched && scenario === "found_single" && (leads.length > 0 || Boolean(titanResult?.found)) && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold">Lead found — confirm partner</h3>
                <div className="mt-3 space-y-3">
                  {leads.map((l) => (
                    <div key={l.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {l.customerName} — {l.leadId}
                      </p>
                      <p className="text-gray-500">
                        {l.customerPhone} · {l.source}
                        {l.cpId ? ` · Partner ${l.cpId}` : " · No partner on file"}
                      </p>
                      {l.project?.name ? (
                        <p className="text-xs text-gray-500">Project: {l.project.name}</p>
                      ) : null}
                      {l.assignedSales?.name ? (
                        <p className="text-xs text-gray-500">Last assigned: {l.assignedSales.name}</p>
                      ) : null}
                      <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="radio"
                          name="single-lead"
                          checked={selectedLeadId === l.id}
                          onChange={() => setSelectedLeadId(l.id)}
                        />
                        Use this lead
                      </label>
                    </div>
                  ))}
                  {leads.length === 0 && titanResult?.found && (
                    <div className="rounded-lg border border-dashed p-3 text-sm">
                      <p className="font-medium">
                        {String(titanResult.customerName ?? "Titan guest")} —{" "}
                        {String(titanResult.leadId ?? "")}
                      </p>
                      <p className="text-gray-500">
                        {String(titanResult.phone ?? "")} · Titan
                        {partnerOptions[0]
                          ? ` · Partner ${partnerOptions[0].partnerName}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Will be saved to local registry on assign.
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Label>Assign salesperson</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={assignSalesId}
                      onChange={(e) => setAssignSalesId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {sales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={() => void confirmAndAssign()}>Confirm &amp; assign</Button>
                </div>
              </div>
            )}

            {searched && scenario === "not_found" && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
                <h3 className="font-semibold">No lead found — direct walk-in</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Visitor came without a partner. Register as Direct Walk-in and assign a
                  salesperson. Booking attribution can be decided later by sales / customer.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name *</Label>
                    <Input
                      value={walkIn.customerName}
                      onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Phone *</Label>
                    <Input
                      value={walkIn.customerPhone}
                      onChange={(e) => setWalkIn({ ...walkIn, customerPhone: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Email (optional)</Label>
                    <Input
                      value={walkIn.customerEmail}
                      onChange={(e) => setWalkIn({ ...walkIn, customerEmail: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Assign salesperson</Label>
                    <select
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      value={walkInSalesId}
                      onChange={(e) => setWalkInSalesId(e.target.value)}
                    >
                      <option value="">Select…</option>
                      {sales.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    disabled={!walkIn.customerName || !walkIn.customerPhone}
                    onClick={() => void registerWalkIn(Boolean(walkInSalesId))}
                  >
                    Register{walkInSalesId ? " & assign" : " walk-in"}
                  </Button>
                </div>
              </div>
            )}

            {!searched && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="mb-3 font-semibold">Or register a known direct walk-in</h3>
                <Input
                  className="mb-2"
                  placeholder="Name"
                  value={walkIn.customerName}
                  onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                />
                <Input
                  className="mb-2"
                  placeholder="Phone"
                  value={walkIn.customerPhone}
                  onChange={(e) => setWalkIn({ ...walkIn, customerPhone: e.target.value })}
                />
                <Input
                  className="mb-3"
                  placeholder="Email (optional)"
                  value={walkIn.customerEmail}
                  onChange={(e) => setWalkIn({ ...walkIn, customerEmail: e.target.value })}
                />
                <Button
                  disabled={!walkIn.customerName || !walkIn.customerPhone}
                  onClick={() => void registerWalkIn(false)}
                >
                  Register walk-in
                </Button>
              </div>
            )}
          </div>
        )}

        {tab === "visits" && (
          <div className="rounded-xl border bg-white p-5">
            <h2 className="mb-3 font-semibold">Today&apos;s site visits</h2>
            {visits.length === 0 ? (
              <p className="text-sm text-gray-500">No check-ins yet today</p>
            ) : (
              <ul className="divide-y">
                {visits.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <div>
                      <p className="font-medium">{v.lead?.customerName ?? "Unknown"}</p>
                      <p className="text-gray-500">
                        {v.lead?.leadId} · {v.lead?.customerPhone}
                      </p>
                    </div>
                    <div className="text-right text-gray-600">
                      <p>{v.salesUser?.name ?? "Unassigned"}</p>
                      <p className="text-xs">{formatTime(v.checkedInAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create EOI lead"
        description="Punches a lead into Goyal Hariyana CRM with source = eoi."
        className="sm:max-w-md"
      >
        <div className="space-y-3">
          <div>
            <Label>Full name *</Label>
            <Input
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input
              value={createForm.phone}
              onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Project name</Label>
            <Input
              value={createForm.projectName}
              onChange={(e) => setCreateForm({ ...createForm, projectName: e.target.value })}
            />
          </div>
          <div>
            <Label>City</Label>
            <Input
              value={createForm.city}
              onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createBusy || !createForm.fullName || !createForm.phone}
              onClick={() => void createEoi()}
            >
              {createBusy ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selected?.fullName || "EOI lead"}
        description={selected?.leadCode || selected?.id}
        className="sm:max-w-lg"
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-xs text-gray-500">Phone</dt>
                <dd>{selected.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Email</dt>
                <dd>{selected.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Project</dt>
                <dd>{selected.projectName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">City</dt>
                <dd>{selected.city || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Status</dt>
                <dd>{selected.booked ? `Booked ${selected.bookedDate || ""}` : "Open"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Source</dt>
                <dd>{selected.source || "eoi"}</dd>
              </div>
            </dl>
            {!selected.booked && (
              <Button className="w-full" onClick={() => { setDetailOpen(false); openBook(selected); }}>
                Book with KYC
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={bookOpen}
        onOpenChange={setBookOpen}
        title="Book EOI lead"
        description="KYC fields are required when booking an EOI lead."
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
            <div key={key} className={key.includes("Address") ? "sm:col-span-2" : ""}>
              <Label>{label}</Label>
              <Input
                type={type}
                value={bookForm[key]}
                onChange={(e) => setBookForm({ ...bookForm, [key]: e.target.value })}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Communication address *</Label>
            <Input
              value={bookForm.communicationAddress}
              onChange={(e) => setBookForm({ ...bookForm, communicationAddress: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Permanent address *</Label>
            <Input
              value={bookForm.permanentAddress}
              onChange={(e) => setBookForm({ ...bookForm, permanentAddress: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBookOpen(false)}>
            Cancel
          </Button>
          <Button disabled={bookBusy} onClick={() => void submitBook()}>
            {bookBusy ? "Booking…" : "Confirm book"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
