"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Input,
  Label,
  Modal,
  PageHeader,
} from "@booking/ui";
import { toast, Toaster } from "sonner";

export type ReceptionDeskTab = "walkin" | "eoi" | "visits";

interface LocalLead {
  id: string;
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  source: string;
  cpId?: string | null;
  titanCrmId?: string | null;
  createdAt?: string;
  project?: { name: string } | null;
  assignedSales?: { id: string; name: string } | null;
  visitingCp?: {
    partnerName: string;
    cpId?: string;
    fromToday?: boolean;
    checkedInAt?: string | null;
    salesUserName?: string | null;
  } | null;
  visitHistory?: Array<{
    id: string;
    checkedInAt: string;
    projectName?: string | null;
    visitingCpId?: string | null;
    visitingCpName?: string | null;
    salesUserName?: string | null;
  }>;
  isPresales?: boolean;
  todaySiteVisit?: {
    checkedInAt: string;
    salesUser?: { name: string } | null;
  } | null;
  siteVisitStatus?: string;
}

interface PartnerOption {
  leadId: string | null;
  publicLeadId: string;
  cpId: string;
  partnerName: string;
  submittedAt: string;
  source: string;
  tag?: string;
  eoiCpLeadId?: string;
  projectId?: string;
  projectName?: string;
}

type SearchScenario =
  | "found_single"
  | "found_multi_partner"
  | "titan_needs_partner"
  | "found_goyal_eoi"
  | "not_found"
  | "empty_query";


interface Visit {
  id: string;
  checkedInAt: string;
  visitingCpId?: string | null;
  visitingCpName?: string | null;
  projectName?: string | null;
  lead?: {
    leadId: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    isPresales?: boolean;
  } | null;
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
  dateOfBirth: "",
  maritalStatus: "",
  nationality: "",
  communicationAddress: "",
  permanentAddress: "",
  occupation: "",
  organizationName: "",
  designation: "",
  sourceOfFund: "",
  sourceOfEnquiry: "",
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

const TAB_META: Record<ReceptionDeskTab, { title: string; description: string }> = {
  walkin: {
    title: "Walk-in Desk",
    description: "Search by Lead ID, phone, or email — confirm CP, then assign a salesperson.",
  },
  eoi: {
    title: "EOI Leads",
    description: "List, create, and book EOI leads in Goyal Hariyana CRM.",
  },
  visits: {
    title: "Today's Visits",
    description: "Site visits checked in at reception today.",
  },
};

export function ReceptionDesk({ tab }: { tab: ReceptionDeskTab }) {
  // Walk-in / local (Rudra Step 3)
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [scenario, setScenario] = useState<SearchScenario>("empty_query");
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [selectedPartnerCpId, setSelectedPartnerCpId] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [assignSalesId, setAssignSalesId] = useState("");
  const [searched, setSearched] = useState(false);
  const [titanResult, setTitanResult] = useState<{
    found?: boolean;
    leadId?: string;
    customerName?: string;
    phone?: string;
    [key: string]: unknown;
  } | null>(null);
  const [eoiIdentityHint, setEoiIdentityHint] = useState<{
    leadId: string;
    customerName?: string | null;
    primaryPhone?: string | null;
    primaryEmail?: string | null;
  } | null>(null);
  const [goyalEoiHits, setGoyalEoiHits] = useState<EoiLead[]>([]);
  const [goyalEoiSearchError, setGoyalEoiSearchError] = useState("");
  const [sales, setSales] = useState<Array<{ id: string; name: string }>>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [walkIn, setWalkIn] = useState({ customerName: "", customerPhone: "", customerEmail: "" });
  const [walkInSalesId, setWalkInSalesId] = useState("");

  // EOI CRM
  const [eoiLeads, setEoiLeads] = useState<EoiLead[]>([]);
  const [eoiSearch, setEoiSearch] = useState("");
  const [eoiPhone, setEoiPhone] = useState("");
  const [eoiMine, setEoiMine] = useState(false);
  const [eoiBookedFilter, setEoiBookedFilter] = useState<"all" | "false" | "true">("all");
  const [showCreateKyc, setShowCreateKyc] = useState(false);
  const [eoiPage, setEoiPage] = useState(1);
  const [eoiTotal, setEoiTotal] = useState<number | null>(null);
  const [eoiLoading, setEoiLoading] = useState(false);
  const [eoiError, setEoiError] = useState("");
  const [eoiHint, setEoiHint] = useState("");
  const [eoiCaps, setEoiCaps] = useState<{
    staffApi: boolean;
    webhookCreate: boolean;
    webhookList?: boolean;
    canBook?: boolean;
  } | null>(null);
  const [recentCreates, setRecentCreates] = useState<EoiLead[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [createBusy, setCreateBusy] = useState(false);
  const [selected, setSelected] = useState<EoiLead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [bookBusy, setBookBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLead, setAssignLead] = useState<EoiLead | null>(null);
  const [eoiAssignSalesId, setEoiAssignSalesId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);

  const canUseStaffEoi = eoiCaps?.staffApi === true;
  const canListEoi =
    eoiCaps == null || eoiCaps.webhookList || eoiCaps.webhookCreate || eoiCaps.staffApi;
  const canCreateEoi = eoiCaps == null || eoiCaps.webhookCreate || eoiCaps.staffApi;
  const canBookWithStaff = eoiCaps?.canBook === true || canUseStaffEoi;
  const looksLikeUuid = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const canBookLead = (lead: EoiLead) =>
    canBookWithStaff && Boolean(lead.id) && looksLikeUuid(String(lead.id));

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
    const nextGoyal: EoiLead[] = Array.isArray(d.goyalEoiLeads) ? d.goyalEoiLeads : [];
    setLeads(nextLeads);
    setPartnerOptions(nextPartners);
    setScenario(nextScenario);
    setTitanResult((d.titanResult as typeof titanResult) ?? null);
    setEoiIdentityHint(
      d.eoiIdentity && typeof d.eoiIdentity === "object"
        ? (d.eoiIdentity as {
            leadId: string;
            customerName?: string | null;
            primaryPhone?: string | null;
            primaryEmail?: string | null;
          })
        : null
    );
    setGoyalEoiHits(nextGoyal);
    setGoyalEoiSearchError(typeof d.goyalEoiError === "string" ? d.goyalEoiError : "");
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
    setEoiHint("");
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      source: "eoi",
    });
    const searchTrim = eoiSearch.trim();
    const phoneTrim = eoiPhone.trim();
    const searchDigits = searchTrim.replace(/\D/g, "");
    const searchIsPhoneOnly =
      searchDigits.length >= 10 && !/[A-Za-z@]/.test(searchTrim);
    const searchIsEmail = searchTrim.includes("@");
    if (phoneTrim) {
      params.set("phone", phoneTrim);
      if (searchTrim && !searchIsPhoneOnly && !searchIsEmail) params.set("search", searchTrim);
      if (searchIsEmail) params.set("email", searchTrim);
    } else if (searchIsPhoneOnly) {
      params.set("phone", searchDigits.slice(-10));
    } else if (searchIsEmail) {
      params.set("email", searchTrim);
      params.set("search", searchTrim);
    } else if (searchTrim) {
      params.set("search", searchTrim);
    }
    if (eoiBookedFilter !== "all") params.set("booked", eoiBookedFilter);

    const url = eoiMine ? `/api/eoi/my-leads?${params}` : `/api/eoi/leads?${params}`;

    try {
      const res = await fetch(url);
      const d = await res.json();
      if (d.capabilities) {
        setEoiCaps({
          staffApi: Boolean(d.capabilities.staffApi),
          webhookCreate: Boolean(d.capabilities.webhookCreate),
          webhookList: Boolean(d.capabilities.webhookList ?? d.capabilities.webhookCreate),
          canBook: Boolean(d.capabilities.canBook ?? d.capabilities.staffApi),
        });
      }
      if (!res.ok) {
        setEoiLeads([]);
        setEoiTotal(null);
        setEoiError(typeof d.error === "string" ? d.error : "Failed to load EOI leads");
        setEoiHint(typeof d.hint === "string" ? d.hint : "");
        // My-leads / staff-only path rejected
        if (eoiMine && (res.status === 401 || res.status === 403)) {
          setEoiCaps((prev) => ({
            staffApi: false,
            webhookCreate: Boolean(d.capabilities?.webhookCreate ?? prev?.webhookCreate),
            webhookList: Boolean(
              d.capabilities?.webhookList ?? d.capabilities?.webhookCreate ?? prev?.webhookList
            ),
            canBook: false,
          }));
        }
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
  }, [eoiSearch, eoiPhone, eoiBookedFilter, eoiMine]);

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
    partner?: {
      visitingPartnerCpId?: string;
      visitingPartnerName?: string;
      eoiCpLeadId?: string;
      projectId?: string;
      projectName?: string;
    }
  ) => {
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salesUserId,
        visitingPartnerCpId: partner?.visitingPartnerCpId,
        visitingPartnerName: partner?.visitingPartnerName,
        eoiCpLeadId: partner?.eoiCpLeadId,
        projectId: partner?.projectId,
        projectName: partner?.projectName,
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

  const materializeFromEoi = async (opts: {
    cpId: string;
    partnerName?: string;
    publicLeadId: string;
    eoiCpLeadId: string;
    projectId?: string;
    projectName?: string;
    tag?: string;
  }) => {
    const name =
      eoiIdentityHint?.customerName ||
      leads[0]?.customerName ||
      String(titanResult?.customerName ?? "Partner guest");
    const phoneFromQuery = (() => {
      // Never treat Lead ID digits (e.g. EOI-xxx123) as a phone number
      if (/^(EOI-|LEAD-)/i.test(query.trim())) return "";
      const digits = query.replace(/\D/g, "");
      return digits.length >= 10 ? digits.slice(-10) : "";
    })();
    const phone =
      eoiIdentityHint?.primaryPhone ||
      leads[0]?.customerPhone ||
      String(titanResult?.phone ?? "") ||
      phoneFromQuery;
    const email =
      eoiIdentityHint?.primaryEmail || leads[0]?.customerEmail || undefined;
    const res = await fetch("/api/leads/from-eoi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicLeadId: opts.publicLeadId,
        eoiCpLeadId: opts.eoiCpLeadId,
        customerName: name,
        customerPhone: phone,
        customerEmail: email || "",
        cpId: opts.cpId,
        partnerName: opts.partnerName,
        projectId: opts.projectId,
        projectName: opts.projectName,
        intentType: opts.tag,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      toast.error(typeof d.error === "string" ? d.error : "Could not save EOI lead locally");
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
        if (opt.eoiCpLeadId && opt.publicLeadId) {
          const created = await materializeFromEoi({
            cpId: opt.cpId,
            partnerName: opt.partnerName,
            publicLeadId: opt.publicLeadId,
            eoiCpLeadId: opt.eoiCpLeadId,
            projectId: opt.projectId,
            projectName: opt.projectName,
            tag: opt.tag,
          });
          if (!created) return;
          leadId = created.id;
        } else {
          const created = await materializeFromTitan({
            cpId: opt.cpId,
            partnerName: opt.partnerName,
            publicLeadId: opt.publicLeadId,
            tag: opt.tag,
          });
          if (!created) return;
          leadId = created.id;
        }
      }
      await assign(leadId, assignSalesId, {
        visitingPartnerCpId: opt.cpId,
        visitingPartnerName: opt.partnerName,
        eoiCpLeadId: opt.eoiCpLeadId,
        projectId: opt.projectId,
        projectName: opt.projectName,
      });
      return;
    }

    if (!leadId && leads[0]) leadId = leads[0].id;

    // EOI identity only (no local row yet)
    if (!leadId && partnerOptions[0]?.eoiCpLeadId && partnerOptions[0]?.publicLeadId) {
      const opt =
        partnerOptions.find((p) => p.cpId === selectedPartnerCpId) || partnerOptions[0];
      const created = await materializeFromEoi({
        cpId: opt.cpId,
        partnerName: opt.partnerName,
        publicLeadId: opt.publicLeadId,
        eoiCpLeadId: opt.eoiCpLeadId!,
        projectId: opt.projectId,
        projectName: opt.projectName,
        tag: opt.tag,
      });
      if (!created) return;
      leadId = created.id;
      await assign(leadId, assignSalesId, {
        visitingPartnerCpId: opt.cpId,
        visitingPartnerName: opt.partnerName,
        eoiCpLeadId: opt.eoiCpLeadId,
        projectId: opt.projectId,
        projectName: opt.projectName,
      });
      return;
    }

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
        eoiCpLeadId: opt?.eoiCpLeadId,
        projectId: opt?.projectId,
        projectName: opt?.projectName,
      });
      return;
    }

    if (!leadId) {
      toast.error("No lead selected");
      return;
    }
    const lead = leads.find((l) => l.id === leadId) ?? leads[0];
    const opt =
      partnerOptions.find((p) => p.cpId === selectedPartnerCpId) ||
      partnerOptions.find((p) => p.cpId === lead?.cpId) ||
      partnerOptions[0];
    await assign(leadId, assignSalesId, {
      visitingPartnerCpId: opt?.cpId ?? lead?.cpId ?? undefined,
      visitingPartnerName: opt?.partnerName ?? lead?.visitingCp?.partnerName ?? lead?.cpId ?? undefined,
      eoiCpLeadId: opt?.eoiCpLeadId,
      projectId: opt?.projectId,
      projectName: opt?.projectName ?? lead?.project?.name,
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
      const optional = {
        email: createForm.email || undefined,
        projectName: createForm.projectName || undefined,
        city: createForm.city || undefined,
        dateOfBirth: createForm.dateOfBirth || undefined,
        maritalStatus: createForm.maritalStatus || undefined,
        nationality: createForm.nationality || undefined,
        communicationAddress: createForm.communicationAddress || undefined,
        permanentAddress: createForm.permanentAddress || undefined,
        occupation: createForm.occupation || undefined,
        organizationName: createForm.organizationName || undefined,
        designation: createForm.designation || undefined,
        sourceOfFund: createForm.sourceOfFund || undefined,
        sourceOfEnquiry: createForm.sourceOfEnquiry || undefined,
      };
      const res = await fetch("/api/eoi/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: createForm.fullName,
          phone: createForm.phone,
          ...optional,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      const lead = d.lead as EoiLead | undefined;
      const code = lead?.leadCode ? ` ${lead.leadCode}` : "";
      const via = d.via === "webhook" ? " (webhook)" : d.via === "staff" ? " (staff API)" : "";
      toast.success(
        d.lead?.duplicate
          ? `EOI lead already exists${code}`
          : `EOI lead created${code}${via}`
      );
      if (lead) {
        setRecentCreates((prev) => [lead, ...prev.filter((x) => x.id !== lead.id)].slice(0, 8));
      }
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      setShowCreateKyc(false);
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

  const openAssignEoi = (lead: EoiLead) => {
    setAssignLead(lead);
    setEoiAssignSalesId("");
    setAssignOpen(true);
  };

  const submitAssignEoi = async () => {
    if (!assignLead || !eoiAssignSalesId) {
      toast.error("Select a salesperson");
      return;
    }
    setAssignBusy(true);
    try {
      const res = await fetch(`/api/eoi/leads/${assignLead.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesUserId: eoiAssignSalesId,
          fullName: assignLead.fullName,
          phone: assignLead.phone,
          email: assignLead.email || undefined,
          projectName: assignLead.projectName || undefined,
          leadCode: assignLead.leadCode,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : "Assign failed");
        return;
      }
      toast.success(
        `Assigned to ${d.lead?.assignedSales?.name ?? "sales"} — appears in their Direct Booking`
      );
      setAssignOpen(false);
      setAssignLead(null);
    } finally {
      setAssignBusy(false);
    }
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
        toast.error(
          typeof d.error === "string"
            ? d.hint
              ? `${d.error} — ${d.hint}`
              : d.error
            : "Booking failed"
        );
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
    <div className="p-4 md:p-6">
      <Toaster richColors />
      <PageHeader
        title={TAB_META[tab].title}
        description={TAB_META[tab].description}
      />

      <div className="space-y-6">

        {tab === "eoi" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
              <div className="min-w-[180px] flex-1">
                <Label>Search</Label>
                <Input
                  placeholder="Name, lead code, email…"
                  value={eoiSearch}
                  onChange={(e) => setEoiSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void loadEoi(1)}
                />
              </div>
              <div className="min-w-[140px]">
                <Label>Phone</Label>
                <Input
                  placeholder="Phone"
                  value={eoiPhone}
                  onChange={(e) => setEoiPhone(e.target.value)}
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
              <label className="mb-2 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={eoiMine}
                  onChange={(e) => setEoiMine(e.target.checked)}
                  disabled={!canUseStaffEoi}
                />
                My leads
              </label>
              <Button onClick={() => void loadEoi(1)} disabled={eoiLoading}>
                {eoiLoading ? "Loading…" : "Refresh"}
              </Button>
              <Button onClick={() => setCreateOpen(true)} disabled={!canCreateEoi}>
                Create EOI lead
              </Button>
            </div>

            {eoiCaps && eoiCaps.webhookList && !eoiCaps.staffApi && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
                List and create use <code className="rounded bg-sky-100 px-1">EOI_API_KEY</code>{" "}
                (<code className="rounded bg-sky-100 px-1">GET /eoi/leads</code> + webhook). Booking and
                My leads need a staff JWT (
                <code className="rounded bg-sky-100 px-1">GOYAL_CRM_API_TOKEN</code>) — do not reuse the
                webhook key as staff Bearer.
              </div>
            )}

            {eoiError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {eoiError}
                <p className="mt-1 text-amber-800/80">
                  {eoiHint ||
                    "Check EOI_API_KEY for list/create. Book/My leads need GOYAL_CRM_API_TOKEN."}
                </p>
              </div>
            )}

            {recentCreates.length > 0 && (
              <div className="rounded-xl border bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">Recently punched</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Local session list after create (also refresh the CRM table below).
                </p>
                <ul className="mt-3 divide-y text-sm">
                  {recentCreates.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{l.fullName}</span>
                        <span className="text-gray-500"> · {l.phone}</span>
                        {l.leadCode ? (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                            {l.leadCode}
                          </span>
                        ) : null}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(l)}>
                          View
                        </Button>
                        {canBookLead(l) && !l.booked ? (
                          <Button size="sm" variant="outline" onClick={() => openBook(l)}>
                            Book
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
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
                        {eoiError
                          ? canListEoi
                            ? "Could not load leads — check EOI_API_KEY"
                            : "CRM list unavailable — set EOI_API_KEY"
                          : "No EOI leads found"}
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
                              ? "inline-flex rounded-full bg-success-50 px-2.5 py-0.5 text-xs font-medium text-success-600"
                              : "inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
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
                          <Button variant="outline" size="sm" onClick={() => openAssignEoi(l)}>
                            Assign
                          </Button>
                          {!l.booked && canBookLead(l) && (
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
              <h2 className="mb-1 font-semibold">Ask for Lead ID, phone, or email</h2>
              <p className="mb-3 text-sm text-gray-500">
                Confirms partner portal / Titan / Goyal CRM leads, or registers a direct walk-in.
              </p>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="min-w-[220px] flex-1"
                  placeholder="Lead ID, mobile, or email"
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

            {searched &&
              scenario === "found_single" &&
              (leads.length > 0 ||
                titanResult?.found === true ||
                Boolean(eoiIdentityHint) ||
                partnerOptions.length > 0) && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold">Lead found — confirm partner</h3>
                <div className="mt-3 space-y-3">
                  {eoiIdentityHint && leads.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm">
                      <p className="font-medium">
                        {eoiIdentityHint.customerName || "Partner Portal guest"} —{" "}
                        {eoiIdentityHint.leadId}
                      </p>
                      <p className="text-gray-500">
                        {eoiIdentityHint.primaryPhone || ""}
                        {eoiIdentityHint.primaryEmail
                          ? ` · ${eoiIdentityHint.primaryEmail}`
                          : ""}{" "}
                        · Partner Portal
                        {partnerOptions[0]
                          ? ` · Partner ${partnerOptions[0].partnerName}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Will be saved to local registry on assign.
                      </p>
                    </div>
                  ) : null}
                  {leads.map((l) => (
                    <div key={l.id} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {l.customerName} — {l.leadId}
                        {l.isPresales || l.source === "PRESALES" ? (
                          <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                            Presales
                          </span>
                        ) : null}
                      </p>
                      <p className="text-gray-500">
                        {l.customerPhone}
                        {l.customerEmail ? ` · ${l.customerEmail}` : ""}
                        {" · "}
                        {l.source}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-800">
                        CP:{" "}
                        {l.visitingCp
                          ? `${l.visitingCp.partnerName}${
                              l.visitingCp.cpId ? ` (${l.visitingCp.cpId})` : ""
                            }${l.visitingCp.fromToday ? " · today" : ""}`
                          : l.cpId
                            ? l.cpId
                            : "No partner on file"}
                      </p>
                      {l.project?.name ? (
                        <p className="text-xs text-gray-500">Project: {l.project.name}</p>
                      ) : null}
                      {l.assignedSales?.name ? (
                        <p className="text-xs text-gray-500">Last assigned: {l.assignedSales.name}</p>
                      ) : null}
                      {l.todaySiteVisit ? (
                        <p className="text-xs text-gray-500">
                          Checked in {new Date(l.todaySiteVisit.checkedInAt).toLocaleString()}
                          {l.todaySiteVisit.salesUser?.name
                            ? ` · ${l.todaySiteVisit.salesUser.name}`
                            : ""}
                        </p>
                      ) : null}
                      {l.visitHistory && l.visitHistory.length > 0 ? (
                        <div className="mt-2 rounded border border-gray-100 bg-gray-50/80 p-2">
                          <p className="text-xs font-medium text-gray-700">Site visit history</p>
                          <ul className="mt-1 space-y-1">
                            {l.visitHistory.slice(0, 5).map((v) => (
                              <li key={v.id} className="text-xs text-gray-600">
                                {new Date(v.checkedInAt).toLocaleString()}
                                {v.visitingCpName || v.visitingCpId
                                  ? ` · CP ${v.visitingCpName || v.visitingCpId}`
                                  : ""}
                                {v.projectName ? ` · ${v.projectName}` : ""}
                                {v.salesUserName ? ` · ${v.salesUserName}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
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
                  {leads.length === 0 && titanResult?.found === true ? (
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
                  ) : null}
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

            {searched && scenario === "found_goyal_eoi" && (
              <div className="rounded-xl border bg-white p-5">
                <h3 className="font-semibold">CRM lead(s) found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Customer details from Goyal CRM. Assign a salesperson — they will see it under
                  Direct Booking.
                </p>
                {goyalEoiSearchError ? (
                  <p className="mt-2 text-sm text-amber-800">{goyalEoiSearchError}</p>
                ) : null}
                <ul className="mt-4 divide-y">
                  {goyalEoiHits.map((l) => {
                    const cpHint =
                      (typeof l.sourceOfEnquiry === "string" && l.sourceOfEnquiry) ||
                      (typeof (l as EoiLead & { channelPartner?: string }).channelPartner ===
                        "string" &&
                        (l as EoiLead & { channelPartner?: string }).channelPartner) ||
                      null;
                    return (
                      <li
                        key={String(l.id || l.leadCode)}
                        className="flex flex-wrap items-start justify-between gap-3 py-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <p className="font-medium text-gray-900">{l.fullName || "—"}</p>
                          <p className="text-gray-600">
                            {l.phone || "—"}
                            {l.email ? ` · ${l.email}` : ""}
                          </p>
                          <p className="text-gray-600">
                            Lead: {l.leadCode || l.id}
                            {l.projectName ? ` · ${l.projectName}` : ""}
                            {l.city ? ` · ${l.city}` : ""}
                          </p>
                          <p className="font-medium text-gray-800">
                            CP / source: {cpHint || "Not specified on CRM lead"}
                          </p>
                          {l.booked ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                              Already booked in CRM
                            </span>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setAssignLead(l);
                            setEoiAssignSalesId("");
                            setAssignOpen(true);
                          }}
                        >
                          Assign to sales
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {searched && scenario === "not_found" && goyalEoiSearchError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                CRM EOI search failed: {goyalEoiSearchError}. Check Reception{" "}
                <code className="rounded bg-amber-100 px-1">EOI_API_KEY</code>.
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
                      <p className="font-medium">
                        {v.lead?.customerName ?? "Unknown"}
                        {v.lead?.isPresales ? (
                          <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-800">
                            Presales
                          </span>
                        ) : null}
                      </p>
                      <p className="text-gray-500">
                        {v.lead?.leadId} · {v.lead?.customerPhone}
                        {v.lead?.customerEmail ? ` · ${v.lead.customerEmail}` : ""}
                      </p>
                      <p className="text-xs text-gray-600">
                        CP: {v.visitingCpName || v.visitingCpId || "—"}
                        {v.projectName ? ` · ${v.projectName}` : ""}
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
      </div>

      <Modal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create EOI lead"
        description={
          canUseStaffEoi
            ? "Staff API POST /leads/eoi (falls back to webhook if unauthorized)."
            : "Website webhook punch-in (set GOYAL_CRM_API_TOKEN for staff create/list/book)."
        }
        className="sm:max-w-xl"
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
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

          <button
            type="button"
            className="text-sm font-medium text-brand-700 hover:underline"
            onClick={() => setShowCreateKyc((v) => !v)}
          >
            {showCreateKyc ? "Hide optional KYC" : "Add optional KYC (saved for booking)"}
          </button>

          {showCreateKyc && (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["dateOfBirth", "Date of birth", "date"],
                  ["maritalStatus", "Marital status", "text"],
                  ["nationality", "Nationality", "text"],
                  ["occupation", "Occupation", "text"],
                  ["organizationName", "Organization", "text"],
                  ["designation", "Designation", "text"],
                  ["sourceOfFund", "Source of fund", "text"],
                  ["sourceOfEnquiry", "Source of enquiry", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type={type}
                    value={createForm[key]}
                    onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label>Communication address</Label>
                <Input
                  value={createForm.communicationAddress}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, communicationAddress: e.target.value })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Permanent address</Label>
                <Input
                  value={createForm.permanentAddress}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, permanentAddress: e.target.value })
                  }
                />
              </div>
            </div>
          )}

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
              {(
                [
                  ["dateOfBirth", "Date of birth"],
                  ["maritalStatus", "Marital status"],
                  ["nationality", "Nationality"],
                  ["occupation", "Occupation"],
                  ["organizationName", "Organization"],
                  ["designation", "Designation"],
                  ["sourceOfFund", "Source of fund"],
                  ["sourceOfEnquiry", "Source of enquiry"],
                  ["communicationAddress", "Communication address"],
                  ["permanentAddress", "Permanent address"],
                ] as const
              ).map(([key, label]) =>
                selected[key] ? (
                  <div key={key} className={key.includes("Address") ? "col-span-2" : ""}>
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd>{selected[key]}</dd>
                  </div>
                ) : null
              )}
            </dl>
            {!selected.booked && canBookLead(selected) && (
              <Button className="w-full" onClick={() => { setDetailOpen(false); openBook(selected); }}>
                Book with KYC
              </Button>
            )}
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                setDetailOpen(false);
                openAssignEoi(selected);
              }}
            >
              Assign to salesperson
            </Button>
            {!selected.booked && !canBookLead(selected) && (
              <p className="text-xs text-amber-800">
                CRM book needs GOYAL_CRM_API_TOKEN. You can still assign to sales for Direct Booking.
              </p>
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

      <Modal
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Assign to salesperson"
        description="Lead appears in that salesperson's Direct Booking — they can mark site visit or booked in CRM."
        className="sm:max-w-md"
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {assignLead?.fullName} · {assignLead?.phone}
            {assignLead?.leadCode ? ` · ${assignLead.leadCode}` : ""}
          </p>
          <div>
            <Label>Salesperson</Label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={eoiAssignSalesId}
              onChange={(e) => setEoiAssignSalesId(e.target.value)}
            >
              <option value="">Select…</option>
              {sales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button disabled={assignBusy || !eoiAssignSalesId} onClick={() => void submitAssignEoi()}>
              {assignBusy ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
