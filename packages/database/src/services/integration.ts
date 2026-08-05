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

  // Only mark Partner Portal / Goyal CRM as booked after confirmation.
  // Pending digital submissions still sync Titan/Post above, but must not flip BOOKED early.
  const isConfirmed = booking.status === "CONFIRMED";
  const isEoiCpLead =
    booking.lead?.source === "CHANNEL_PARTNER" || Boolean(booking.lead?.eoiCpLeadId);
  if (isConfirmed && isEoiCpLead) {
    // Mark the original Goyal Hariyana CRM EOI lead as booked as well.
    // This staff route requires GOYAL_CRM_API_TOKEN and complete booking KYC.
    try {
      const {
        bookGoyalLead,
        getGoyalCrmCapabilities,
        getGoyalLead,
      } = await import("@booking/integrations");
      if (getGoyalCrmCapabilities().canBook) {
        const lookupId =
          booking.lead?.titanCrmId
          || booking.lead?.leadId;
        if (lookupId) {
          const crmLead = await getGoyalLead(lookupId);
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
        }
      } else {
        console.warn(
          "[syncBookingToIntegrations] CRM booking skipped — GOYAL_CRM_API_TOKEN not configured",
        );
      }
    } catch (e) {
      console.error("[syncBookingToIntegrations] Goyal CRM book failed", e);
    }

    try {
      const { notifyEoiPartnerPortal } = await import("./eoi-cp-notify");
      await notifyEoiPartnerPortal({
        event: "booking.confirmed",
        leadId: booking.lead?.leadId,
        eoiCpLeadId: booking.lead?.eoiCpLeadId,
        crmLeadId: booking.lead?.goyalCrmId || booking.lead?.titanCrmId,
        phone: booking.lead?.customerPhone || booking.customerPhone,
        projectId: booking.unit.floor.tower.project.id,
        projectName: booking.unit.floor.tower.project.name,
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
  return prisma.leadRegistry.findMany({
    where: {
      organizationId,
      OR: [
        { leadId: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q } },
        { customerName: { contains: q, mode: "insensitive" } },
        { titanCrmId: { contains: q, mode: "insensitive" } },
        { cpId: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      project: { select: { id: true, name: true } },
      assignedSales: { select: { id: true, name: true } },
      siteVisits: { orderBy: { checkedInAt: "desc" }, take: 3 },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function assignLeadToSales(
  leadId: string,
  salesUserId: string,
  notes?: string,
  visiting?: { visitingPartnerCpId?: string; visitingPartnerName?: string }
) {
  const partnerNote =
    visiting?.visitingPartnerName || visiting?.visitingPartnerCpId
      ? `Visiting with partner: ${visiting.visitingPartnerName ?? visiting.visitingPartnerCpId}${
          visiting.visitingPartnerCpId ? ` (${visiting.visitingPartnerCpId})` : ""
        }`
      : undefined;
  const combinedNotes = [partnerNote, notes].filter(Boolean).join(" — ") || undefined;

  const lead = await prisma.leadRegistry.update({
    where: { id: leadId },
    data: {
      assignedSalesId: salesUserId,
      siteVisitStatus: "CHECKED_IN",
      ...(visiting?.visitingPartnerCpId ? { cpId: visiting.visitingPartnerCpId } : {}),
    },
    include: { project: { select: { id: true, name: true } } },
  });

  await prisma.siteVisit.create({
    data: { leadId, salesUserId, notes: combinedNotes, status: "CHECKED_IN" },
  });

  const { getTitanCRMProvider } = await import("@booking/integrations");
  try {
    await getTitanCRMProvider().syncSiteVisit({
      leadId: lead.leadId,
      salesUserId,
      notes: combinedNotes,
    });
  } catch {
    /* non-blocking */
  }

  // Push site-visit completed to EOI Partner Portal (Channel Partner leads)
  if (lead.eoiCpLeadId || lead.source === "CHANNEL_PARTNER") {
    try {
      const { notifyEoiPartnerPortal } = await import("./eoi-cp-notify");
      await notifyEoiPartnerPortal({
        event: "site_visit.completed",
        leadId: lead.leadId,
        eoiCpLeadId: lead.eoiCpLeadId,
        crmLeadId: lead.goyalCrmId || lead.titanCrmId,
        phone: lead.customerPhone,
        projectId: lead.project?.id,
        projectName: lead.project?.name,
        completedAt: new Date(),
      });
    } catch (e) {
      console.error("[assignLeadToSales] EOI_CP site visit notify failed", e);
    }
  }

  return lead;
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
  return prisma.leadRegistry.upsert({
    where: { leadId: input.leadId },
    create: {
      leadId: input.leadId,
      eoiCpLeadId: input.eoiCpLeadId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      source: LeadSource.CHANNEL_PARTNER,
      intentType: input.intentType,
      cpId: input.cpId,
      titanCrmId: input.titanCrmId,
    },
    update: {
      eoiCpLeadId: input.eoiCpLeadId,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      titanCrmId: input.titanCrmId ?? undefined,
      intentType: input.intentType,
      ...(input.cpId ? { cpId: input.cpId } : {}),
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
  return prisma.leadRegistry.findMany({
    where: {
      organizationId,
      assignedSalesId: salesUserId,
      goyalCrmId: { not: null },
    },
    include: {
      assignedSales: { select: { id: true, name: true } },
      siteVisits: { orderBy: { checkedInAt: "desc" }, take: 3 },
      bookings: {
        select: { id: true, status: true, bookedAt: true },
        orderBy: { bookedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

/** Sales Direct Booking: mark site visit done locally + push Goyal CRM. */
export async function markDirectLeadSiteVisitDone(input: {
  leadRegistryId: string;
  salesUserId: string;
  notes?: string;
}) {
  const lead = await prisma.leadRegistry.findUnique({ where: { id: input.leadRegistryId } });
  if (!lead) throw new Error("Lead not found");
  if (lead.assignedSalesId !== input.salesUserId) throw new Error("Lead is not assigned to you");
  if (!lead.goyalCrmId) throw new Error("Lead has no Goyal CRM id");

  const updated = await prisma.leadRegistry.update({
    where: { id: lead.id },
    data: { siteVisitStatus: "COMPLETED" },
  });

  await prisma.siteVisit.create({
    data: {
      leadId: lead.id,
      salesUserId: input.salesUserId,
      status: "COMPLETED",
      notes: input.notes,
    },
  });

  let crmSynced = false;
  let crmError: string | undefined;
  let crmLead: unknown;
  try {
    const { markGoyalSiteVisit, getGoyalCrmCapabilities } = await import("@booking/integrations");
    const caps = getGoyalCrmCapabilities();
    if (!caps.staffApi) {
      crmError = "GOYAL_CRM_API_TOKEN required to push site visit to CRM";
    } else {
      crmLead = await markGoyalSiteVisit(lead.goyalCrmId, {
        siteVisit: true,
        siteVisitDone: true,
        notes: input.notes,
      });
      crmSynced = true;
    }
  } catch (e) {
    crmError = e instanceof Error ? e.message : "CRM site visit sync failed";
  }

  // Always push portal status when local site visit is marked done.
  // Prefer CRM sync success, but still notify with local identifiers.
  try {
    const { notifyEoiPartnerPortal } = await import("./eoi-cp-notify");
    const projectHint =
      typeof lead.intentType === "string" && lead.intentType.startsWith("eoi:")
        ? lead.intentType.slice(4)
        : undefined;
    await notifyEoiPartnerPortal({
      event: "site_visit.completed",
      leadId: lead.leadId,
      eoiCpLeadId: lead.eoiCpLeadId,
      crmLeadId: lead.goyalCrmId || lead.titanCrmId,
      phone: lead.customerPhone,
      projectName: projectHint,
      completedAt: new Date(),
    });
  } catch (e) {
    console.error("[markDirectLeadSiteVisitDone] EOI_CP notify failed", e);
  }

  return { lead: updated, crmSynced, crmError, crmLead };
}

/** Sales Direct Booking: mark booked in Goyal CRM (no inventory booking form). */
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
  if (lead.assignedSalesId !== input.salesUserId) throw new Error("Lead is not assigned to you");
  if (!lead.goyalCrmId) throw new Error("Lead has no Goyal CRM id");

  let crmSynced = false;
  let crmError: string | undefined;
  let crmLead: unknown;

  try {
    const { bookGoyalLead, getGoyalLead, getGoyalCrmCapabilities } = await import(
      "@booking/integrations"
    );
    const caps = getGoyalCrmCapabilities();
    if (!caps.staffApi) {
      crmError = "GOYAL_CRM_API_TOKEN required to push booking to CRM";
    } else {
      let existing: Record<string, unknown> = {};
      try {
        existing = (await getGoyalLead(lead.goyalCrmId)) as unknown as Record<string, unknown>;
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

      const payload = {
        booked: true as const,
        bookedDate: input.bookedDate ?? new Date().toISOString().slice(0, 10),
        dateOfBirth: pick("dateOfBirth"),
        maritalStatus: pick("maritalStatus"),
        nationality: pick("nationality", "Indian"),
        communicationAddress: pick("communicationAddress"),
        permanentAddress: pick("permanentAddress"),
        occupation: pick("occupation"),
        organizationName: pick("organizationName"),
        designation: pick("designation"),
        sourceOfFund: pick("sourceOfFund"),
        sourceOfEnquiry: pick("sourceOfEnquiry", "Direct Booking"),
      };

      const missing = Object.entries(payload)
        .filter(([k, v]) => k !== "booked" && k !== "bookedDate" && !String(v).trim())
        .map(([k]) => k);

      if (missing.length) {
        throw new Error(
          `EOI book needs KYC fields: ${missing.join(", ")}. Fill them in Direct Booking and retry.`
        );
      }

      crmLead = await bookGoyalLead(lead.goyalCrmId, payload);
      crmSynced = true;
    }
  } catch (e) {
    crmError = e instanceof Error ? e.message : "CRM book sync failed";
  }

  // Local note via siteVisitStatus — no inventory unit booking created
  const updated = await prisma.leadRegistry.update({
    where: { id: lead.id },
    data: {
      intentType: crmSynced
        ? `${lead.intentType ?? "eoi"}|booked`
        : lead.intentType,
      siteVisitStatus:
        lead.siteVisitStatus === "NOT_SCHEDULED" ? "COMPLETED" : lead.siteVisitStatus,
    },
  });

  if (crmSynced) {
    try {
      const { notifyEoiPartnerPortal } = await import("./eoi-cp-notify");
      const projectHint =
        typeof lead.intentType === "string" && lead.intentType.startsWith("eoi:")
          ? lead.intentType.slice(4).replace(/\|booked$/, "")
          : undefined;
      await notifyEoiPartnerPortal({
        event: "booking.confirmed",
        leadId: lead.leadId,
        eoiCpLeadId: lead.eoiCpLeadId,
        crmLeadId: lead.goyalCrmId || lead.titanCrmId,
        phone: lead.customerPhone,
        projectName: projectHint,
        completedAt: new Date(),
      });
    } catch (e) {
      console.error("[markDirectLeadBooked] EOI_CP notify failed", e);
    }
  }

  return { lead: updated, crmSynced, crmError, crmLead };
}
