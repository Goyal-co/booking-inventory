import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  prisma,
  searchLeads,
  registerWalkInLead,
  assignLeadToSales,
  upsertLeadFromTitanSearch,
  upsertLeadFromEoiCp,
  assignGoyalLeadToSales,
  notifyEoiPartnerPortal,
  mapLeadForBookingSearch,
  parseVisitingPartnerFromNotes,
} from "@booking/database";
import { walkInLeadSchema, leadAssignSchema } from "@booking/validators";
import {
  GoyalCrmError,
  getGoyalCrmCapabilities,
  listGoyalLeads,
  listMyGoyalLeads,
  getGoyalLead,
  createEoiLeadBestEffort,
  bookGoyalLead,
} from "@booking/integrations";

async function getReceptionUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") return null;
  return session.user;
}

function crmErrorResponse(err: unknown) {
  if (err instanceof GoyalCrmError) {
    return NextResponse.json(
      { error: err.message, details: err.body },
      { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
    );
  }
  console.error("[reception] CRM error", err);
  return NextResponse.json({ error: "CRM request failed" }, { status: 502 });
}

const createEoiLeadSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal("")),
  projectName: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
  city: z.string().max(120).optional(),
  assignedToId: z.string().uuid().optional(),
  dateOfBirth: z.string().optional(),
  maritalStatus: z.string().optional(),
  nationality: z.string().optional(),
  communicationAddress: z.string().optional(),
  permanentAddress: z.string().optional(),
  occupation: z.string().optional(),
  organizationName: z.string().optional(),
  designation: z.string().optional(),
  sourceOfFund: z.string().optional(),
  sourceOfEnquiry: z.string().optional(),
});

const bookEoiLeadSchema = z.object({
  booked: z.boolean().default(true),
  bookedDate: z.string().optional(),
  dateOfBirth: z.string().min(1),
  maritalStatus: z.string().min(1),
  nationality: z.string().min(1),
  communicationAddress: z.string().min(1),
  permanentAddress: z.string().min(1),
  occupation: z.string().min(1),
  organizationName: z.string().min(1),
  designation: z.string().min(1),
  sourceOfFund: z.string().min(1),
  sourceOfEnquiry: z.string().min(1),
});

export async function GET_leadsSearch(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const leads = await searchLeads(user.organizationId, q);

  const { getTitanCRMProvider } = await import("@booking/integrations");
  let titanResult: Record<string, unknown> | null = null;
  if (q.trim()) {
    try {
      const digits = q.replace(/\D/g, "");
      titanResult = await getTitanCRMProvider().searchLead({
        leadId: /^(TITAN|CP-|WALKIN-|EOI-)/i.test(q) ? q : undefined,
        phone: digits.length >= 10 ? digits.slice(-10) : /^\d+$/.test(q) ? q : undefined,
      });
    } catch {
      /* optional */
    }
  }

  // Also search Goyal Hariyana CRM EOI leads (Lead ID / phone / email / name).
  let goyalEoiLeads: Array<Record<string, unknown>> = [];
  let goyalEoiError: string | undefined;
  if (q.trim() && getGoyalCrmCapabilities().webhookList) {
    try {
      const trimmed = q.trim();
      const digits = trimmed.replace(/\D/g, "");
      const phone = digits.length >= 10 ? digits.slice(-10) : undefined;
      const isEmail = trimmed.includes("@");
      const isPhoneOnly = Boolean(phone && !/[A-Za-z@]/.test(trimmed));

      const attempts: Array<Parameters<typeof listGoyalLeads>[0]> = [];
      if (isEmail) {
        attempts.push({ source: "eoi", page: 1, limit: 20, email: trimmed });
        attempts.push({ source: "eoi", page: 1, limit: 20, search: trimmed });
      } else if (isPhoneOnly && phone) {
        attempts.push({ source: "eoi", page: 1, limit: 20, phone });
        attempts.push({ source: "eoi", page: 1, limit: 20, search: phone });
      } else {
        attempts.push({
          source: "eoi",
          page: 1,
          limit: 20,
          search: trimmed,
          ...(phone ? { phone } : {}),
        });
      }

      const seen = new Set<string>();
      for (const params of attempts) {
        try {
          const listed = await listGoyalLeads(params);
          for (const lead of listed.leads) {
            const key = String(lead.id || lead.leadCode || "");
            if (!key || seen.has(key)) continue;
            seen.add(key);
            goyalEoiLeads.push(lead as unknown as Record<string, unknown>);
          }
          if (goyalEoiLeads.length > 0) break;
        } catch (err) {
          goyalEoiError =
            err instanceof GoyalCrmError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Goyal CRM search failed";
        }
      }
    } catch (err) {
      goyalEoiError =
        err instanceof GoyalCrmError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Goyal CRM search failed";
    }
  }

  const partnerIds = new Set(
    leads.map((l) => l.cpId).filter((id): id is string => Boolean(id && String(id).trim()))
  );
  const channelPartnerLeads = leads.filter((l) => l.source === "CHANNEL_PARTNER");
  const titanPartners = Array.isArray(titanResult?.partners) ? titanResult!.partners : [];
  const titanNeedsPartner = Boolean(titanResult?.needsPartnerRegistration);

  let scenario:
    | "found_single"
    | "found_multi_partner"
    | "titan_needs_partner"
    | "found_goyal_eoi"
    | "not_found"
    | "empty_query" = "empty_query";

  if (!q.trim()) scenario = "empty_query";
  // Prefer live Goyal CRM EOI hits when local registry has nothing yet.
  else if (leads.length === 0 && goyalEoiLeads.length > 0) scenario = "found_goyal_eoi";
  else if (leads.length === 0 && titanNeedsPartner) scenario = "titan_needs_partner";
  else if (leads.length === 0 && titanPartners.length > 1) scenario = "found_multi_partner";
  else if (leads.length === 0 && titanResult?.found && titanPartners.length === 1) {
    scenario = "found_single";
  } else if (leads.length === 0 && titanResult?.found && titanPartners.length === 0) {
    scenario = "titan_needs_partner";
  } else if (leads.length === 0) scenario = "not_found";
  else if (partnerIds.size > 1 || channelPartnerLeads.length > 1) scenario = "found_multi_partner";
  else scenario = "found_single";

  // If local found nothing useful but CRM returned rows, force CRM scenario so UI always renders.
  if (
    (scenario === "not_found" || scenario === "titan_needs_partner") &&
    goyalEoiLeads.length > 0
  ) {
    scenario = "found_goyal_eoi";
  }

  type PartnerOpt = {
    /** Stable UI/select key — one row per CP × project association */
    key: string;
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
  };

  const associationKey = (p: {
    eoiCpLeadId?: string | null;
    cpId: string;
    projectId?: string | null;
  }) =>
    p.eoiCpLeadId?.trim() ||
    `${p.cpId}::${p.projectId || "none"}`;

  const optionsByKey = new Map<string, PartnerOpt>();
  const upsertOption = (opt: PartnerOpt) => {
    if (!opt.cpId) return;
    const existing = optionsByKey.get(opt.key);
    if (!existing) {
      optionsByKey.set(opt.key, opt);
      return;
    }
    optionsByKey.set(opt.key, {
      ...existing,
      ...opt,
      leadId: opt.leadId || existing.leadId,
      partnerName:
        opt.partnerName && opt.partnerName !== opt.cpId
          ? opt.partnerName
          : existing.partnerName,
      projectName: opt.projectName || existing.projectName,
      projectId: opt.projectId || existing.projectId,
      eoiCpLeadId: opt.eoiCpLeadId || existing.eoiCpLeadId,
      tag: opt.tag || existing.tag,
    });
  };

  for (const l of leads.filter((row) => row.cpId)) {
    const latestVisit = l.siteVisits?.[0];
    const fromNotes = latestVisit
      ? parseVisitingPartnerFromNotes(latestVisit.notes)
      : null;
    const name =
      (latestVisit?.visitingCpName && latestVisit.visitingCpName !== l.cpId
        ? latestVisit.visitingCpName
        : null) ||
      fromNotes?.partnerName ||
      null;
    const projectId = l.project?.id;
    const projectName = l.project?.name;
    upsertOption({
      key: associationKey({
        eoiCpLeadId: l.eoiCpLeadId,
        cpId: l.cpId as string,
        projectId,
      }),
      leadId: l.id,
      publicLeadId: l.leadId,
      cpId: l.cpId as string,
      partnerName: name || "Channel Partner",
      submittedAt: l.createdAt.toISOString(),
      source: String(l.source),
      tag: projectName || l.intentType || undefined,
      eoiCpLeadId: l.eoiCpLeadId ?? undefined,
      projectId,
      projectName,
    });
  }

  for (const p of titanPartners as Array<Record<string, unknown>>) {
    const cpId = String(p.cpId ?? "");
    if (!cpId) continue;
    upsertOption({
      key: associationKey({ cpId, projectId: p.projectId ? String(p.projectId) : null }),
      leadId: null,
      publicLeadId: String(titanResult?.leadId ?? ""),
      cpId,
      partnerName: String(p.partnerName ?? p.cpId ?? "Partner"),
      submittedAt: String(p.submittedAt ?? ""),
      source: "TITAN",
      tag: p.tag ? String(p.tag) : undefined,
      projectId: p.projectId ? String(p.projectId) : undefined,
      projectName: p.projectName ? String(p.projectName) : undefined,
    });
  }

  // Enrich with EOI canonical identity — one selectable row per CP×project punch
  let eoiIdentity: Awaited<ReturnType<typeof import("@booking/database").fetchEoiLeadIdentity>> = null;
  try {
    const { fetchEoiLeadIdentity } = await import("@booking/database");
    const sample = leads[0];
    const digits = q.replace(/\D/g, "");
    eoiIdentity = await fetchEoiLeadIdentity({
      leadId: sample?.leadId || (/^(EOI-|LEAD-)/i.test(q.trim()) ? q.trim() : undefined),
      phone: sample?.customerPhone || (digits.length >= 10 ? digits.slice(-10) : undefined),
      email: sample?.customerEmail || (q.includes("@") ? q.trim() : undefined),
    });
    if (eoiIdentity?.associations?.length) {
      for (const assoc of eoiIdentity.associations) {
        const partner = eoiIdentity.partners.find((p) => p.cpId === assoc.cpId);
        const localMatch =
          leads.find((l) => l.eoiCpLeadId === assoc.eoiCpLeadId) ||
          leads.find(
            (l) =>
              l.cpId === assoc.cpId &&
              (l.project?.id === assoc.projectId || !l.project?.id)
          );
        upsertOption({
          key: associationKey({
            eoiCpLeadId: assoc.eoiCpLeadId,
            cpId: assoc.cpId,
            projectId: assoc.projectId,
          }),
          leadId: localMatch?.id ?? null,
          publicLeadId: eoiIdentity.leadId || assoc.publicLeadId || "",
          cpId: assoc.cpId,
          partnerName:
            partner?.name || partner?.companyName || assoc.cpName || "Channel Partner",
          submittedAt: assoc.createdAt || new Date().toISOString(),
          source: "CHANNEL_PARTNER",
          tag: assoc.projectName,
          eoiCpLeadId: assoc.eoiCpLeadId,
          projectId: assoc.projectId,
          projectName: assoc.projectName,
          journeyStatus: assoc.journeyStatus,
          siteVisitStatus: assoc.siteVisitStatus ?? undefined,
        });
      }
    } else if (eoiIdentity?.partners?.length) {
      for (const partner of eoiIdentity.partners) {
        for (const project of partner.projects?.length
          ? partner.projects
          : [{ id: "", name: "", eoiStatus: "" }]) {
          const assoc = eoiIdentity.associations.find(
            (a) => a.cpId === partner.cpId && (!project.id || a.projectId === project.id)
          );
          const localMatch =
            leads.find(
              (l) => l.eoiCpLeadId && partner.eoiCpLeadIds.includes(l.eoiCpLeadId)
            ) || leads.find((l) => l.cpId === partner.cpId);
          upsertOption({
            key: associationKey({
              eoiCpLeadId: assoc?.eoiCpLeadId || partner.eoiCpLeadIds[0],
              cpId: partner.cpId,
              projectId: project.id || assoc?.projectId,
            }),
            leadId: localMatch?.id ?? null,
            publicLeadId: eoiIdentity.leadId || "",
            cpId: partner.cpId,
            partnerName: partner.name || partner.companyName || partner.cpId,
            submittedAt: assoc?.createdAt || new Date().toISOString(),
            source: "CHANNEL_PARTNER",
            tag: project.name || assoc?.projectName,
            eoiCpLeadId: assoc?.eoiCpLeadId || partner.eoiCpLeadIds[0],
            projectId: project.id || assoc?.projectId,
            projectName: project.name || assoc?.projectName,
          });
        }
      }
    }
  } catch {
    /* optional enrichment */
  }

  const partnerOptions = Array.from(optionsByKey.values()).sort((a, b) =>
    String(b.submittedAt).localeCompare(String(a.submittedAt))
  );

  // Multiple CP×project associations → reception must confirm which project today
  if (eoiIdentity && partnerOptions.length > 0) {
    if (
      scenario === "not_found" ||
      scenario === "empty_query" ||
      scenario === "titan_needs_partner" ||
      scenario === "found_goyal_eoi" ||
      scenario === "found_single"
    ) {
      scenario = partnerOptions.length > 1 ? "found_multi_partner" : "found_single";
    }
  } else if (
    partnerOptions.length > 1 &&
    (scenario === "found_single" || scenario === "found_goyal_eoi")
  ) {
    scenario = "found_multi_partner";
  }

  return NextResponse.json({
    leads: leads.map(mapLeadForBookingSearch),
    titanResult,
    scenario,
    partnerOptions,
    eoiIdentity: eoiIdentity
      ? {
          leadId: eoiIdentity.leadId,
          customerName: eoiIdentity.customerName,
          primaryPhone: eoiIdentity.primaryPhone,
          primaryEmail: eoiIdentity.primaryEmail,
        }
      : null,
    goyalEoiLeads,
    goyalEoiError,
    capabilities: getGoyalCrmCapabilities(),
  });
}

export async function POST_walkInLead(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = walkInLeadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const lead = await registerWalkInLead({
    organizationId: user.organizationId,
    registeredById: user.id,
    ...parsed.data,
  });
  return NextResponse.json({ lead }, { status: 201 });
}

export async function POST_assignLead(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = leadAssignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const lead = await assignLeadToSales(id, parsed.data.salesUserId, parsed.data.notes, {
    visitingPartnerCpId: parsed.data.visitingPartnerCpId,
    visitingPartnerName: parsed.data.visitingPartnerName,
    eoiCpLeadId: parsed.data.eoiCpLeadId,
    projectId: parsed.data.projectId,
    projectName: parsed.data.projectName,
  });
  return NextResponse.json({ lead });
}

const materializeTitanSchema = z.object({
  titanCrmId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(8),
  customerEmail: z.string().email().optional().or(z.literal("")),
  cpId: z.string().optional(),
  partnerName: z.string().optional(),
  intentType: z.string().optional(),
  publicLeadId: z.string().optional(),
});

/** Upsert Titan search hit into local LeadRegistry (Rudra Step 3). */
export async function POST_materializeTitanLead(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = materializeTitanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { customerEmail, ...rest } = parsed.data;
  const lead = await upsertLeadFromTitanSearch({
    organizationId: user.organizationId,
    registeredById: user.id,
    ...rest,
    ...(customerEmail ? { customerEmail } : {}),
  });
  return NextResponse.json({ lead }, { status: 201 });
}

const materializeEoiSchema = z.object({
  publicLeadId: z.string().min(1),
  eoiCpLeadId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(8),
  customerEmail: z.string().email().optional().or(z.literal("")),
  cpId: z.string().min(1),
  partnerName: z.string().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  intentType: z.string().optional(),
});

/** Upsert EOI Partner Portal identity association into local LeadRegistry. */
export async function POST_materializeEoiLead(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = materializeEoiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const phoneDigits = d.customerPhone.replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return NextResponse.json(
      { error: "A valid customer phone is required (not derived from Lead ID)" },
      { status: 400 }
    );
  }
  const lead = await upsertLeadFromEoiCp({
    leadId: d.publicLeadId,
    eoiCpLeadId: d.eoiCpLeadId,
    customerName: d.customerName,
    customerPhone: phoneDigits.slice(-10),
    customerEmail: d.customerEmail || undefined,
    organizationId: user.organizationId,
    cpId: d.cpId,
    intentType: d.intentType || (d.projectName ? `eoi:${d.projectName}` : undefined),
  });
  return NextResponse.json({ lead }, { status: 201 });
}

export async function GET_availableSalespersons() {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sales = await prisma.user.findMany({
    where: {
      organizationId: user.organizationId,
      isActive: true,
      role: { in: ["SALES_EXEC", "SALES_MANAGER"] },
    },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ sales });
}

export async function GET_visitsToday() {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const visits = await prisma.siteVisit.findMany({
    where: {
      checkedInAt: { gte: start },
      lead: { organizationId: user.organizationId },
    },
    include: {
      lead: {
        select: {
          leadId: true,
          customerName: true,
          customerPhone: true,
          customerEmail: true,
          source: true,
          goyalLeadCode: true,
        },
      },
      salesUser: { select: { name: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });
  return NextResponse.json({
    visits: visits.map((v) => ({
      id: v.id,
      checkedInAt: v.checkedInAt,
      visitingCpId: v.visitingCpId,
      visitingCpName: v.visitingCpName,
      projectName: v.projectName,
      publicLeadId: v.publicLeadId,
      lead: v.lead
        ? {
            ...v.lead,
            isPresales: v.lead.source === "PRESALES",
          }
        : null,
      salesUser: v.salesUser,
    })),
  });
}

function crmAuthHint(err: unknown, context: "list" | "staff" = "staff") {
  if (!(err instanceof GoyalCrmError)) return undefined;
  const msg = err.message.toLowerCase();
  const authFail =
    err.status === 401 ||
    err.status === 403 ||
    msg.includes("not configured") ||
    msg.includes("invalid or revoked");

  if (!authFail) return undefined;

  if (context === "list") {
    return "EOI list/create auth failed. Set a valid EOI_API_KEY on the Reception service (do not put the webhook key in GOYAL_CRM_API_TOKEN). Book / My leads still need a separate staff JWT.";
  }
  return "Book / My leads need GOYAL_CRM_API_TOKEN (staff JWT). List and create work with EOI_API_KEY via GET /eoi/leads and webhook.";
}

export async function GET_eoiCapabilities() {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ capabilities: getGoyalCrmCapabilities() });
}

export async function GET_eoiLeads(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") ?? 1) || 1;
  const limit = Math.min(100, Number(sp.get("limit") ?? 20) || 20);
  const bookedRaw = sp.get("booked");
  const calledRaw = sp.get("called");
  const siteVisitRaw = sp.get("siteVisit");
  const mine = sp.get("mine") === "1" || sp.get("mine") === "true";

  const listParams = {
    page,
    limit,
    source: sp.get("source") ?? "eoi",
    search: sp.get("search") ?? undefined,
    phone: sp.get("phone") ?? undefined,
    fullName: sp.get("fullName") ?? undefined,
    email: sp.get("email") ?? undefined,
    city: sp.get("city") ?? undefined,
    projectName: sp.get("projectName") ?? undefined,
    assignedToId: sp.get("assignedToId") ?? undefined,
    booked: bookedRaw === null || bookedRaw === "" ? undefined : bookedRaw,
    called: calledRaw === null || calledRaw === "" ? undefined : calledRaw,
    siteVisit: siteVisitRaw === null || siteVisitRaw === "" ? undefined : siteVisitRaw,
    leadQuality: sp.get("leadQuality") ?? undefined,
    dateFrom: sp.get("dateFrom") ?? undefined,
    dateTo: sp.get("dateTo") ?? undefined,
    updatedFrom: sp.get("updatedFrom") ?? undefined,
    updatedTo: sp.get("updatedTo") ?? undefined,
  };

  try {
    const result = mine
      ? await listMyGoyalLeads(listParams)
      : await listGoyalLeads(listParams);
    return NextResponse.json({ ...result, capabilities: getGoyalCrmCapabilities() });
  } catch (err) {
    const hint = crmAuthHint(err, "list");
    if (err instanceof GoyalCrmError) {
      return NextResponse.json(
        {
          error: err.message,
          details: err.body,
          hint,
          capabilities: getGoyalCrmCapabilities(),
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    return crmErrorResponse(err);
  }
}

export async function POST_eoiLead(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = createEoiLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, ...rest } = parsed.data;
  const payload = {
    ...rest,
    ...(email ? { email } : {}),
  };

  try {
    // Prefer EOI_API_KEY webhook (works without staff JWT); fall back to staff POST
    const { lead, via } = await createEoiLeadBestEffort(payload);
    return NextResponse.json(
      { lead, via, capabilities: getGoyalCrmCapabilities() },
      { status: 201 }
    );
  } catch (err) {
    return crmErrorResponse(err);
  }
}

export async function GET_eoiLead(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const lead = await getGoyalLead(id);
    return NextResponse.json({ lead });
  } catch (err) {
    const hint = crmAuthHint(err, "staff");
    if (err instanceof GoyalCrmError) {
      return NextResponse.json(
        { error: err.message, details: err.body, hint },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    return crmErrorResponse(err);
  }
}

export async function GET_eoiMyLeads(req: NextRequest) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") ?? 1) || 1;
  const limit = Math.min(100, Number(sp.get("limit") ?? 20) || 20);
  const bookedRaw = sp.get("booked");

  try {
    const result = await listMyGoyalLeads({
      page,
      limit,
      source: sp.get("source") ?? "eoi",
      search: sp.get("search") ?? undefined,
      phone: sp.get("phone") ?? undefined,
      fullName: sp.get("fullName") ?? undefined,
      projectName: sp.get("projectName") ?? undefined,
      booked: bookedRaw === null || bookedRaw === "" ? undefined : bookedRaw,
      leadQuality: sp.get("leadQuality") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
    });
    return NextResponse.json({ ...result, capabilities: getGoyalCrmCapabilities() });
  } catch (err) {
    const hint = crmAuthHint(err, "staff");
    if (err instanceof GoyalCrmError) {
      return NextResponse.json(
        {
          error: err.message,
          details: err.body,
          hint,
          capabilities: getGoyalCrmCapabilities(),
        },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    return crmErrorResponse(err);
  }
}

export async function POST_eoiBook(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = bookEoiLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Webhook-created rows may only expose leadCode until staff API can resolve UUID
  if (id.startsWith("webhook-")) {
    return NextResponse.json(
      {
        error:
          "Cannot book this lead yet — CRM returned no staff lead id. Open the lead from the list (UUID) and set GOYAL_CRM_API_TOKEN for booking.",
        hint: "Book needs GOYAL_CRM_API_TOKEN (staff JWT). List/create work with EOI_API_KEY.",
      },
      { status: 400 }
    );
  }

  let bookId = id;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) {
    try {
      const listed = await listGoyalLeads({ search: id, source: "eoi", limit: 10, page: 1 });
      const match =
        listed.leads.find((l) => l.leadCode === id) ||
        listed.leads.find((l) => l.id === id);
      if (match?.id) bookId = match.id;
    } catch {
      /* book with original id */
    }
  }

  try {
    const lead = await bookGoyalLead(bookId, parsed.data);

    // Keep Partner Portal / customer status in sync when booking is done in CRM.
    try {
      const registry = await prisma.leadRegistry.findFirst({
        where: {
          organizationId: user.organizationId,
          OR: [
            { goyalCrmId: lead.id || bookId },
            ...(lead.leadCode ? [{ goyalLeadCode: lead.leadCode }] : []),
            ...(lead.phone
              ? [{ customerPhone: { contains: lead.phone.replace(/\D/g, "").slice(-10) } }]
              : []),
          ],
        },
        include: { project: { select: { id: true, name: true } } },
      });
      const visitCp = registry
        ? await prisma.siteVisit.findFirst({
            where: {
              leadId: registry.id,
              ...(registry.cpId ? { visitingCpId: registry.cpId } : {}),
            },
            orderBy: { checkedInAt: "desc" },
            select: { visitingCpName: true, visitingCpId: true },
          })
        : null;
      const cpName =
        visitCp?.visitingCpName &&
        visitCp.visitingCpName !== visitCp.visitingCpId
          ? visitCp.visitingCpName
          : undefined;
      await notifyEoiPartnerPortal({
        event: "booking.confirmed",
        leadId: registry?.leadId || lead.leadCode,
        eoiCpLeadId: registry?.eoiCpLeadId,
        cpId: registry?.cpId,
        cpName,
        crmLeadId: lead.id || bookId,
        phone: registry?.customerPhone || lead.phone,
        projectId: registry?.project?.id,
        projectName: registry?.project?.name || lead.projectName,
        completedAt: new Date(),
      });
    } catch (notifyErr) {
      console.error("[POST_eoiBook] EOI_CP notify failed", notifyErr);
    }

    return NextResponse.json({ lead });
  } catch (err) {
    const hint = crmAuthHint(err, "staff");
    if (err instanceof GoyalCrmError) {
      return NextResponse.json(
        { error: err.message, details: err.body, hint },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 }
      );
    }
    return crmErrorResponse(err);
  }
}

const assignEoiLeadSchema = z.object({
  salesUserId: z.string().min(1),
  fullName: z.string().min(1).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional().or(z.literal("")),
  projectName: z.string().optional(),
  leadCode: z.string().optional(),
  notes: z.string().optional(),
});

/** Reception EOI desk → materialize CRM lead + assign to local sales (Direct Booking). */
export async function POST_eoiAssign(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getReceptionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = assignEoiLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  let crmLead: Awaited<ReturnType<typeof getGoyalLead>> | null = null;
  try {
    crmLead = await getGoyalLead(id);
  } catch {
    try {
      const listed = await listGoyalLeads({ search: id, source: "eoi", limit: 10, page: 1 });
      crmLead =
        listed.leads.find((l) => l.id === id) ||
        listed.leads.find((l) => l.leadCode === id) ||
        null;
    } catch {
      crmLead = null;
    }
  }

  const fullName =
    parsed.data.fullName || crmLead?.fullName || "EOI Lead";
  const phone = parsed.data.phone || crmLead?.phone;
  if (!phone) {
    return NextResponse.json({ error: "Phone is required to assign this lead" }, { status: 400 });
  }

  const sales = await prisma.user.findFirst({
    where: {
      id: parsed.data.salesUserId,
      organizationId: user.organizationId,
      role: { in: ["SALES_EXEC", "SALES_MANAGER"] },
      isActive: true,
    },
  });
  if (!sales) {
    return NextResponse.json({ error: "Salesperson not found" }, { status: 404 });
  }

  try {
    const lead = await assignGoyalLeadToSales({
      organizationId: user.organizationId,
      registeredById: user.id,
      salesUserId: sales.id,
      goyalCrmId: crmLead?.id || id,
      goyalLeadCode: parsed.data.leadCode || crmLead?.leadCode,
      customerName: fullName,
      customerPhone: phone,
      customerEmail: parsed.data.email || crmLead?.email || null,
      projectName: parsed.data.projectName || crmLead?.projectName || null,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ lead });
  } catch (e) {
    console.error("[POST_eoiAssign]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assign failed" },
      { status: 500 }
    );
  }
}
