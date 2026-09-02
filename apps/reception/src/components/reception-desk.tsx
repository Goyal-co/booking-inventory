"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
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
  eoiCpLeadId?: string | null;
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
  /** Unique CP × project association key from search API */
  key?: string;
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
  journeyStatus?: string;
  siteVisitStatus?: string;
}

function partnerOptionKey(p: PartnerOption) {
  return (
    p.key ||
    p.eoiCpLeadId ||
    `${p.cpId}::${p.projectId || "none"}`
  );
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

function FieldRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "info";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700",
    ok: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-900",
    info: "bg-sky-50 text-sky-800",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function StepLabel({ step, title }: { step: number; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function SalesAssignRow({
  value,
  onChange,
  sales,
  onConfirm,
  confirmLabel,
  disabled,
  requireSales = true,
  otp,
  onOtpChange,
  onSendOtp,
  otpSending,
  otpHint,
}: {
  value: string;
  onChange: (id: string) => void;
  sales: Array<{ id: string; name: string }>;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
  requireSales?: boolean;
  otp: string;
  onOtpChange: (otp: string) => void;
  onSendOtp: () => void;
  otpSending?: boolean;
  otpHint?: string;
}) {
  return (
    <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
      <StepLabel step={2} title="Assign salesperson" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Label>{requireSales ? "Who will handle this visitor?" : "Salesperson (optional)"}</Label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{requireSales ? "Select salesperson…" : "Assign later…"}</option>
            {sales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <StepLabel step={3} title="Customer OTP (site visit)" />
        <p className="text-xs text-gray-500">
          Send a code to the customer email, then enter it to confirm the site visit.
          {otpHint ? ` ${otpHint}` : ""}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label>OTP</Label>
            <Input
              value={otp}
              onChange={(e) => onOtpChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              className="mt-1"
            />
          </div>
          <Button type="button" variant="outline" disabled={otpSending} onClick={onSendOtp}>
            {otpSending ? "Sending…" : "Send OTP"}
          </Button>
          <Button
            className="shrink-0"
            disabled={disabled || (requireSales && !value) || otp.length !== 6}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TAB_META: Record<ReceptionDeskTab, { title: string; description: string }> = {
  walkin: {
    title: "Check-in desk",
    description:
      "Look up the visitor, confirm which project they came for, then assign a salesperson.",
  },
  eoi: {
    title: "CRM EOI leads",
    description: "Search, create, assign, or book EOI leads from Goyal CRM.",
  },
  visits: {
    title: "Today’s check-ins",
    description: "Everyone checked in at reception today.",
  },
};

export function ReceptionDesk({ tab }: { tab: ReceptionDeskTab }) {
  // Walk-in / local (Rudra Step 3)
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [scenario, setScenario] = useState<SearchScenario>("empty_query");
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [selectedPartnerKey, setSelectedPartnerKey] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [assignSalesId, setAssignSalesId] = useState("");
  const [siteVisitOtp, setSiteVisitOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
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
  const [eoiAssignOtp, setEoiAssignOtp] = useState("");
  const [eoiOtpSending, setEoiOtpSending] = useState(false);
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
    setSelectedPartnerKey(
      nextPartners[0] ? partnerOptionKey(nextPartners[0]) : nextLeads[0]?.cpId ?? ""
    );
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
    });
    // Do not send source=eoi — CRM stores Partner punches as partner_leads and
    // rejects source=eoi with HTTP 400. Optional explicit filter via UI later.
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
    if (!/^\d{6}$/.test(siteVisitOtp)) {
      toast.error("Enter the 6-digit OTP sent to the customer");
      return;
    }
    const res = await fetch(`/api/leads/${leadId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salesUserId,
        otp: siteVisitOtp,
        visitingPartnerCpId: partner?.visitingPartnerCpId,
        visitingPartnerName: partner?.visitingPartnerName,
        eoiCpLeadId: partner?.eoiCpLeadId,
        projectId: partner?.projectId,
        projectName: partner?.projectName,
      }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      if (d.crmSynced) {
        toast.success("Assigned — site visit checked in (CRM synced)");
      } else {
        toast.success("Assigned to salesperson — site visit checked in locally");
        if (typeof d.crmError === "string" && d.crmError) {
          toast.warning("CRM site-visit not synced", { description: d.crmError });
        }
      }
      await searchLocal();
      await refreshVisits();
      setAssignSalesId("");
      setSiteVisitOtp("");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(typeof d.error === "string" ? d.error : "Assign failed");
    }
  };

  const sendLeadOtp = async (leadId: string) => {
    if (!leadId) {
      toast.error("Resolve the visitor lead first, then send OTP");
      return;
    }
    setOtpSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/otp/send`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(typeof d.error === "string" ? d.error : "Could not send OTP");
        if (typeof d.devOtp === "string") setSiteVisitOtp(d.devOtp);
        return;
      }
      toast.success(`OTP sent to ${d.email || "customer"}`);
      if (typeof d.devOtp === "string") setSiteVisitOtp(d.devOtp);
    } finally {
      setOtpSending(false);
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
      const opt = partnerOptions.find((p) => partnerOptionKey(p) === selectedPartnerKey);
      if (!opt) {
        toast.error("Select which partner and project they are visiting for today");
        return;
      }
      leadId =
        opt.leadId ||
        leads.find((l) => l.eoiCpLeadId && l.eoiCpLeadId === opt.eoiCpLeadId)?.id ||
        leads.find((l) => l.cpId === opt.cpId)?.id ||
        leadId;
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
        partnerOptions.find((p) => partnerOptionKey(p) === selectedPartnerKey) ||
        partnerOptions[0];
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
        partnerOptions.find((p) => partnerOptionKey(p) === selectedPartnerKey) ||
        partnerOptions[0];
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
      partnerOptions.find((p) => partnerOptionKey(p) === selectedPartnerKey) ||
      partnerOptions.find((p) => p.cpId === lead?.cpId) ||
      partnerOptions[0];
    await assign(leadId, assignSalesId, {
      visitingPartnerCpId: opt?.cpId ?? lead?.cpId ?? undefined,
      visitingPartnerName:
        opt?.partnerName ?? lead?.visitingCp?.partnerName ?? undefined,
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
    if (!/^\d{6}$/.test(eoiAssignOtp)) {
      toast.error("Enter the 6-digit OTP sent to the customer");
      return;
    }
    setAssignBusy(true);
    try {
      const res = await fetch(`/api/eoi/leads/${assignLead.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesUserId: eoiAssignSalesId,
          otp: eoiAssignOtp,
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
        d.crmSynced
          ? `Assigned to ${d.lead?.assignedSales?.name ?? "sales"} — site visit synced to CRM`
          : `Assigned to ${d.lead?.assignedSales?.name ?? "sales"} — local site visit checked in`
      );
      if (!d.crmSynced && typeof d.crmError === "string" && d.crmError) {
        toast.warning("CRM site-visit not synced", { description: d.crmError });
      }
      setAssignOpen(false);
      setAssignLead(null);
      setEoiAssignOtp("");
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Listing/creating CRM leads works with your Partner token. CRM{" "}
                <strong>Book</strong> and <strong>Site visit</strong> need a staff login JWT in{" "}
                <code className="rounded bg-amber-100 px-1">GOYAL_CRM_API_TOKEN</code> (not the
                Partner/Bearer access key — that returns 403). Assign still records a local site
                visit and notifies the Partner Portal.
              </div>
            )}

            {eoiError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {eoiError}
                {eoiHint ? <p className="mt-1 text-amber-800/80">{eoiHint}</p> : null}
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
                            ? "Could not load leads — check EOI_API_KEY (Bearer/api_key) or GOYAL_CRM_API_TOKEN (staff JWT)"
                            : "CRM list unavailable — set EOI_API_KEY and/or GOYAL_CRM_API_TOKEN"
                          : "No CRM / EOI leads found"}
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
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Step 1 of 2
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">Find the visitor</h2>
              <p className="mt-1 text-sm text-gray-500">
                Ask for Lead ID, mobile number, or email.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  className="flex-1"
                  placeholder="e.g. EOI-000123, 98XXXXXXXX, name@email.com"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void searchLocal()}
                />
                <Button
                  className="sm:min-w-[120px]"
                  onClick={() => void searchLocal()}
                  disabled={!query.trim()}
                >
                  Search
                </Button>
              </div>
            </div>

            {searched &&
              (() => {
                const visitorName =
                  eoiIdentityHint?.customerName ||
                  leads[0]?.customerName ||
                  (titanResult?.customerName ? String(titanResult.customerName) : null) ||
                  goyalEoiHits[0]?.fullName ||
                  null;
                const visitorPhone =
                  eoiIdentityHint?.primaryPhone ||
                  leads[0]?.customerPhone ||
                  (titanResult?.phone ? String(titanResult.phone) : null) ||
                  goyalEoiHits[0]?.phone ||
                  null;
                const visitorEmail =
                  eoiIdentityHint?.primaryEmail ||
                  leads[0]?.customerEmail ||
                  goyalEoiHits[0]?.email ||
                  null;
                const visitorLeadId =
                  eoiIdentityHint?.leadId ||
                  leads[0]?.leadId ||
                  (titanResult?.leadId ? String(titanResult.leadId) : null) ||
                  goyalEoiHits[0]?.leadCode ||
                  null;

                return visitorName || visitorPhone || visitorLeadId ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Visitor
                    </p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
                      {visitorName || "Visitor found"}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <FieldRow label="Lead ID" value={visitorLeadId} />
                      <FieldRow label="Mobile" value={visitorPhone} />
                      <FieldRow label="Email" value={visitorEmail} />
                    </div>
                  </div>
                ) : null;
              })()}

            {searched && scenario === "titan_needs_partner" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-semibold text-amber-950">Partner not linked yet</p>
                <p className="mt-1 text-sm text-amber-900/90">
                  This lead is in Titan, but no channel partner is attached. Ask the partner to
                  register in the Partner Portal, then search again.
                </p>
              </div>
            )}

            {searched && scenario === "found_multi_partner" && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <StepLabel step={1} title="Which project are they here for?" />
                <p className="mb-4 text-sm text-gray-500">
                  {partnerOptions.length} project
                  {partnerOptions.length === 1 ? "" : "s"} found for this visitor. Select the one
                  for today&apos;s visit.
                </p>
                <div className="space-y-2">
                  {partnerOptions.map((p) => {
                    const key = partnerOptionKey(p);
                    const selected = selectedPartnerKey === key;
                    return (
                      <label
                        key={key}
                        className={`block cursor-pointer rounded-xl border p-4 transition ${
                          selected
                            ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            className="mt-1"
                            name="visiting-partner-project"
                            checked={selected}
                            onChange={() => {
                              setSelectedPartnerKey(key);
                              if (p.leadId) setSelectedLeadId(p.leadId);
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-gray-900">
                                {p.projectName || p.tag || "Project not specified"}
                              </p>
                              {p.journeyStatus === "BOOKED" ? (
                                <StatusChip tone="ok">Booked</StatusChip>
                              ) : p.siteVisitStatus === "COMPLETED" ? (
                                <StatusChip tone="info">Site visit done</StatusChip>
                              ) : (
                                <StatusChip>Open</StatusChip>
                              )}
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <FieldRow label="Channel partner" value={p.partnerName} />
                              <FieldRow
                                label="Punched on"
                                value={formatStamp(p.submittedAt)}
                              />
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <SalesAssignRow
                  value={assignSalesId}
                  onChange={setAssignSalesId}
                  sales={sales}
                  onConfirm={() => void confirmAndAssign()}
                  confirmLabel="Check in visitor"
                  disabled={!selectedPartnerKey}
                  otp={siteVisitOtp}
                  onOtpChange={setSiteVisitOtp}
                  otpSending={otpSending}
                  onSendOtp={() => {
                    const leadId =
                      selectedLeadId
                      || partnerOptions.find((p) => partnerOptionKey(p) === selectedPartnerKey)?.leadId
                      || leads[0]?.id
                      || "";
                    void sendLeadOtp(leadId);
                  }}
                />
              </div>
            )}

            {searched && goyalEoiHits.length > 0 && scenario !== "found_goyal_eoi" && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Also found in CRM</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Optional — assign from CRM if this is a Goyal CRM EOI lead.
                </p>
                <ul className="mt-3 space-y-2">
                  {goyalEoiHits.map((l) => (
                    <li
                      key={String(l.id || l.leadCode)}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 text-sm"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{l.fullName || "—"}</p>
                        <p className="text-xs text-gray-500">
                          {l.leadCode || l.id}
                          {l.projectName ? ` · ${l.projectName}` : ""}
                          {l.phone ? ` · ${l.phone}` : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignLead(l);
                          setEoiAssignSalesId("");
                          setAssignOpen(true);
                        }}
                      >
                        Assign from CRM
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {searched &&
              scenario === "found_single" &&
              (leads.length > 0 ||
                titanResult?.found === true ||
                Boolean(eoiIdentityHint) ||
                partnerOptions.length > 0) && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <StepLabel step={1} title="Confirm today’s visit details" />
                <div className="mt-1 space-y-3">
                  {(partnerOptions.length > 0
                    ? partnerOptions
                    : [
                        {
                          key: "fallback",
                          leadId: leads[0]?.id ?? null,
                          publicLeadId: leads[0]?.leadId ?? "",
                          cpId: leads[0]?.cpId ?? "",
                          partnerName:
                            leads[0]?.visitingCp?.partnerName ||
                            "No partner on file",
                          submittedAt: "",
                          source: leads[0]?.source ?? "",
                          projectName: leads[0]?.project?.name,
                          projectId: undefined,
                          eoiCpLeadId: leads[0]?.eoiCpLeadId ?? undefined,
                        } satisfies PartnerOption,
                      ]
                  ).map((p) => {
                    const key = partnerOptionKey(p);
                    const selected =
                      partnerOptions.length <= 1 || selectedPartnerKey === key;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-4 ${
                          selected
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <FieldRow
                            label="Project"
                            value={p.projectName || p.tag || leads[0]?.project?.name || "—"}
                          />
                          <FieldRow label="Channel partner" value={p.partnerName} />
                          <FieldRow label="Lead ID" value={p.publicLeadId || leads[0]?.leadId} />
                          <FieldRow
                            label="Source"
                            value={
                              p.source === "CHANNEL_PARTNER"
                                ? "Partner Portal"
                                : p.source || leads[0]?.source || undefined
                            }
                          />
                        </div>
                        {leads[0]?.todaySiteVisit ? (
                          <p className="mt-3 text-xs text-gray-500">
                            Already checked in today
                            {leads[0].todaySiteVisit.salesUser?.name
                              ? ` · ${leads[0].todaySiteVisit.salesUser.name}`
                              : ""}{" "}
                            · {formatStamp(leads[0].todaySiteVisit.checkedInAt)}
                          </p>
                        ) : null}
                        {leads.length > 1 ? (
                          <label className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="radio"
                              name="single-lead"
                              checked={selectedLeadId === (p.leadId || "")}
                              onChange={() => {
                                if (p.leadId) setSelectedLeadId(p.leadId);
                                setSelectedPartnerKey(key);
                              }}
                            />
                            Use this record
                          </label>
                        ) : null}
                      </div>
                    );
                  })}

                  {leads.length > 0 && leads[0]?.visitHistory && leads[0].visitHistory.length > 0 ? (
                    <details className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                      <summary className="cursor-pointer text-xs font-medium text-gray-700">
                        Previous site visits ({leads[0].visitHistory.length})
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {leads[0].visitHistory.slice(0, 5).map((v) => (
                          <li key={v.id} className="text-xs text-gray-600">
                            {formatStamp(v.checkedInAt)}
                            {v.projectName ? ` · ${v.projectName}` : ""}
                            {v.visitingCpName ? ` · ${v.visitingCpName}` : ""}
                            {v.salesUserName ? ` · ${v.salesUserName}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <SalesAssignRow
                  value={assignSalesId}
                  onChange={setAssignSalesId}
                  sales={sales}
                  onConfirm={() => void confirmAndAssign()}
                  confirmLabel="Check in visitor"
                  otp={siteVisitOtp}
                  onOtpChange={setSiteVisitOtp}
                  otpSending={otpSending}
                  onSendOtp={() => {
                    const leadId = selectedLeadId || leads[0]?.id || "";
                    void sendLeadOtp(leadId);
                  }}
                />
              </div>
            )}

            {searched && scenario === "found_goyal_eoi" && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <StepLabel step={1} title="CRM lead found — assign to sales" />
                <p className="mb-4 text-sm text-gray-500">
                  Matched in Goyal CRM from your search. Assign a salesperson to continue.
                </p>
                <ul className="space-y-3">
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
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-200 p-4"
                      >
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                          <FieldRow label="Name" value={l.fullName || "—"} />
                          <FieldRow label="Mobile" value={l.phone || "—"} />
                          <FieldRow label="Lead" value={l.leadCode || l.id} />
                          <FieldRow label="Project" value={l.projectName || "—"} />
                          <FieldRow label="Partner / source" value={cpHint || "Not on CRM lead"} />
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {l.booked ? <StatusChip tone="ok">Already booked</StatusChip> : null}
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
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {searched &&
              scenario === "not_found" &&
              goyalEoiSearchError &&
              !/invalid|revoked|unauthorized|not configured/i.test(goyalEoiSearchError) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                CRM search failed: {goyalEoiSearchError}
              </div>
            )}

            {searched && scenario === "not_found" && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 shadow-sm">
                <StepLabel step={1} title="No match — register as walk-in" />
                <p className="mb-4 text-sm text-gray-500">
                  No partner or CRM lead found. Register the visitor and assign a salesperson.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Full name *</Label>
                    <Input
                      value={walkIn.customerName}
                      onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Mobile *</Label>
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
                </div>
                <SalesAssignRow
                  value={walkInSalesId}
                  onChange={setWalkInSalesId}
                  sales={sales}
                  onConfirm={() => void registerWalkIn(Boolean(walkInSalesId))}
                  confirmLabel={walkInSalesId ? "Register & check in" : "Register walk-in"}
                  disabled={!walkIn.customerName || !walkIn.customerPhone}
                  requireSales={false}
                  otp={siteVisitOtp}
                  onOtpChange={setSiteVisitOtp}
                  otpSending={otpSending}
                  otpHint="Email required on the walk-in form before OTP."
                  onSendOtp={async () => {
                    if (!walkIn.customerEmail) {
                      toast.error("Enter customer email to send OTP");
                      return;
                    }
                    // Ensure lead exists so OTP can be keyed to it
                    const res = await fetch("/api/leads/walkin", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(walkIn),
                    });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      toast.error(typeof d.error === "string" ? d.error : "Could not register walk-in");
                      return;
                    }
                    if (d.lead?.id) {
                      setSelectedLeadId(d.lead.id);
                      await sendLeadOtp(d.lead.id);
                    }
                  }}
                />
              </div>
            )}

            {!searched && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900">Quick walk-in (no search)</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Use only when the visitor has no Lead ID / phone on file.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Full name *</Label>
                    <Input
                      value={walkIn.customerName}
                      onChange={(e) => setWalkIn({ ...walkIn, customerName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Mobile *</Label>
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
                </div>
                <div className="mt-4">
                  <Button
                    disabled={!walkIn.customerName || !walkIn.customerPhone}
                    onClick={() => void registerWalkIn(false)}
                  >
                    Register walk-in
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "visits" && (
          <div className="mx-auto max-w-4xl rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Today&apos;s check-ins</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {visits.length === 0
                  ? "No visitors checked in yet."
                  : `${visits.length} visitor${visits.length === 1 ? "" : "s"} today`}
              </p>
            </div>
            {visits.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-gray-500">
                Check-ins from the desk will appear here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Visitor</th>
                      <th className="px-5 py-3 font-semibold">Project</th>
                      <th className="px-5 py-3 font-semibold">Partner</th>
                      <th className="px-5 py-3 font-semibold">Salesperson</th>
                      <th className="px-5 py-3 font-semibold">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-900">
                            {v.lead?.customerName ?? "Unknown"}
                            {v.lead?.isPresales ? (
                              <span className="ml-2">
                                <StatusChip tone="info">Presales</StatusChip>
                              </span>
                            ) : null}
                          </p>
                          <p className="text-xs text-gray-500">
                            {v.lead?.leadId || "—"}
                            {v.lead?.customerPhone ? ` · ${v.lead.customerPhone}` : ""}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-gray-800">{v.projectName || "—"}</td>
                        <td className="px-5 py-3 text-gray-800">
                          {v.visitingCpName || "—"}
                        </td>
                        <td className="px-5 py-3 text-gray-800">
                          {v.salesUser?.name ?? "Unassigned"}
                        </td>
                        <td className="px-5 py-3 text-gray-600">{formatTime(v.checkedInAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
          <div>
            <Label>Customer OTP</Label>
            <div className="mt-1 flex gap-2">
              <Input
                value={eoiAssignOtp}
                onChange={(e) => setEoiAssignOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                inputMode="numeric"
              />
              <Button
                type="button"
                variant="outline"
                disabled={eoiOtpSending || !assignLead}
                onClick={async () => {
                  if (!assignLead) return;
                  setEoiOtpSending(true);
                  try {
                    const res = await fetch(`/api/eoi/leads/${assignLead.id}/otp/send`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: assignLead.email || undefined,
                        projectName: assignLead.projectName || undefined,
                      }),
                    });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      toast.error(typeof d.error === "string" ? d.error : "Could not send OTP");
                      if (typeof d.devOtp === "string") setEoiAssignOtp(d.devOtp);
                      return;
                    }
                    toast.success(`OTP sent to ${d.email || "customer"}`);
                    if (typeof d.devOtp === "string") setEoiAssignOtp(d.devOtp);
                  } finally {
                    setEoiOtpSending(false);
                  }
                }}
              >
                {eoiOtpSending ? "Sending…" : "Send OTP"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={assignBusy || !eoiAssignSalesId || eoiAssignOtp.length !== 6}
              onClick={() => void submitAssignEoi()}
            >
              {assignBusy ? "Assigning…" : "Assign"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
