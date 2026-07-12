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
      block: {
        include: {
          unit: {
            include: {
              floor: { include: { tower: { include: { project: true } } } },
            },
          },
        },
      },
      documents: true,
    },
  });
  if (!form) return null;
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

  if (!form || !form.block.customerName || !form.block.customerPhone) return null;
  if (form.block.expiresAt <= new Date()) {
    throw new BookingError("Block has expired", "EXPIRED");
  }
  if (form.status !== DigitalFormStatus.DRAFT) {
    throw new BookingError("Form already submitted", "ALREADY_SUBMITTED");
  }

  const projectId = form.block.unit.floor.tower.projectId;
  const project = form.block.unit.floor.tower.project;
  const requiresApproval = project.requiresBookingApproval === true;

  const activeTemplate = await prisma.bookingFormTemplate.findFirst({
    where: { projectId, isActive: true },
    orderBy: { version: "desc" },
  });

  const formSnapshot = {
    page1Snapshot: form.page1Snapshot,
    formData: form.formData,
    branding: {
      logoUrl: activeTemplate?.logoUrl ?? project.logoUrl ?? null,
      companyName: activeTemplate?.companyName ?? "Goyal & Co.",
      tagline: activeTemplate?.tagline ?? "creating landmarks since 1971",
      formTitle:
        activeTemplate?.formTitle ?? "APPLICATION FOR ALLOTMENT OF A RESIDENTIAL UNIT IN",
      supportEmail: activeTemplate?.supportEmail ?? null,
      primaryColor: activeTemplate?.primaryColor ?? project.primaryColor,
      projectName: project.name,
      unitNumber: form.block.unit.unitNumber,
      content: activeTemplate?.fieldMapping ?? {},
    },
    customerName: form.block.customerName,
    customerEmail: form.block.customerEmail,
    customerPhone: form.block.customerPhone,
    capturedAt: new Date().toISOString(),
  };

  const costSheet = form.block.costSheetSnapshot as {
    grossApartmentValue?: number;
    paymentSchedule?: Array<{ stageName: string; amount: number }>;
  };
  const totalPrice = costSheet?.grossApartmentValue ?? 0;

  const booking = await prisma.$transaction(async (tx) => {
    const existingActive = await tx.booking.findFirst({
      where: {
        unitId: form.block.unitId,
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
    });
    if (existingActive) {
      throw new BookingError("Unit already booked or pending approval", "ALREADY_BOOKED");
    }

    const b = await tx.booking.create({
      data: {
        unitId: form.block.unitId,
        userId: form.block.userId,
        customerId: form.block.customerId,
        customerName: form.block.customerName!,
        customerPhone: form.block.customerPhone!,
        customerEmail: form.block.customerEmail,
        costSheetSnapshot: form.block.costSheetSnapshot ?? {},
        formSnapshot: formSnapshot as object,
        totalPrice,
        status: requiresApproval ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
        digitalFormStatus: "SUBMITTED",
        submittedAt: new Date(),
        leadId: form.block.leadId,
      },
    });

    if (costSheet?.paymentSchedule?.length) {
      for (const stage of costSheet.paymentSchedule) {
        await tx.paymentRecord.create({
          data: {
            bookingId: b.id,
            customerId: form.block.customerId,
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
        where: { id: form.block.id },
        data: { expiresAt: new Date(Date.now() + PENDING_BLOCK_EXTENSION_MS) },
      });
      // Re-attach form to block while pending approval so customer token still works
      await tx.digitalBookingForm.update({
        where: { id: form.id },
        data: { blockId: form.block.id },
      });
      await tx.unit.update({
        where: { id: form.block.unitId },
        data: { status: UnitStatus.BLOCKED },
      });
    } else {
      await tx.unit.update({
        where: { id: form.block.unitId },
        data: { status: UnitStatus.BOOKED },
      });
      await tx.block.deleteMany({ where: { unitId: form.block.unitId } });
    }

    await createAuditLog(
      {
        action: requiresApproval ? AuditAction.BOOKING_SUBMITTED : AuditAction.UNIT_BOOKED,
        entityType: "Booking",
        entityId: b.id,
        userId: form.block.userId,
        metadata: {
          unitId: form.block.unitId,
          customerName: form.block.customerName,
          projectId,
          source: "digital_form",
        },
      },
      tx
    );

    await createActivity(
      {
        projectId,
        userId: form.block.userId,
        message: requiresApproval
          ? `Customer submitted digital booking for ${form.block.unit.unitNumber} (pending approval)`
          : `Customer completed digital booking for ${form.block.unit.unitNumber}`,
        unitId: form.block.unitId,
      },
      tx
    );

    return b;
  });

  await createNotification({
    userId: form.block.userId,
    type: NotificationType.SYSTEM,
    title: requiresApproval ? "Digital booking pending approval" : "Digital booking confirmed",
    message: `${form.block.customerName} submitted the booking form for ${form.block.unit.unitNumber}`,
    metadata: { link: "/app/bookings" },
  });

  await syncBookingToIntegrations(booking.id);
  return booking;
}

export async function addBookingDocument(
  token: string,
  type: "PAN" | "AADHAAR" | "SIGNATURE" | "OTHER",
  fileName: string,
  fileUrl: string
) {
  const form = await getDigitalFormByToken(token);
  if (!form) return null;
  return prisma.bookingDocument.create({
    data: {
      digitalFormId: form.id,
      customerId: form.block.customerId,
      type,
      fileName,
      fileUrl,
    },
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
