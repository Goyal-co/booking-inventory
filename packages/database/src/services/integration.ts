import { IntegrationSystem, IntegrationSyncStatus, LeadSource, Prisma } from "@prisma/client";
import { mapDigitalFormToTitanPayload } from "@goyal/ecosystem-contracts";
import { prisma } from "../index";
import { sendEmail, blockNotificationEmail } from "@booking/email";

export async function logIntegrationSync(
  system: IntegrationSystem,
  entityType: string,
  entityId: string,
  payload: Prisma.InputJsonValue,
  externalId?: string,
  status: IntegrationSyncStatus = IntegrationSyncStatus.PENDING,
  error?: string
) {
  return prisma.integrationSyncLog.create({
    data: { system, entityType, entityId, payload, externalId, status, error },
  });
}

export async function sendBlockNotificationEmail(params: {
  blockId: string;
  customerEmail: string;
  customerName: string;
  projectName: string;
  unitNumber: string;
  towerName: string;
  bookingUrl: string;
  dashboardUrl?: string;
  brochureUrl?: string;
  leadId?: string;
  costSheetHtml?: string;
  costSheetFileName?: string;
}) {
  const { subject, html } = blockNotificationEmail({
    customerName: params.customerName,
    projectName: params.projectName,
    unitNumber: params.unitNumber,
    towerName: params.towerName,
    bookingUrl: params.bookingUrl,
    dashboardUrl: params.dashboardUrl,
    brochureUrl: params.brochureUrl,
    hasCostSheetAttachment: Boolean(params.costSheetHtml),
  });

  const attachments = params.costSheetHtml
    ? [
        {
          name: params.costSheetFileName ?? `Cost-Sheet-${params.unitNumber}.html`,
          content: Buffer.from(params.costSheetHtml, "utf8").toString("base64"),
        },
      ]
    : undefined;

  const result = await sendEmail({
    to: params.customerEmail,
    subject,
    html,
    attachments,
  });

  await logIntegrationSync(
    IntegrationSystem.TITAN,
    "block",
    params.blockId,
    { ...params, emailSent: result.success },
    undefined,
    result.success ? IntegrationSyncStatus.SUCCESS : IntegrationSyncStatus.FAILED,
    result.error
  );

  if (params.leadId) {
    await syncBlockToTitan(params);
  }

  return result;
}

async function syncBlockToTitan(params: {
  blockId: string;
  leadId?: string;
  projectName: string;
  unitNumber: string;
}) {
  const { getTitanCRMProvider } = await import("@booking/integrations");
  const crm = getTitanCRMProvider();
  try {
    const res = await crm.syncBlock({
      blockId: params.blockId,
      leadId: params.leadId,
      projectName: params.projectName,
      unitNumber: params.unitNumber,
    });
    await logIntegrationSync(
      IntegrationSystem.TITAN,
      "block",
      params.blockId,
      params as object,
      res.crmId,
      IntegrationSyncStatus.SUCCESS
    );
  } catch (e) {
    await logIntegrationSync(
      IntegrationSystem.TITAN,
      "block",
      params.blockId,
      params as object,
      undefined,
      IntegrationSyncStatus.FAILED,
      e instanceof Error ? e.message : "Sync failed"
    );
  }
}

export async function syncBookingToIntegrations(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      digitalForm: true,
      unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
      lead: true,
    },
  });
  if (!booking) return;

  const { getTitanCRMProvider, getPostCRMProvider } = await import("@booking/integrations");
  const rawFormData = (booking.digitalForm?.formData ?? {}) as Record<string, unknown>;
  const mapped = mapDigitalFormToTitanPayload(rawFormData);

  try {
    const titan = getTitanCRMProvider();
    const res = await titan.syncBooking({
      bookingId: booking.id,
      leadId: booking.lead?.leadId,
      ...mapped,
      bookedWithCpId: booking.bookedWithCpId ?? undefined,
      bookedWithCpName: booking.bookedWithCpName ?? undefined,
      visitingCpId: booking.bookedWithCpId ?? booking.lead?.cpId ?? undefined,
      visitingCpName: booking.bookedWithCpName ?? undefined,
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { titanCrmId: res.crmId } });
    await logIntegrationSync(IntegrationSystem.TITAN, "booking", bookingId, mapped, res.crmId, IntegrationSyncStatus.SUCCESS);

    // Rudra / Partner Portal EOI tag path — also push EOI sync when lead is CP/EOI
    const isEoiOrCp =
      booking.lead?.source === "CHANNEL_PARTNER" || Boolean(booking.lead?.eoiCpLeadId);
    if (isEoiOrCp) {
      try {
        const eoiRes = await titan.syncEOI({
          bookingId: booking.id,
          leadId: booking.lead?.leadId,
          eoiCpLeadId: booking.lead?.eoiCpLeadId,
          unitNumber: booking.unit.unitNumber,
          projectName: booking.unit.floor.tower.project.name,
          ...mapped,
        });
        await logIntegrationSync(
          IntegrationSystem.TITAN,
          "eoi",
          bookingId,
          { leadId: booking.lead?.leadId, ...mapped },
          eoiRes.crmId,
          IntegrationSyncStatus.SUCCESS
        );
      } catch (eoiErr) {
        await logIntegrationSync(
          IntegrationSystem.TITAN,
          "eoi",
          bookingId,
          mapped,
          undefined,
          IntegrationSyncStatus.FAILED,
          eoiErr instanceof Error ? eoiErr.message : "EOI sync failed"
        );
      }
    }
  } catch (e) {
    await logIntegrationSync(IntegrationSystem.TITAN, "booking", bookingId, mapped, undefined, IntegrationSyncStatus.FAILED, e instanceof Error ? e.message : "Failed");
  }

  try {
    const post = getPostCRMProvider();
    const res = await post.syncBooking({
      bookingId: booking.id,
      customerName: booking.customerName,
      unitNumber: booking.unit.unitNumber,
      projectName: booking.unit.floor.tower.project.name,
      totalPrice: Number(booking.totalPrice),
    });
    await prisma.booking.update({ where: { id: bookingId }, data: { postCrmId: res.postCrmId } });
    await logIntegrationSync(IntegrationSystem.POST_CRM, "booking", bookingId, {}, res.postCrmId, IntegrationSyncStatus.SUCCESS);
  } catch (e) {
    await logIntegrationSync(IntegrationSystem.POST_CRM, "booking", bookingId, {}, undefined, IntegrationSyncStatus.FAILED, e instanceof Error ? e.message : "Failed");
  }

  // Mark lead as booked in CRM + EOI only when booking is CONFIRMED:
  // - requiresBookingApproval=true  → after admin approval
  // - requiresBookingApproval=false → immediately on customer form submit
  const isConfirmed = booking.status === "CONFIRMED";
  if (isConfirmed) {
    const projectName = booking.unit.floor.tower.project.name;
    const projectId = booking.unit.floor.tower.project.id;

    if (booking.lead) {
      const prior = stripBookedIntent(booking.lead.intentType);
      const baseIntent = prior.startsWith("eoi:") ? prior : `eoi:${projectName}`;
      try {
        await prisma.leadRegistry.update({
          where: { id: booking.lead.id },
          data: {
            intentType: `${baseIntent}|booked`,
            siteVisitStatus: "COMPLETED",
            projectId,
          },
        });
      } catch (e) {
        console.error("[syncBookingToIntegrations] lead registry update failed", e);
      }
    }

    // Mark Goyal Hariyana CRM lead as booked (by CRM id or customer phone).
    try {
      const {
        bookGoyalLead,
        getGoyalCrmCapabilities,
        getGoyalLead,
        resolveGoyalLeadId,
      } = await import("@booking/integrations");
      if (getGoyalCrmCapabilities().canBook) {
        const lookupId =
          booking.lead?.goyalCrmId ||
          booking.lead?.titanCrmId ||
          booking.lead?.goyalLeadCode ||
          booking.lead?.leadId;
        const crmId =
          (await resolveGoyalLeadId({
            idOrCode: lookupId,
            phone: booking.lead?.customerPhone || booking.customerPhone,
          })) || lookupId;
        if (crmId) {
          let crmLead: { id: string } | null = null;
          try {
            crmLead = await getGoyalLead(crmId);
          } catch {
            crmLead = { id: crmId };
          }
          try {
            await bookGoyalLead(crmLead.id, {
              booked: true,
              bookedDate: new Date().toISOString().slice(0, 10),
              dateOfBirth: mapped.dateOfBirth,
              maritalStatus: mapped.maritalStatus,
              nationality: mapped.nationality || "Indian",
              communicationAddress: mapped.communicationAddress,
              permanentAddress: mapped.permanentAddress,
              occupation: mapped.occupation,
              organizationName: mapped.organizationName,
              designation: mapped.designation,
              sourceOfFund: mapped.sourceOfFund,
              sourceOfEnquiry: mapped.sourceOfEnquiry || "Partner Portal EOI",
            });
          } catch (fullErr) {
            // partner_leads may accept a minimal book payload
            await bookGoyalLead(crmLead.id, {
              booked: true,
              bookedDate: new Date().toISOString().slice(0, 10),
            });
            void fullErr;
          }
        }
      } else {
        console.warn(
          "[syncBookingToIntegrations] CRM booking skipped — set BEARER_AUTHORIZATION on sales/admin",
        );
      }
    } catch (e) {
      console.error("[syncBookingToIntegrations] Goyal CRM book failed", e);
    }

    try {
      const { notifyEoiPartnerPortalResolved } = await import("./eoi-cp-notify");
      const salesUser = booking.lead?.assignedSalesId
        ? await prisma.user.findUnique({
            where: { id: booking.lead.assignedSalesId },
            select: { name: true },
          })
        : null;
      const cpName =
        booking.bookedWithCpName &&
        booking.bookedWithCpName !== booking.bookedWithCpId
          ? booking.bookedWithCpName
          : undefined;

      await notifyEoiPartnerPortalResolved({
        event: "site_visit.completed",
        leadId: booking.lead?.leadId,
        eoiCpLeadId: booking.lead?.eoiCpLeadId,
        cpId: booking.bookedWithCpId || booking.lead?.cpId,
        cpName,
        crmLeadId: booking.lead?.goyalCrmId || booking.lead?.titanCrmId,
        phone: booking.lead?.customerPhone || booking.customerPhone,
        projectId,
        projectName,
        salespersonId: booking.lead?.assignedSalesId ?? undefined,
        salespersonName: salesUser?.name ?? undefined,
        completedAt: new Date(),
      });

      await notifyEoiPartnerPortalResolved({
        event: "booking.confirmed",
        leadId: booking.lead?.leadId,
        eoiCpLeadId: booking.lead?.eoiCpLeadId,
        cpId: booking.bookedWithCpId || booking.lead?.cpId,
        cpName,
        crmLeadId: booking.lead?.goyalCrmId || booking.lead?.titanCrmId,
        phone: booking.lead?.customerPhone || booking.customerPhone,
        projectId,
        projectName,
        salespersonId: booking.lead?.assignedSalesId ?? undefined,
        salespersonName: salesUser?.name ?? undefined,
        completedAt: new Date(),
      });
    } catch (e) {
      console.error("[syncBookingToIntegrations] EOI_CP booking notify failed", e);
    }
  }
}

export async function retryIntegrationSync(logId: string) {
  const log = await prisma.integrationSyncLog.findUnique({ where: { id: logId } });
  if (!log) return null;
  if (log.entityType === "booking") {
    await syncBookingToIntegrations(log.entityId);
  }
  return prisma.integrationSyncLog.update({
    where: { id: logId },
    data: { status: IntegrationSyncStatus.PENDING },
  });
}

export function generateLeadId(prefix: string, seq: number) {
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

export async function registerWalkInLead(input: {
  organizationId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  projectId?: string;
  registeredById: string;
}) {
  const count = await prisma.leadRegistry.count({ where: { organizationId: input.organizationId } });
  const leadId = generateLeadId("WALKIN", count + 1);

  const lead = await prisma.leadRegistry.create({
    data: {
      leadId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      source: LeadSource.DIRECT_WALKIN,
      registeredById: input.registeredById,
    },
  });

  const { getTitanCRMProvider } = await import("@booking/integrations");
  try {
    const res = await getTitanCRMProvider().syncLead({
      leadId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      source: "DIRECT_WALKIN",
    });
    await prisma.leadRegistry.update({ where: { id: lead.id }, data: { titanCrmId: res.crmId } });
  } catch {
    /* logged on next sync */
  }

  return lead;
}

export async function searchLeads(organizationId: string, query: string) {
  const q = query.trim();
  const digits = q.replace(/\D/g, "");
  const phoneTail = digits.length >= 7 ? digits.slice(-10) : "";
  const looksLikeEmail = q.includes("@");

  return prisma.leadRegistry.findMany({
    where: {
      organizationId,
      OR: [
        { leadId: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        ...(phoneTail ? [{ customerPhone: { contains: phoneTail } }] : []),
        { customerName: { contains: q, mode: "insensitive" } },
        { customerEmail: { contains: q, mode: "insensitive" } },
        ...(looksLikeEmail ? [{ customerEmail: { equals: q, mode: "insensitive" as const } }] : []),
        { titanCrmId: { contains: q, mode: "insensitive" } },
        { goyalCrmId: { contains: q, mode: "insensitive" } },
        { goyalLeadCode: { contains: q, mode: "insensitive" } },
        { cpId: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedSales: { select: { id: true, name: true } },
      siteVisits: {
        orderBy: { checkedInAt: "desc" },
        take: 10,
        include: { salesUser: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

/** Parse reception assign note: "Visiting with partner: Name (CP-ID)" */
export function parseVisitingPartnerFromNotes(notes?: string | null): {
  partnerName: string;
  cpId?: string;
} | null {
  if (!notes?.trim()) return null;
  const m = notes.match(
    /Visiting with partner:\s*([^—(]+?)(?:\s*\(([^)]+)\))?(?:\s*—|\s*$)/i
  );
  if (!m) return null;
  return {
    partnerName: m[1].trim(),
    cpId: m[2]?.trim() || undefined,
  };
}

/** Prefer a real CP display name over storing/sending the raw cpId. */
async function resolveKnownCpName(
  leadRegistryId: string,
  cpId: string
): Promise<string | null> {
  const prior = await prisma.siteVisit.findFirst({
    where: {
      leadId: leadRegistryId,
      visitingCpId: cpId,
      visitingCpName: { not: null },
    },
    orderBy: { checkedInAt: "desc" },
    select: { visitingCpName: true },
  });
  const name = prior?.visitingCpName?.trim();
  if (name && name !== cpId) return name;
  const fromNotes = await prisma.siteVisit.findFirst({
    where: { leadId: leadRegistryId, notes: { contains: "Visiting with partner" } },
    orderBy: { checkedInAt: "desc" },
    select: { notes: true },
  });
  const parsed = parseVisitingPartnerFromNotes(fromNotes?.notes);
  if (parsed?.partnerName && parsed.partnerName !== cpId) return parsed.partnerName;
  return null;
}

export function startOfLocalDay(d = new Date()) {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start;
}

function stripBookedIntent(intentType?: string | null) {
  return (intentType ?? "").replace(/\|booked$/i, "");
}

/**
 * EOI Partner Portal project ids are not valid LeadRegistry.projectId FKs.
 * Resolve to a local Booking Inventory project by id or name when possible.
 */
export async function resolveLocalBookingProjectId(
  organizationId: string,
  opts: { projectId?: string | null; projectName?: string | null }
): Promise<string | undefined> {
  const projectId = opts.projectId?.trim();
  const projectName = opts.projectName?.trim();

  if (projectId) {
    const byId = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }

  if (projectName) {
    const byName = await prisma.project.findFirst({
      where: {
        organizationId,
        name: { equals: projectName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (byName) return byName.id;
  }

  return undefined;
}

type SiteVisitSnapshot = {
  id: string;
  status: string;
  checkedInAt: Date;
  projectId?: string | null;
  projectName?: string | null;
  visitingCpId?: string | null;
  visitingCpName?: string | null;
  salesUserId?: string | null;
  notes?: string | null;
};

/** Latest reception/sales assignment still in progress (not completed). */
export function getOpenSiteVisit(siteVisits: SiteVisitSnapshot[]) {
  return (
    siteVisits.find((v) => v.status === "CHECKED_IN" || v.status === "SCHEDULED") ?? null
  );
}

/** Per-assignment status for Direct Booking — supports re-assign for another project. */
export function resolveDirectLeadAssignmentStatus(
  lead: { siteVisitStatus: string; intentType?: string | null },
  siteVisits: SiteVisitSnapshot[]
) {
  const openVisit = getOpenSiteVisit(siteVisits);
  const globallyBooked = (lead.intentType ?? "").includes("|booked");
  const globallyVisitDone = lead.siteVisitStatus === "COMPLETED";

  if (openVisit) {
    return {
      hasOpenAssignment: true,
      openSiteVisitId: openVisit.id,
      currentProjectId: openVisit.projectId ?? null,
      currentProjectName: openVisit.projectName ?? null,
      siteVisitDone: false,
      isBooked: false,
      priorBooked: globallyBooked,
    };
  }

  return {
    hasOpenAssignment: false,
    openSiteVisitId: null,
    currentProjectId: null,
    currentProjectName: null,
    siteVisitDone: globallyVisitDone,
    isBooked: globallyBooked,
    priorBooked: globallyBooked,
  };
}

async function findOpenSiteVisitForLead(leadRegistryId: string) {
  return prisma.siteVisit.findFirst({
    where: {
      leadId: leadRegistryId,
      status: { in: ["CHECKED_IN", "SCHEDULED"] },
    },
    orderBy: { checkedInAt: "desc" },
  });
}

async function completeOpenSiteVisit(
  leadRegistryId: string,
  salesUserId: string,
  notes: string,
  fallback: {
    visitingCpId?: string | null;
    visitingCpName?: string | null;
    publicLeadId?: string | null;
    eoiCpLeadId?: string | null;
    projectId?: string | null;
    projectName?: string | null;
  }
) {
  const openVisit = await findOpenSiteVisitForLead(leadRegistryId);
  if (openVisit) {
    return prisma.siteVisit.update({
      where: { id: openVisit.id },
      data: {
        status: "COMPLETED",
        notes,
        salesUserId: openVisit.salesUserId ?? salesUserId,
      },
    });
  }

  return prisma.siteVisit.create({
    data: {
      leadId: leadRegistryId,
      salesUserId,
      status: "COMPLETED",
      notes,
      visitingCpId: fallback.visitingCpId || null,
      visitingCpName: fallback.visitingCpName || null,
      publicLeadId: fallback.publicLeadId || null,
      eoiCpLeadId: fallback.eoiCpLeadId || null,
      projectId: fallback.projectId || null,
      projectName: fallback.projectName || null,
    },
  });
}

/** Enrich a LeadRegistry row for booking dashboard lead picker. */
export function mapLeadForBookingSearch(
  lead: Awaited<ReturnType<typeof searchLeads>>[number]
) {
  const dayStart = startOfLocalDay();
  const todayVisit =
    lead.siteVisits.find((v) => v.checkedInAt >= dayStart) ?? null;
  const latestVisit = lead.siteVisits[0] ?? null;
  const visitForCp = todayVisit ?? latestVisit;
  const fromNotes = parseVisitingPartnerFromNotes(visitForCp?.notes ?? null);

  const structuredCpId = visitForCp?.visitingCpId || null;
  const structuredCpName = visitForCp?.visitingCpName || null;

  const visitingCp =
    structuredCpId || structuredCpName
      ? {
          partnerName:
            (structuredCpName && structuredCpName !== structuredCpId
              ? structuredCpName
              : null) ||
            fromNotes?.partnerName ||
            "Channel Partner",
          cpId: structuredCpId ?? lead.cpId ?? undefined,
          fromToday: Boolean(todayVisit),
          checkedInAt: visitForCp?.checkedInAt?.toISOString() ?? null,
          salesUserName: visitForCp?.salesUser?.name ?? null,
        }
      : fromNotes
        ? {
            partnerName: fromNotes.partnerName,
            cpId: fromNotes.cpId ?? lead.cpId ?? undefined,
            fromToday: Boolean(todayVisit),
            checkedInAt: visitForCp?.checkedInAt?.toISOString() ?? null,
            salesUserName: visitForCp?.salesUser?.name ?? null,
          }
        : lead.cpId
          ? {
              partnerName: "Channel Partner",
              cpId: lead.cpId,
              fromToday: Boolean(todayVisit),
              checkedInAt: todayVisit?.checkedInAt?.toISOString() ?? null,
              salesUserName: todayVisit?.salesUser?.name ?? null,
            }
          : null;

  const visitHistory = lead.siteVisits.map((v) => {
    const noteCp = parseVisitingPartnerFromNotes(v.notes ?? null);
    return {
      id: v.id,
      status: v.status,
      checkedInAt: v.checkedInAt.toISOString(),
      projectName: v.projectName || lead.project?.name || null,
      visitingCpId: v.visitingCpId || noteCp?.cpId || null,
      visitingCpName: v.visitingCpName || noteCp?.partnerName || null,
      salesUserName: v.salesUser?.name ?? null,
      notes: v.notes,
    };
  });

  const isPresales = lead.source === "PRESALES";

  return {
    id: lead.id,
    leadId: lead.leadId,
    customerName: lead.customerName,
    customerEmail: lead.customerEmail,
    customerPhone: lead.customerPhone,
    source: lead.source,
    intentType: lead.intentType,
    cpId: lead.cpId,
    goyalCrmId: lead.goyalCrmId,
    goyalLeadCode: lead.goyalLeadCode,
    eoiCpLeadId: lead.eoiCpLeadId,
    siteVisitStatus: lead.siteVisitStatus,
    project: lead.project,
    assignedSales: lead.assignedSales,
    visitingCp,
    visitHistory,
    isPresales,
    todaySiteVisit: todayVisit
      ? {
          id: todayVisit.id,
          status: todayVisit.status,
          checkedInAt: todayVisit.checkedInAt.toISOString(),
          notes: todayVisit.notes,
          visitingCpId: todayVisit.visitingCpId,
          visitingCpName: todayVisit.visitingCpName,
          salesUser: todayVisit.salesUser,
        }
      : null,
  };
}

export async function assignLeadToSales(
  leadId: string,
  salesUserId: string,
  notes?: string,
  visiting?: {
    visitingPartnerCpId?: string;
    visitingPartnerName?: string;
    eoiCpLeadId?: string;
    projectId?: string;
    projectName?: string;
  }
) {
  const partnerNote =
    visiting?.visitingPartnerName || visiting?.visitingPartnerCpId
      ? `Visiting with partner: ${visiting.visitingPartnerName ?? visiting.visitingPartnerCpId}${
          visiting.visitingPartnerCpId ? ` (${visiting.visitingPartnerCpId})` : ""
        }`
      : undefined;
  const combinedNotes = [partnerNote, notes].filter(Boolean).join(" — ") || undefined;

  const salesUser = await prisma.user.findUnique({
    where: { id: salesUserId },
    select: { id: true, name: true },
  });
  if (!salesUser) {
    throw new Error("Salesperson not found");
  }

  const existing = await prisma.leadRegistry.findUnique({
    where: { id: leadId },
    select: { intentType: true, projectId: true, organizationId: true },
  });
  if (!existing) {
    throw new Error("Lead not found");
  }

  const localProjectId = await resolveLocalBookingProjectId(existing.organizationId, {
    projectId: visiting?.projectId,
    projectName: visiting?.projectName,
  });

  const baseIntent = stripBookedIntent(existing?.intentType);
  const nextIntent = visiting?.projectName
    ? `eoi:${visiting.projectName}`
    : baseIntent || undefined;

  const lead = await prisma.leadRegistry.update({
    where: { id: leadId },
    data: {
      assignedSalesId: salesUserId,
      siteVisitStatus: "COMPLETED",
      ...(visiting?.visitingPartnerCpId ? { cpId: visiting.visitingPartnerCpId } : {}),
      ...(visiting?.eoiCpLeadId ? { eoiCpLeadId: visiting.eoiCpLeadId } : {}),
      ...(localProjectId ? { projectId: localProjectId } : {}),
      ...(nextIntent ? { intentType: nextIntent } : {}),
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedSales: { select: { id: true, name: true, email: true } },
    },
  });

  const projectId = localProjectId || lead.project?.id || undefined;
  const projectName = visiting?.projectName || lead.project?.name || undefined;

  await prisma.siteVisit.create({
    data: {
      leadId,
      salesUserId,
      notes: combinedNotes,
      status: "COMPLETED",
      visitingCpId: visiting?.visitingPartnerCpId || null,
      visitingCpName: visiting?.visitingPartnerName || null,
      projectId: projectId || null,
      projectName: projectName || null,
      eoiCpLeadId: visiting?.eoiCpLeadId || lead.eoiCpLeadId || null,
      publicLeadId: lead.leadId,
    },
  });

  const { getTitanCRMProvider } = await import("@booking/integrations");
  try {
    await getTitanCRMProvider().syncSiteVisit({
      leadId: lead.leadId,
      salesUserId,
      notes: combinedNotes,
      ...(visiting?.visitingPartnerCpId
        ? { cpId: visiting.visitingPartnerCpId, cpName: visiting.visitingPartnerName }
        : {}),
    });
  } catch {
    /* non-blocking */
  }

  // Push site visit to Goyal Hariyana CRM when linked (or discoverable by phone)
  let crmSynced = false;
  let crmError: string | undefined;
  let crmId: string | null | undefined = lead.goyalCrmId;
  try {
    const { markGoyalSiteVisit, getGoyalCrmCapabilities, resolveGoyalLeadId } =
      await import("@booking/integrations");
    const caps = getGoyalCrmCapabilities();
    if (!crmId || !/^[0-9a-f-]{36}$/i.test(crmId)) {
      const resolved = await resolveGoyalLeadId({
        idOrCode: lead.goyalCrmId || lead.goyalLeadCode || lead.titanCrmId,
        phone: lead.customerPhone,
      });
      if (resolved) {
        crmId = resolved;
        await prisma.leadRegistry.update({
          where: { id: lead.id },
          data: { goyalCrmId: resolved },
        });
      }
    }
    if (crmId && caps.canBook) {
      await markGoyalSiteVisit(crmId, {
        siteVisit: true,
        siteVisitDone: true,
        notes: combinedNotes,
        visitingCpId: visiting?.visitingPartnerCpId,
        visitingCpName: visiting?.visitingPartnerName,
        salespersonName: salesUser?.name ?? undefined,
      });
      crmSynced = true;
    } else if (crmId) {
      crmError =
        "CRM site-visit skipped — set BEARER_AUTHORIZATION (permanent Partner token)";
      console.warn(`[assignLeadToSales] ${crmError}`);
    }
  } catch (e) {
    crmError = e instanceof Error ? e.message : "CRM site-visit sync failed";
    console.error("[assignLeadToSales] Goyal site visit sync failed", e);
  }

  // Push site-visit completed to EOI Partner Portal (by phone / CRM id when configured)
  try {
    const { notifyEoiPartnerPortalResolved } = await import("./eoi-cp-notify");
    await notifyEoiPartnerPortalResolved({
      event: "site_visit.completed",
      leadId: lead.leadId,
      eoiCpLeadId: visiting?.eoiCpLeadId || lead.eoiCpLeadId,
      cpId: visiting?.visitingPartnerCpId || lead.cpId,
      cpName: visiting?.visitingPartnerName,
      crmLeadId: crmId || lead.goyalCrmId || lead.titanCrmId,
      phone: lead.customerPhone,
      projectId,
      projectName,
      salespersonId: salesUserId,
      salespersonName: salesUser?.name,
      completedAt: new Date(),
    });
  } catch (e) {
    console.error("[assignLeadToSales] EOI_CP site visit notify failed", e);
  }

  return { lead, crmSynced, crmError };
}

export async function upsertLeadFromEoiCp(input: {
  leadId: string;
  eoiCpLeadId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  organizationId: string;
  projectId?: string;
  titanCrmId?: string;
  cpId?: string;
  intentType?: string;
}) {
  // EOI_CP stores the Goyal Hariyana CRM id in titanCrmId (UUID or EOI- leadCode).
  // Mirror it onto goyalCrmId so site-visit / book pushback can find the CRM row.
  const crmRef = input.titanCrmId?.trim() || undefined;
  const looksUuid = crmRef
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(crmRef)
    : false;
  const looksLeadCode = Boolean(crmRef && /^EOI-/i.test(crmRef));

  const projectNameFromIntent =
    input.intentType?.startsWith("eoi:") ? input.intentType.slice(4).replace(/\|booked$/i, "") : undefined;
  const localProjectId = await resolveLocalBookingProjectId(input.organizationId, {
    projectId: input.projectId,
    projectName: projectNameFromIntent,
  });

  return prisma.leadRegistry.upsert({
    where: { leadId: input.leadId },
    create: {
      leadId: input.leadId,
      eoiCpLeadId: input.eoiCpLeadId,
      organizationId: input.organizationId,
      ...(localProjectId ? { projectId: localProjectId } : {}),
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      source: LeadSource.CHANNEL_PARTNER,
      intentType: input.intentType,
      cpId: input.cpId,
      titanCrmId: crmRef,
      ...(looksUuid ? { goyalCrmId: crmRef } : {}),
      ...(looksLeadCode ? { goyalLeadCode: crmRef } : {}),
    },
    update: {
      eoiCpLeadId: input.eoiCpLeadId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      titanCrmId: crmRef ?? undefined,
      ...(looksUuid ? { goyalCrmId: crmRef } : {}),
      ...(looksLeadCode ? { goyalLeadCode: crmRef } : {}),
      intentType: input.intentType,
      ...(input.cpId ? { cpId: input.cpId } : {}),
      ...(localProjectId ? { projectId: localProjectId } : {}),
    },
  });
}

/** Materialize a Titan search hit into LeadRegistry so reception can assign. */
export async function upsertLeadFromTitanSearch(input: {
  organizationId: string;
  registeredById?: string;
  titanCrmId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  cpId?: string;
  partnerName?: string;
  intentType?: string;
  publicLeadId?: string;
}) {
  const phone = input.customerPhone.replace(/\D/g, "").slice(-10) || input.customerPhone;
  const leadId =
    input.publicLeadId?.trim() ||
    (input.cpId
      ? `TITAN-${input.cpId}-${phone.slice(-4)}`
      : `TITAN-${input.titanCrmId}`.slice(0, 40));

  const existingByTitan = await prisma.leadRegistry.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [
        { leadId },
        { titanCrmId: input.titanCrmId, ...(input.cpId ? { cpId: input.cpId } : {}) },
        ...(input.cpId
          ? [{ customerPhone: { contains: phone }, cpId: input.cpId }]
          : []),
      ],
    },
  });

  if (existingByTitan) {
    return prisma.leadRegistry.update({
      where: { id: existingByTitan.id },
      data: {
        customerName: input.customerName,
        customerPhone: phone,
        customerEmail: input.customerEmail,
        titanCrmId: input.titanCrmId,
        ...(input.cpId ? { cpId: input.cpId } : {}),
        ...(input.intentType ? { intentType: input.intentType } : {}),
        source: input.cpId ? LeadSource.CHANNEL_PARTNER : existingByTitan.source,
      },
    });
  }

  try {
    return await prisma.leadRegistry.create({
      data: {
        leadId,
        organizationId: input.organizationId,
        customerName: input.customerName,
        customerPhone: phone,
        customerEmail: input.customerEmail,
        source: input.cpId ? LeadSource.CHANNEL_PARTNER : LeadSource.OTHER,
        cpId: input.cpId,
        titanCrmId: input.titanCrmId,
        intentType: input.intentType ?? input.partnerName,
        registeredById: input.registeredById,
      },
    });
  } catch {
    // Race / unique leadId — fetch and update
    const again = await prisma.leadRegistry.findUnique({ where: { leadId } });
    if (!again) throw new Error("Failed to upsert Titan lead");
    return prisma.leadRegistry.update({
      where: { id: again.id },
      data: {
        customerName: input.customerName,
        customerPhone: phone,
        titanCrmId: input.titanCrmId,
        ...(input.cpId ? { cpId: input.cpId } : {}),
      },
    });
  }
}

export async function getLeadBookingStatus(leadId: string) {
  const lead = await prisma.leadRegistry.findUnique({
    where: { leadId },
    include: {
      blocks: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
        },
      },
      bookings: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        include: { payments: true, unit: true },
      },
      siteVisits: { orderBy: { checkedInAt: "desc" }, take: 5 },
    },
  });
  if (!lead) return null;

  const block = lead.blocks[0];
  const booking = lead.bookings[0];
  const timeline: Array<{ event: string; at: string; detail?: string }> = [
    { event: "LEAD_REGISTERED", at: lead.createdAt.toISOString() },
  ];

  for (const visit of lead.siteVisits) {
    timeline.push({
      event: "SITE_VISIT",
      at: (visit.checkedInAt ?? visit.createdAt).toISOString(),
      detail: visit.status,
    });
  }
  if (block) {
    timeline.push({
      event: "UNIT_BLOCKED",
      at: block.createdAt.toISOString(),
      detail: block.unit.unitNumber,
    });
  }
  if (booking) {
    timeline.push({
      event: booking.status === "CONFIRMED" ? "BOOKING_CONFIRMED" : "BOOKING_SUBMITTED",
      at: (booking.submittedAt ?? booking.bookedAt).toISOString(),
      detail: booking.status,
    });
  }

  return {
    leadId: lead.leadId,
    bookingLeadId: lead.leadId,
    titanCrmId: lead.titanCrmId,
    block: block
      ? {
          id: block.id,
          unitNumber: block.unit.unitNumber,
          projectName: block.unit.floor.tower.project.name,
          expiresAt: block.expiresAt.toISOString(),
        }
      : null,
    booking: booking
      ? {
          id: booking.id,
          status: booking.status,
          unitNumber: booking.unit.unitNumber,
          totalPrice: Number(booking.totalPrice),
          payments: booking.payments.map((p: { stageName: string; amountDue: unknown; amountPaid: unknown }) => ({
            stageName: p.stageName,
            amountDue: Number(p.amountDue),
            amountPaid: Number(p.amountPaid),
          })),
        }
      : null,
    timeline: timeline.sort((a, b) => a.at.localeCompare(b.at)),
  };
}

/** Materialize a Goyal Hariyana CRM EOI lead into LeadRegistry (no check-in yet). */
export async function upsertLeadFromGoyalCrm(input: {
  organizationId: string;
  registeredById?: string;
  goyalCrmId: string;
  goyalLeadCode?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  projectName?: string | null;
}) {
  const phone = input.customerPhone.replace(/\D/g, "").slice(-10) || input.customerPhone;
  const publicLeadId =
    input.goyalLeadCode?.trim() ||
    `GOYAL-${input.goyalCrmId.slice(0, 8)}-${phone.slice(-4)}`;

  const existing = await prisma.leadRegistry.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: [{ goyalCrmId: input.goyalCrmId }, { leadId: publicLeadId }],
    },
  });

  const data = {
    customerName: input.customerName,
    customerPhone: phone,
    customerEmail: input.customerEmail ?? undefined,
    goyalCrmId: input.goyalCrmId,
    goyalLeadCode: input.goyalLeadCode ?? undefined,
    source: LeadSource.PRESALES,
    intentType: input.projectName ? `eoi:${input.projectName}` : "eoi",
    registeredById: input.registeredById,
  };

  if (existing) {
    return prisma.leadRegistry.update({
      where: { id: existing.id },
      data,
    });
  }

  try {
    return await prisma.leadRegistry.create({
      data: {
        leadId: publicLeadId,
        organizationId: input.organizationId,
        ...data,
      },
    });
  } catch {
    const again = await prisma.leadRegistry.findFirst({
      where: {
        organizationId: input.organizationId,
        OR: [{ goyalCrmId: input.goyalCrmId }, { leadId: publicLeadId }],
      },
    });
    if (!again) throw new Error("Failed to upsert Goyal CRM lead");
    return prisma.leadRegistry.update({ where: { id: again.id }, data });
  }
}

/**
 * Reception: assign a Goyal CRM lead to a sales user without marking site visit done.
 * Sales later marks site visit / booked from Direct Booking.
 */
export async function assignGoyalLeadToSales(input: {
  organizationId: string;
  registeredById?: string;
  salesUserId: string;
  goyalCrmId: string;
  goyalLeadCode?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  projectName?: string | null;
  notes?: string;
}) {
  const lead = await upsertLeadFromGoyalCrm(input);
  return prisma.leadRegistry.update({
    where: { id: lead.id },
    data: {
      assignedSalesId: input.salesUserId,
      siteVisitStatus: "SCHEDULED",
    },
    include: {
      assignedSales: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function listAssignedDirectLeads(salesUserId: string, organizationId: string) {
  const rows = await prisma.leadRegistry.findMany({
    where: {
      organizationId,
      assignedSalesId: salesUserId,
    },
    include: {
      assignedSales: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
      siteVisits: {
        orderBy: { checkedInAt: "desc" },
        take: 10,
        include: { salesUser: { select: { id: true, name: true } } },
      },
      bookings: {
        select: { id: true, status: true, bookedAt: true },
        orderBy: { bookedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return rows.map((lead) => {
    const mapped = mapLeadForBookingSearch(lead);
    const globallyBooked = (lead.intentType ?? "").includes("|booked");
    return {
      ...mapped,
      updatedAt: lead.updatedAt,
      bookings: lead.bookings,
      isBooked: globallyBooked,
      siteVisitDone: lead.siteVisitStatus === "COMPLETED",
    };
  });
}

/** Sales Direct Booking: mark site visit done locally + push Goyal CRM when possible. */
export async function markDirectLeadSiteVisitDone(input: {
  leadRegistryId: string;
  salesUserId: string;
  notes?: string;
}) {
  const lead = await prisma.leadRegistry.findUnique({ where: { id: input.leadRegistryId } });
  if (!lead) throw new Error("Lead not found");
  if (lead.assignedSalesId !== input.salesUserId) throw new Error("Lead is not assigned to you");

  const openVisit = await findOpenSiteVisitForLead(lead.id);
  const cpId = openVisit?.visitingCpId || lead.cpId;
  const cpName =
    (openVisit?.visitingCpName &&
    openVisit.visitingCpName !== openVisit.visitingCpId
      ? openVisit.visitingCpName
      : null) ||
    (cpId ? await resolveKnownCpName(lead.id, cpId) : null);

  const updated = await prisma.leadRegistry.update({
    where: { id: lead.id },
    data: { siteVisitStatus: "COMPLETED" },
  });

  await completeOpenSiteVisit(lead.id, input.salesUserId, input.notes ?? "Site visit done", {
    visitingCpId: cpId,
    visitingCpName: cpName,
    publicLeadId: lead.leadId,
    eoiCpLeadId: openVisit?.eoiCpLeadId || lead.eoiCpLeadId,
    projectId: openVisit?.projectId,
    projectName: openVisit?.projectName,
  });

  const salesUser = await prisma.user.findUnique({
    where: { id: input.salesUserId },
    select: { name: true },
  });

  let crmSynced = false;
  let crmError: string | undefined;
  let crmLead: unknown;
  try {
    const { markGoyalSiteVisit, getGoyalCrmCapabilities, resolveGoyalLeadId } =
      await import("@booking/integrations");
    const caps = getGoyalCrmCapabilities();
    let crmId = lead.goyalCrmId;
    if (!crmId || !/^[0-9a-f-]{36}$/i.test(crmId)) {
      const resolved = await resolveGoyalLeadId({
        idOrCode: lead.goyalCrmId || lead.goyalLeadCode || lead.titanCrmId,
        phone: lead.customerPhone,
      });
      if (resolved) {
        crmId = resolved;
        await prisma.leadRegistry.update({
          where: { id: lead.id },
          data: { goyalCrmId: resolved },
        });
      }
    }
    if (!crmId) {
      crmError = "No Goyal CRM id — site visit marked locally only";
    } else if (!caps.canBook) {
      crmError = "BEARER_AUTHORIZATION required to push site visit to CRM";
    } else {
      crmLead = await markGoyalSiteVisit(crmId, {
        siteVisit: true,
        siteVisitDone: true,
        notes: input.notes,
        visitingCpId: cpId ?? undefined,
        visitingCpName: cpName ?? undefined,
        salespersonName: salesUser?.name ?? undefined,
      });
      crmSynced = true;
    }
  } catch (e) {
    crmError = e instanceof Error ? e.message : "CRM site visit sync failed";
  }

  try {
    const { notifyEoiPartnerPortalResolved } = await import("./eoi-cp-notify");
    const projectHint =
      openVisit?.projectName ||
      (typeof lead.intentType === "string" && lead.intentType.startsWith("eoi:")
        ? stripBookedIntent(lead.intentType).slice(4)
        : undefined);
    await notifyEoiPartnerPortalResolved({
      event: "site_visit.completed",
      leadId: lead.leadId,
      eoiCpLeadId: openVisit?.eoiCpLeadId || lead.eoiCpLeadId,
      cpId: cpId,
      cpName: cpName ?? undefined,
      crmLeadId: lead.goyalCrmId || lead.titanCrmId,
      phone: lead.customerPhone,
      projectName: projectHint,
      salespersonId: input.salesUserId,
      salespersonName: salesUser?.name,
      completedAt: new Date(),
    });
  } catch (e) {
    console.error("[markDirectLeadSiteVisitDone] EOI_CP notify failed", e);
  }

  return { lead: updated, crmSynced, crmError, crmLead };
}

/** Sales Direct Booking / Live Booking: mark booked (local always; CRM when possible). */
export async function markDirectLeadBooked(input: {
  leadRegistryId: string;
  salesUserId: string;
  bookedDate?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  communicationAddress?: string;
  permanentAddress?: string;
  occupation?: string;
  organizationName?: string;
  designation?: string;
  sourceOfFund?: string;
  sourceOfEnquiry?: string;
}) {
  const lead = await prisma.leadRegistry.findUnique({ where: { id: input.leadRegistryId } });
  if (!lead) throw new Error("Lead not found");
  if (lead.assignedSalesId && lead.assignedSalesId !== input.salesUserId) {
    throw new Error("Lead is not assigned to you");
  }

  // Ensure ownership for Direct Booking list + follow-ups
  if (!lead.assignedSalesId) {
    await prisma.leadRegistry.update({
      where: { id: lead.id },
      data: { assignedSalesId: input.salesUserId },
    });
  }

  const openVisit = await findOpenSiteVisitForLead(lead.id);
  const projectFromAssignment = openVisit?.projectName || undefined;
  const baseIntent = projectFromAssignment
    ? `eoi:${projectFromAssignment}`
    : stripBookedIntent(lead.intentType) || "booking";

  let crmSynced = false;
  let crmError: string | undefined;
  let crmLead: unknown;

  try {
    const { bookGoyalLead, getGoyalLead, getGoyalCrmCapabilities, resolveGoyalLeadId } =
      await import("@booking/integrations");
    const caps = getGoyalCrmCapabilities();
    let crmId = lead.goyalCrmId;
    if (!crmId || !/^[0-9a-f-]{36}$/i.test(crmId)) {
      const resolved = await resolveGoyalLeadId({
        idOrCode: lead.goyalCrmId || lead.goyalLeadCode || lead.titanCrmId,
        phone: lead.customerPhone,
      });
      if (resolved) {
        crmId = resolved;
        await prisma.leadRegistry.update({
          where: { id: lead.id },
          data: { goyalCrmId: resolved },
        });
      }
    }

    if (!crmId) {
      crmError = "No Goyal CRM id — marked booked locally only";
    } else if (!caps.canBook) {
      crmError = "BEARER_AUTHORIZATION required to push booking to CRM";
    } else {
      let existing: Record<string, unknown> = {};
      try {
        existing = (await getGoyalLead(crmId)) as unknown as Record<string, unknown>;
      } catch {
        /* use provided KYC only */
      }

      const pick = (key: string, fallback?: string) => {
        const fromInput = (input as Record<string, unknown>)[key];
        if (typeof fromInput === "string" && fromInput.trim()) return fromInput.trim();
        const fromCrm = existing[key];
        if (typeof fromCrm === "string" && fromCrm.trim()) return fromCrm.trim();
        return fallback ?? "";
      };

      const dayStart = startOfLocalDay();
      const todayVisit = await prisma.siteVisit.findFirst({
        where: { leadId: lead.id, checkedInAt: { gte: dayStart } },
        orderBy: { checkedInAt: "desc" },
      });
      const bookedWithCpId = todayVisit?.visitingCpId || lead.cpId || undefined;
      const bookedWithCpName =
        (bookedWithCpId ? await resolveKnownCpName(lead.id, bookedWithCpId) : null) ||
        undefined;

      const payload = {
        booked: true as const,
        bookedDate: input.bookedDate || new Date().toISOString().slice(0, 10),
        dateOfBirth: pick("dateOfBirth"),
        maritalStatus: pick("maritalStatus"),
        nationality: pick("nationality", "Indian"),
        communicationAddress: pick("communicationAddress"),
        permanentAddress: pick("permanentAddress"),
        occupation: pick("occupation"),
        organizationName: pick("organizationName"),
        designation: pick("designation"),
        sourceOfFund: pick("sourceOfFund"),
        sourceOfEnquiry: pick("sourceOfEnquiry", "Partner Portal"),
        ...(bookedWithCpId ? { channelPartnerId: bookedWithCpId } : {}),
        ...(bookedWithCpName ? { channelPartnerName: bookedWithCpName } : {}),
      };

      try {
        crmLead = await bookGoyalLead(crmId, payload);
        crmSynced = true;
      } catch (bookErr) {
        // partner_leads source may not require full EOI KYC — retry minimal payload
        try {
          crmLead = await bookGoyalLead(crmId, {
            booked: true,
            bookedDate: payload.bookedDate,
          });
          crmSynced = true;
        } catch {
          throw bookErr;
        }
      }
    }
  } catch (e) {
    crmError = e instanceof Error ? e.message : "CRM booking sync failed";
  }

  // Booking implies site visit done for the current assignment.
  const updated = await prisma.leadRegistry.update({
    where: { id: lead.id },
    data: {
      intentType: `${baseIntent}|booked`,
      siteVisitStatus: "COMPLETED",
      ...(openVisit?.projectId ? { projectId: openVisit.projectId } : {}),
    },
  });

  const resolvedCpName =
    (openVisit?.visitingCpName &&
    openVisit.visitingCpName !== openVisit.visitingCpId
      ? openVisit.visitingCpName
      : null) ||
    (lead.cpId ? await resolveKnownCpName(lead.id, lead.cpId) : null);

  const hadOpenAssignment = Boolean(openVisit);
  if (hadOpenAssignment || lead.siteVisitStatus !== "COMPLETED") {
    await completeOpenSiteVisit(
      lead.id,
      input.salesUserId,
      "Site visit completed with direct booking",
      {
        visitingCpId: openVisit?.visitingCpId || lead.cpId,
        visitingCpName: resolvedCpName,
        publicLeadId: lead.leadId,
        eoiCpLeadId: openVisit?.eoiCpLeadId || lead.eoiCpLeadId,
        projectId: openVisit?.projectId,
        projectName: openVisit?.projectName,
      }
    );

    if (lead.goyalCrmId) {
      try {
        const { markGoyalSiteVisit, getGoyalCrmCapabilities } = await import("@booking/integrations");
        if (getGoyalCrmCapabilities().canBook) {
          await markGoyalSiteVisit(lead.goyalCrmId, {
            siteVisit: true,
            siteVisitDone: true,
            notes: "Site visit completed with direct booking",
            visitingCpId: lead.cpId ?? undefined,
            visitingCpName: resolvedCpName ?? undefined,
          });
        }
      } catch {
        /* CRM site-visit best-effort before book */
      }
    }

    try {
      const { notifyEoiPartnerPortalResolved } = await import("./eoi-cp-notify");
      const projectHint =
        projectFromAssignment ||
        (typeof baseIntent === "string" && baseIntent.startsWith("eoi:")
          ? baseIntent.slice(4)
          : undefined);
      const salesUser = await prisma.user.findUnique({
        where: { id: input.salesUserId },
        select: { name: true },
      });
      await notifyEoiPartnerPortalResolved({
        event: "site_visit.completed",
        leadId: lead.leadId,
        eoiCpLeadId: lead.eoiCpLeadId,
        cpId: lead.cpId,
        cpName: resolvedCpName ?? undefined,
        crmLeadId: lead.goyalCrmId || lead.titanCrmId,
        phone: lead.customerPhone,
        projectName: projectHint,
        salespersonId: input.salesUserId,
        salespersonName: salesUser?.name,
        completedAt: new Date(),
      });
    } catch (e) {
      console.error("[markDirectLeadBooked] EOI_CP site_visit notify failed", e);
    }
  }

  // Resolve today's visiting CP for booking attribution
  const dayStart = startOfLocalDay();
  const todayVisit = await prisma.siteVisit.findFirst({
    where: { leadId: lead.id, checkedInAt: { gte: dayStart } },
    orderBy: { checkedInAt: "desc" },
  });
  const bookedWithCpId =
    todayVisit?.visitingCpId || lead.cpId || undefined;
  const bookedWithCpName =
    (todayVisit?.visitingCpName &&
    todayVisit.visitingCpName !== bookedWithCpId
      ? todayVisit.visitingCpName
      : null) ||
    (bookedWithCpId ? await resolveKnownCpName(lead.id, bookedWithCpId) : null) ||
    undefined;

  try {
    const { notifyEoiPartnerPortalResolved } = await import("./eoi-cp-notify");
    const projectHint =
      projectFromAssignment ||
      (typeof baseIntent === "string" && baseIntent.startsWith("eoi:")
        ? baseIntent.slice(4)
        : undefined);
    const salesUser = await prisma.user.findUnique({
      where: { id: input.salesUserId },
      select: { name: true },
    });
    await notifyEoiPartnerPortalResolved({
      event: "booking.confirmed",
      leadId: lead.leadId,
      eoiCpLeadId: openVisit?.eoiCpLeadId || lead.eoiCpLeadId,
      cpId: bookedWithCpId,
      cpName: bookedWithCpName,
      crmLeadId: lead.goyalCrmId || lead.titanCrmId,
      phone: lead.customerPhone,
      projectName: projectHint,
      salespersonId: input.salesUserId,
      salespersonName: salesUser?.name,
      completedAt: new Date(),
    });
  } catch (e) {
    console.error("[markDirectLeadBooked] EOI_CP notify failed", e);
  }

  return {
    lead: updated,
    crmSynced,
    crmError,
    crmLead,
    siteVisitDone: true,
    bookedWithCpId,
    bookedWithCpName,
  };
}
