import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import {
  prisma,
  searchLeads,
  registerWalkInLead,
  assignLeadToSales,
  upsertLeadFromTitanSearch,
  assignGoyalLeadToSales,
  notifyEoiPartnerPortal,
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

  // Also search Goyal Hariyana CRM EOI leads (Lead ID / phone / name).
  // Walk-in desk previously only hit local DB + Titan, so CRM EOI leads never appeared.
  let goyalEoiLeads: Array<Record<string, unknown>> = [];
  let goyalEoiError: string | undefined;
  if (q.trim() && getGoyalCrmCapabilities().webhookList) {
    try {
      const digits = q.replace(/\D/g, "");
      const phone = digits.length >= 10 ? digits.slice(-10) : undefined;
      const listed = await listGoyalLeads({
        source: "eoi",
        page: 1,
        limit: 20,
        search: q.trim(),
        ...(phone ? { phone } : {}),
      });
      goyalEoiLeads = listed.leads as unknown as Array<Record<string, unknown>>;
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
  else if (leads.length === 0 && titanNeedsPartner) scenario = "titan_needs_partner";
  else if (leads.length === 0 && titanPartners.length > 1) scenario = "found_multi_partner";
  else if (leads.length === 0 && titanResult?.found && titanPartners.length === 1) {
    scenario = "found_single";
  } else if (leads.length === 0 && titanResult?.found && titanPartners.length === 0) {
    scenario = "titan_needs_partner";
  } else if (leads.length === 0 && goyalEoiLeads.length > 0) scenario = "found_goyal_eoi";
  else if (leads.length === 0) scenario = "not_found";
  else if (partnerIds.size > 1 || channelPartnerLeads.length > 1) scenario = "found_multi_partner";
  else scenario = "found_single";

  type PartnerOpt = {
    leadId: string | null;
    publicLeadId: string;
    cpId: string;
    partnerName: string;
    submittedAt: string;
    source: string;
    tag?: string;
  };

  const localPartnerOpts: PartnerOpt[] = leads
    .filter((l) => l.cpId)
    .map((l) => ({
      leadId: l.id,
      publicLeadId: l.leadId,
      cpId: l.cpId as string,
      partnerName: String(l.cpId),
      submittedAt: l.createdAt.toISOString(),
      source: String(l.source),
      tag: l.intentType ?? undefined,
    }));

  const titanPartnerOpts: PartnerOpt[] = (titanPartners as Array<Record<string, unknown>>).map((p) => ({
    leadId: null,
    publicLeadId: String(titanResult?.leadId ?? ""),
    cpId: String(p.cpId ?? ""),
    partnerName: String(p.partnerName ?? p.cpId ?? "Partner"),
    submittedAt: String(p.submittedAt ?? ""),
    source: "TITAN",
    tag: p.tag ? String(p.tag) : undefined,
  }));

  const partnerByCp = new Map<string, PartnerOpt>();
  for (const p of [...titanPartnerOpts, ...localPartnerOpts]) {
    if (!p.cpId) continue;
    const existing = partnerByCp.get(p.cpId);
    // Prefer local lead id when available
    if (!existing || (!existing.leadId && p.leadId)) partnerByCp.set(p.cpId, p);
    else if (existing && p.partnerName && existing.partnerName === existing.cpId && p.partnerName !== p.cpId) {
      partnerByCp.set(p.cpId, { ...existing, partnerName: p.partnerName, tag: p.tag ?? existing.tag });
    }
  }

  return NextResponse.json({
    leads,
    titanResult,
    scenario,
    partnerOptions: Array.from(partnerByCp.values()).sort((a, b) =>
      String(a.submittedAt).localeCompare(String(b.submittedAt))
    ),
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
    where: { checkedInAt: { gte: start } },
    include: {
      lead: { select: { leadId: true, customerName: true, customerPhone: true } },
      salesUser: { select: { name: true } },
    },
    orderBy: { checkedInAt: "desc" },
  });
  return NextResponse.json({ visits });
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
      await notifyEoiPartnerPortal({
        event: "booking.confirmed",
        leadId: registry?.leadId || lead.leadCode,
        eoiCpLeadId: registry?.eoiCpLeadId,
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
