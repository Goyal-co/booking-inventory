import { randomBytes } from "crypto";
import { prisma } from "../index";
import { calculateCostSheet, buildPage1Snapshot } from "./cost-sheet-engine";
import { createBlock as createBlockBase, BlockError } from "./blocks";
import { sendBlockNotificationEmail } from "./integration";

const DIGITAL_BOOKING_WINDOW_MS = 48 * 60 * 60 * 1000;

export interface CreateBlockWithCustomerInput {
  unitId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  saleablePricePerSqft?: number;
  leadId?: string;
  organizationId: string;
  isAdmin?: boolean;
}

function generateBookingToken() {
  return randomBytes(32).toString("hex");
}

function extendBookingWindow(from: Date) {
  const minimumExpiry = new Date(Date.now() + DIGITAL_BOOKING_WINDOW_MS);
  return from > minimumExpiry ? from : minimumExpiry;
}

export async function createBlockWithCustomer(input: CreateBlockWithCustomerInput) {
  const ctx = await import("./cost-sheet-engine").then((m) => m.getUnitPricingContext(input.unitId));
  if (!ctx) throw new BlockError("Unit not found", "NOT_FOUND");

  const saleablePrice =
    input.saleablePricePerSqft ?? ctx.saleablePricePerSqft;
  const costSheet = await calculateCostSheet(input.unitId, saleablePrice);
  if (!costSheet) throw new BlockError("Unable to calculate cost sheet", "NOT_FOUND");

  const base = await createBlockBase(input.unitId, input.userId, input.isAdmin ?? false);

  let leadRegistryId: string | undefined;
  if (input.leadId) {
    const lead = await prisma.leadRegistry.findUnique({ where: { leadId: input.leadId } });
    leadRegistryId = lead?.id;
  }

  const existingCustomer = await prisma.customer.findUnique({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.customerEmail,
      },
    },
  });

  const customer = existingCustomer
    ? await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          name: input.customerName,
          phone: input.customerPhone,
          leadId: input.leadId ?? undefined,
        },
      })
    : await prisma.customer.create({
        data: {
          name: input.customerName,
          email: input.customerEmail,
          phone: input.customerPhone,
          leadId: input.leadId,
          organizationId: input.organizationId,
        },
      });

  const bookingToken = generateBookingToken();
  const page1Snapshot = buildPage1Snapshot(ctx, costSheet);

  const block = await prisma.block.update({
    where: { id: base.block.id },
    data: {
      expiresAt: extendBookingWindow(base.block.expiresAt),
      customerId: customer.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      saleablePricePerSqft: saleablePrice,
      costSheetSnapshot: costSheet as object,
      bookingToken,
      leadId: leadRegistryId,
    },
  });

  await prisma.digitalBookingForm.create({
    data: {
      blockId: block.id,
      customerId: customer.id,
      page1Snapshot,
      status: "DRAFT",
    },
  });

  const project = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    select: { name: true, brochureUrl: true },
  });

  const customerBaseUrl = process.env.CUSTOMER_URL ?? process.env.SALES_URL ?? "http://localhost:3003";
  const customerUrl = `${customerBaseUrl}/booking/${bookingToken}`;
  const dashboardUrl = `${customerBaseUrl}/dashboard?token=${bookingToken}`;

  const emailResult = await sendBlockNotificationEmail({
    blockId: block.id,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    projectName: project?.name ?? ctx.projectName,
    unitNumber: ctx.unitNumber,
    towerName: ctx.towerName,
    bookingUrl: customerUrl,
    dashboardUrl,
    brochureUrl: project?.brochureUrl ?? undefined,
    leadId: input.leadId,
  });

  return { block, customer, costSheet, bookingToken, projectId: base.projectId, customerUrl, emailResult };
}

export interface AttachCustomerInput {
  blockId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  saleablePricePerSqft?: number;
  leadId?: string;
  organizationId: string;
}

/** Attach customer + digital form to an existing block (sales "Proceed to Booking" flow) */
export async function attachCustomerToBlock(input: AttachCustomerInput) {
  const block = await prisma.block.findFirst({
    where: { id: input.blockId, userId: input.userId },
    include: {
      unit: { include: { floor: { include: { tower: true } } } },
      digitalForm: true,
      customer: true,
    },
  });
  if (!block) throw new BlockError("Block not found", "NOT_FOUND");
  if (block.expiresAt <= new Date()) throw new BlockError("Block has expired", "EXPIRED");

  const ctx = await import("./cost-sheet-engine").then((m) => m.getUnitPricingContext(block.unitId));
  if (!ctx) throw new BlockError("Unit not found", "NOT_FOUND");

  const saleablePrice = input.saleablePricePerSqft ?? ctx.saleablePricePerSqft;
  const costSheet = await calculateCostSheet(block.unitId, saleablePrice);
  if (!costSheet) throw new BlockError("Unable to calculate cost sheet", "NOT_FOUND");

  if (block.digitalForm && block.bookingToken) {
    const refreshedBlock = await prisma.block.update({
      where: { id: block.id },
      data: {
        expiresAt: extendBookingWindow(block.expiresAt),
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        ...(input.saleablePricePerSqft != null
          ? { saleablePricePerSqft: input.saleablePricePerSqft, costSheetSnapshot: costSheet as object }
          : {}),
      },
      include: { customer: true },
    });

    if (input.saleablePricePerSqft != null) {
      await prisma.digitalBookingForm.update({
        where: { blockId: block.id },
        data: { page1Snapshot: buildPage1Snapshot(ctx, costSheet) },
      });
    }

    const project = await prisma.project.findUnique({
      where: { id: ctx.projectId },
      select: { name: true, brochureUrl: true },
    });

    const customerBaseUrl = process.env.CUSTOMER_URL ?? "http://localhost:3003";
    const customerUrl = `${customerBaseUrl}/booking/${refreshedBlock.bookingToken}`;
    const dashboardUrl = `${customerBaseUrl}/dashboard?token=${refreshedBlock.bookingToken}`;

    const emailResult = await sendBlockNotificationEmail({
      blockId: block.id,
      customerEmail: input.customerEmail,
      customerName: input.customerName,
      projectName: project?.name ?? ctx.projectName,
      unitNumber: ctx.unitNumber,
      towerName: ctx.towerName,
      bookingUrl: customerUrl,
      dashboardUrl,
      brochureUrl: project?.brochureUrl ?? undefined,
      leadId: input.leadId,
    });

    return {
      block: refreshedBlock,
      customer: refreshedBlock.customer,
      costSheet,
      bookingToken: refreshedBlock.bookingToken!,
      customerUrl,
      projectId: ctx.projectId,
      emailResult,
    };
  }

  let leadRegistryId: string | undefined;
  if (input.leadId) {
    const lead = await prisma.leadRegistry.findUnique({ where: { leadId: input.leadId } });
    leadRegistryId = lead?.id;
  }

  const customer = await prisma.customer.upsert({
    where: {
      organizationId_email: {
        organizationId: input.organizationId,
        email: input.customerEmail,
      },
    },
    update: {
      name: input.customerName,
      phone: input.customerPhone,
      leadId: input.leadId ?? undefined,
    },
    create: {
      name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
      leadId: input.leadId,
      organizationId: input.organizationId,
    },
  });

  const bookingToken = generateBookingToken();
  const page1Snapshot = buildPage1Snapshot(ctx, costSheet);

  const updatedBlock = await prisma.block.update({
    where: { id: block.id },
    data: {
      expiresAt: extendBookingWindow(block.expiresAt),
      customerId: customer.id,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      saleablePricePerSqft: saleablePrice,
      costSheetSnapshot: costSheet as object,
      bookingToken,
      leadId: leadRegistryId,
    },
  });

  await prisma.digitalBookingForm.upsert({
    where: { blockId: block.id },
    update: {
      customerId: customer.id,
      page1Snapshot,
      status: "DRAFT",
    },
    create: {
      blockId: block.id,
      customerId: customer.id,
      page1Snapshot,
      status: "DRAFT",
    },
  });

  const project = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    select: { name: true, brochureUrl: true },
  });

  const customerBaseUrl = process.env.CUSTOMER_URL ?? "http://localhost:3003";
  const customerUrl = `${customerBaseUrl}/booking/${bookingToken}`;
  const dashboardUrl = `${customerBaseUrl}/dashboard?token=${bookingToken}`;

  const emailResult = await sendBlockNotificationEmail({
    blockId: block.id,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
    projectName: project?.name ?? ctx.projectName,
    unitNumber: ctx.unitNumber,
    towerName: ctx.towerName,
    bookingUrl: customerUrl,
    dashboardUrl,
    brochureUrl: project?.brochureUrl ?? undefined,
    leadId: input.leadId,
  });

  return {
    block: updatedBlock,
    customer,
    costSheet,
    bookingToken,
    customerUrl,
    projectId: ctx.projectId,
    emailResult,
  };
}

export async function updateBlockCustomer(
  blockId: string,
  userId: string,
  data: Partial<{
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    saleablePricePerSqft: number;
  }>
) {
  const block = await prisma.block.findFirst({
    where: { id: blockId, userId },
    include: { unit: true },
  });
  if (!block) throw new BlockError("Block not found", "NOT_FOUND");

  let costSheetSnapshot = block.costSheetSnapshot;
  if (data.saleablePricePerSqft) {
    const sheet = await calculateCostSheet(block.unitId, data.saleablePricePerSqft);
    if (sheet) costSheetSnapshot = sheet as object;
  }

  return prisma.block.update({
    where: { id: blockId },
    data: {
      ...(data.customerName ? { customerName: data.customerName } : {}),
      ...(data.customerEmail ? { customerEmail: data.customerEmail } : {}),
      ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
      ...(data.saleablePricePerSqft ? { saleablePricePerSqft: data.saleablePricePerSqft } : {}),
      ...(costSheetSnapshot ? { costSheetSnapshot } : {}),
    },
  });
}
