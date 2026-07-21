import {
  DigitalFormStatus,
  UnitStatus,
  BookingStatus,
  AuditAction,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../index";
import { syncBookingToIntegrations } from "./integration";
import { createAuditLog } from "./audit";
import { createActivity } from "./activity";
import { createNotification } from "./notifications";
import { BookingError } from "./bookings";

const PENDING_BLOCK_EXTENSION_MS = 48 * 60 * 60 * 1000;

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

export async function getDigitalFormByToken(token: string) {
  const form = await prisma.digitalBookingForm.findFirst({
    where: { block: { bookingToken: token } },
    include: {
      documents: true,
      block: {
        include: {
          unit: {
            include: {
              floor: { include: { tower: { include: { project: true } } } },
            },
          },
        },
      },
    },
  });
  if (!form?.block) return null;
  if (form.block.expiresAt <= new Date()) return null;
  return form;
}

export async function saveDigitalFormStep(
  token: string,
  step: string,
  data: Record<string, unknown>
) {
  const form = await getDigitalFormByToken(token);
  if (!form) return null;
  if (form.status !== "DRAFT") return null;

  const existing = (form.formData as Record<string, unknown>) ?? {};
  return prisma.digitalBookingForm.update({
    where: { id: form.id },
    data: {
      formData: { ...existing, [step]: data } as Prisma.InputJsonValue,
    },
  });
}

export async function submitDigitalForm(token: string) {
  const form = await prisma.digitalBookingForm.findFirst({
    where: { block: { bookingToken: token } },
    include: {
      documents: { select: { type: true } },
      block: {
        include: {
          unit: {
            include: {
              floor: { include: { tower: { include: { project: true } } } },
            },
          },
          user: { select: { id: true, name: true } },
          customer: true,
        },
      },
    },
  });

  if (!form?.block || !form.block.customerName || !form.block.customerPhone) return null;
  const block = form.block;
  if (block.expiresAt <= new Date()) {
    throw new BookingError("Block has expired", "EXPIRED");
  }
  if (form.status !== DigitalFormStatus.DRAFT) {
    throw new BookingError("Form already submitted", "ALREADY_SUBMITTED");
  }
  const uploadedTypes = new Set(form.documents.map((document) => document.type));
  const missingDocuments = [
    ["PAN", "PAN card"],
    ["AADHAAR", "Aadhaar card"],
    ["PAYMENT_PROOF", "cheque / payment proof"],
  ]
    .filter(([type]) => !uploadedTypes.has(type as "PAN" | "AADHAAR" | "PAYMENT_PROOF"))
    .map(([, label]) => label);
  if (missingDocuments.length) {
    throw new BookingError(
      `Upload required documents before submission: ${missingDocuments.join(", ")}`,
      "MISSING_DOCUMENTS"
    );
  }

  const projectId = block.unit.floor.tower.projectId;
  const project = block.unit.floor.tower.project;
  const requiresApproval = project.requiresBookingApproval === true;

  const activeTemplate = await prisma.bookingFormTemplate.findFirst({
    where: { projectId, isActive: true },
    orderBy: { version: "desc" },
  });

  const { resolveFormBranding } = await import("../lib/booking-form-branding");
  const branding = resolveFormBranding({
    projectName: project.name,
    unitNumber: block.unit.unitNumber,
    projectLogoUrl: project.logoUrl,
    projectPrimaryColor: project.primaryColor,
    template: activeTemplate,
  });

  const formSnapshot = {
    page1Snapshot: form.page1Snapshot,
    formData: form.formData,
    branding,
    customerName: block.customerName,
    customerEmail: block.customerEmail,
    customerPhone: block.customerPhone,
    capturedAt: new Date().toISOString(),
  };

  const costSheet = block.costSheetSnapshot as {
    grossApartmentValue?: number;
    paymentSchedule?: Array<{ stageName: string; amount: number }>;
  };
  const totalPrice = costSheet?.grossApartmentValue ?? 0;

  const booking = await prisma.$transaction(async (tx) => {
    const existingActive = await tx.booking.findFirst({
      where: {
        unitId: block.unitId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
    });
    if (existingActive) {
      throw new BookingError("Unit already booked or pending approval", "ALREADY_BOOKED");
    }

    const b = await tx.booking.create({
      data: {
        unitId: block.unitId,
        userId: block.userId,
        customerId: block.customerId,
        customerName: block.customerName!,
        customerPhone: block.customerPhone!,
        customerEmail: block.customerEmail,
        costSheetSnapshot: block.costSheetSnapshot ?? {},
        formSnapshot: formSnapshot as object,
        totalPrice,
        status: requiresApproval ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
        digitalFormStatus: "SUBMITTED",
        submittedAt: new Date(),
        leadId: block.leadId,
      },
    });

    if (costSheet?.paymentSchedule?.length) {
      for (const stage of costSheet.paymentSchedule) {
        await tx.paymentRecord.create({
          data: {
            bookingId: b.id,
            customerId: block.customerId,
            stageName: stage.stageName,
            amountDue: stage.amount,
            amountPaid: 0,
          },
        });
      }
    }

    // Detach from block before block delete so form + documents survive for sales print
    await tx.digitalBookingForm.update({
      where: { id: form.id },
      data: {
        bookingId: b.id,
        blockId: null,
        status: DigitalFormStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    if (requiresApproval) {
      await tx.block.update({
        where: { id: block.id },
        data: { expiresAt: new Date(Date.now() + PENDING_BLOCK_EXTENSION_MS) },
      });
      // Re-attach form to block while pending approval so customer token still works
      await tx.digitalBookingForm.update({
        where: { id: form.id },
        data: { blockId: block.id },
      });
      await tx.unit.update({
        where: { id: block.unitId },
        data: { status: UnitStatus.BLOCKED },
      });
    } else {
      await tx.unit.update({
        where: { id: block.unitId },
        data: { status: UnitStatus.BOOKED },
      });
      await tx.block.deleteMany({ where: { unitId: block.unitId } });
    }

    await createAuditLog(
      {
        action: requiresApproval ? AuditAction.BOOKING_SUBMITTED : AuditAction.UNIT_BOOKED,
        entityType: "Booking",
        entityId: b.id,
        userId: block.userId,
        metadata: {
          unitId: block.unitId,
          customerName: block.customerName,
          projectId,
          source: "digital_form",
        },
      },
      tx
    );

    await createActivity(
      {
        projectId,
        userId: block.userId,
        message: requiresApproval
          ? `Customer submitted digital booking for ${block.unit.unitNumber} (pending approval)`
          : `Customer completed digital booking for ${block.unit.unitNumber}`,
        unitId: block.unitId,
      },
      tx
    );

    return b;
  });

  await createNotification({
    userId: block.userId,
    type: NotificationType.SYSTEM,
    title: requiresApproval ? "Digital booking pending approval" : "Digital booking confirmed",
    message: `${block.customerName} submitted the booking form for ${block.unit.unitNumber}`,
    metadata: { link: "/app/bookings" },
  });

  await syncBookingToIntegrations(booking.id);
  return booking;
}

export async function addBookingDocument(
  token: string,
  type: "PAN" | "AADHAAR" | "SIGNATURE" | "PAYMENT_PROOF" | "OTHER",
  fileName: string,
  fileUrl: string
) {
  const form = await getDigitalFormByToken(token);
  if (!form?.block) return null;

  // EOI pattern: one document per type — replace previous upload.
  const existing = await prisma.bookingDocument.findFirst({
    where: { digitalFormId: form.id, type },
    orderBy: { createdAt: "desc" },
  });
  const replacedFileUrl = existing?.fileUrl ?? null;
  if (existing) {
    await prisma.bookingDocument.delete({ where: { id: existing.id } });
  }

  const doc = await prisma.bookingDocument.create({
    data: {
      digitalFormId: form.id,
      customerId: form.block.customerId,
      type,
      fileName,
      fileUrl,
    },
  });
  return { doc, replacedFileUrl };
}

export async function getBookingDocumentForToken(token: string, documentId: string) {
  const form = await getDigitalFormByToken(token);
  if (!form) return null;
  return prisma.bookingDocument.findFirst({
    where: { id: documentId, digitalFormId: form.id },
  });
}

export async function getBookingDocumentForAdmin(bookingId: string, documentId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: { digitalForm: true },
  });
  const digitalFormId = booking?.digitalForm?.id;
  if (!digitalFormId) return null;
  return prisma.bookingDocument.findFirst({
    where: { id: documentId, digitalFormId },
  });
}

export async function getCustomerDashboard(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: {
        include: {
          unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
          payments: true,
          digitalForm: true,
        },
      },
    },
  });
  if (!customer) return null;

  const projectIds = [...new Set(customer.bookings.map((b) => b.unit.floor.tower.projectId))];
  const constructionReports = await prisma.constructionReport.findMany({
    where: { projectId: { in: projectIds } },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });

  return { customer, constructionReports };
}
