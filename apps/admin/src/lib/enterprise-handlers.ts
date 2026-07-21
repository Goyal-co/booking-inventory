import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  calculateCostSheet,
  retryIntegrationSync,
  Prisma,
} from "@booking/database";
import {
  paymentScheduleTemplateSchema,
  otherChargeTemplateSchema,
  constructionReportSchema,
  pricingDefaultsSchema,
  unitMasterRowSchema,
  bookingFormTemplateSchema,
} from "@booking/validators";
import { getAdminUser, denyUnlessProjectAccess } from "./project-access";

export async function GET_paymentSchedules(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const schedules = await prisma.paymentScheduleTemplate.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ schedules });
}

export async function POST_paymentSchedule(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = paymentScheduleTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const schedule = body.id
    ? await prisma.paymentScheduleTemplate.update({
        where: { id: String(body.id) },
        data: parsed.data,
      })
    : await prisma.paymentScheduleTemplate.create({
        data: { projectId: id, ...parsed.data },
      });
  return NextResponse.json({ schedule }, { status: body.id ? 200 : 201 });
}

export async function DELETE_paymentSchedule(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;
  const scheduleId = req.nextUrl.searchParams.get("scheduleId");
  if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });
  await prisma.paymentScheduleTemplate.deleteMany({
    where: { id: scheduleId, projectId },
  });
  return NextResponse.json({ ok: true });
}

export async function GET_otherCharges(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const charges = await prisma.otherChargeTemplate.findMany({
    where: { projectId: id },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ charges });
}

export async function POST_otherCharge(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = otherChargeTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const charge = body.id
    ? await prisma.otherChargeTemplate.update({
        where: { id: String(body.id) },
        data: parsed.data,
      })
    : await prisma.otherChargeTemplate.create({
        data: { projectId: id, ...parsed.data },
      });
  return NextResponse.json({ charge }, { status: body.id ? 200 : 201 });
}

export async function DELETE_otherCharge(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;
  const chargeId = req.nextUrl.searchParams.get("chargeId");
  if (!chargeId) return NextResponse.json({ error: "chargeId required" }, { status: 400 });
  await prisma.otherChargeTemplate.deleteMany({
    where: { id: chargeId, projectId },
  });
  return NextResponse.json({ ok: true });
}

export async function POST_costSheetCalculate(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.unitId || !body.saleablePricePerSqft) {
    return NextResponse.json({ error: "unitId and saleablePricePerSqft required" }, { status: 400 });
  }
  const result = await calculateCostSheet(body.unitId, Number(body.saleablePricePerSqft));
  if (!result) return NextResponse.json({ error: "Unable to calculate" }, { status: 404 });
  return NextResponse.json({ costSheet: result });
}

export async function GET_unitMaster(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const rows = await prisma.unitMasterRow.findMany({
    where: { projectId: id },
    orderBy: [{ tower: "asc" }, { floor: "asc" }, { unitNo: "asc" }],
  });
  return NextResponse.json({ rows });
}

export async function POST_unitMasterRow(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = unitMasterRowSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const row = await prisma.unitMasterRow.upsert({
    where: {
      projectId_tower_unitNo: {
        projectId: id,
        tower: parsed.data.tower,
        unitNo: parsed.data.unitNo,
      },
    },
    create: { projectId: id, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json({ row });
}

export async function DELETE_unitMasterRow(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;
  const rowId = req.nextUrl.searchParams.get("rowId");
  if (!rowId) return NextResponse.json({ error: "rowId required" }, { status: 400 });
  await prisma.unitMasterRow.deleteMany({ where: { id: rowId, projectId } });
  return NextResponse.json({ ok: true });
}

export async function POST_unitMasterImport(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const rows = body.rows as Array<Record<string, unknown>>;
  if (!Array.isArray(rows)) return NextResponse.json({ error: "rows array required" }, { status: 400 });

  const created = await prisma.$transaction(
    rows.map((r) => {
      const payload = {
        tower: String(r.tower),
        unitNo: String(r.unitNo),
        floor: Number(r.floor),
        configuration: String(r.configuration ?? ""),
        saleableAreaSqft: Number(r.saleableAreaSqft),
        saleableAreaSqm: r.saleableAreaSqm ? Number(r.saleableAreaSqm) : null,
        carpetAreaSqft: r.carpetAreaSqft ? Number(r.carpetAreaSqft) : null,
        carpetAreaSqm: r.carpetAreaSqm ? Number(r.carpetAreaSqm) : null,
        balconyAreaSqft: r.balconyAreaSqft ? Number(r.balconyAreaSqft) : null,
        balconyAreaSqm: r.balconyAreaSqm ? Number(r.balconyAreaSqm) : null,
      };
      return prisma.unitMasterRow.upsert({
        where: {
          projectId_tower_unitNo: {
            projectId: id,
            tower: payload.tower,
            unitNo: payload.unitNo,
          },
        },
        create: { projectId: id, ...payload },
        update: payload,
      });
    })
  );

  return NextResponse.json({ imported: created.length });
}

export async function GET_bookingFormTemplate(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [template, project] = await Promise.all([
    prisma.bookingFormTemplate.findFirst({
      where: { projectId: id, isActive: true },
      orderBy: { version: "desc" },
    }),
    prisma.project.findUnique({
      where: { id },
      select: {
        name: true,
        logoUrl: true,
        primaryColor: true,
        brochureUrl: true,
      },
    }),
  ]);
  return NextResponse.json({ template, project });
}

export async function POST_bookingFormTemplate(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = bookingFormTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const emptyToNull = (v: string | null | undefined) => {
    if (v == null || v === "") return null;
    return v;
  };

  const data = {
    name: emptyToNull(parsed.data.name) ?? "Project booking form",
    logoUrl: emptyToNull(parsed.data.logoUrl),
    companyName: emptyToNull(parsed.data.companyName),
    tagline: emptyToNull(parsed.data.tagline),
    formTitle: emptyToNull(parsed.data.formTitle),
    formSubtitle: emptyToNull(parsed.data.formSubtitle),
    footerText: emptyToNull(parsed.data.footerText),
    supportEmail: emptyToNull(parsed.data.supportEmail),
    primaryColor: emptyToNull(parsed.data.primaryColor),
    pdfUrl: emptyToNull(parsed.data.pdfUrl),
    fieldMapping: (parsed.data.fieldMapping ?? {}) as Prisma.InputJsonValue,
  };

  const latest = await prisma.bookingFormTemplate.findFirst({
    where: { projectId: id },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.bookingFormTemplate.updateMany({
    where: { projectId: id },
    data: { isActive: false },
  });

  const template = await prisma.bookingFormTemplate.create({
    data: {
      projectId: id,
      ...data,
      version: (latest?.version ?? 0) + 1,
      isActive: true,
    },
  });

  // Keep project card branding in sync with the active form template
  await prisma.project.update({
    where: { id },
    data: {
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.primaryColor ? { primaryColor: data.primaryColor } : {}),
    },
  });

  return NextResponse.json({ template }, { status: 201 });
}

export async function GET_constructionReports(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const reports = await prisma.constructionReport.findMany({
    where: { projectId: id },
    orderBy: { publishedAt: "desc" },
  });
  return NextResponse.json({ reports });
}

export async function POST_constructionReport(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = constructionReportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const report = await prisma.constructionReport.create({
    data: { projectId: id, ...parsed.data },
  });
  return NextResponse.json({ report }, { status: 201 });
}

export async function GET_pricingDefaults(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      defaultSaleablePricePerSqft: true,
      gstPercent: true,
      brochureUrl: true,
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    defaults: {
      defaultSaleablePricePerSqft: project.defaultSaleablePricePerSqft
        ? Number(project.defaultSaleablePricePerSqft)
        : null,
      gstPercent: project.gstPercent != null ? Number(project.gstPercent) : 5,
      brochureUrl: project.brochureUrl ?? "",
      projectName: project.name,
    },
  });
}

export async function PATCH_pricingDefaults(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;
  const body = await req.json();
  const parsed = pricingDefaultsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(parsed.data.defaultSaleablePricePerSqft !== undefined
        ? { defaultSaleablePricePerSqft: parsed.data.defaultSaleablePricePerSqft }
        : {}),
      ...(parsed.data.gstPercent !== undefined ? { gstPercent: parsed.data.gstPercent } : {}),
      ...(parsed.data.brochureUrl !== undefined ? { brochureUrl: parsed.data.brochureUrl || null } : {}),
    },
  });
  return NextResponse.json({ project });
}

export async function POST_seedCostSheetTemplates(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;

  const existingSchedules = await prisma.paymentScheduleTemplate.count({ where: { projectId: id } });
  const existingCharges = await prisma.otherChargeTemplate.count({ where: { projectId: id } });
  if (existingSchedules > 0 || existingCharges > 0) {
    return NextResponse.json(
      { error: "Project already has payment schedules or other charges. Clear them first to seed defaults." },
      { status: 400 }
    );
  }

  const schedules = [
    { stageName: "Refundable Earnest Amount Deposits (READ)", stageType: "FIXED" as const, fixedAmount: 300000, sortOrder: 0 },
    { stageName: "Balance Booking Amount", stageType: "FORMULA" as const, formulaKey: "BALANCE_BOOKING", sortOrder: 1 },
    { stageName: "On Completion of Excavation and Foundation Work", stageType: "PERCENTAGE" as const, percentage: 10, sortOrder: 2 },
    { stageName: "On Completion of Basement Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 3 },
    { stageName: "On Completion of Ground Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 4 },
    { stageName: "On Completion of 1st Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 5 },
    { stageName: "On Completion of 3rd Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 6 },
    { stageName: "On Completion of 5th Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 7 },
    { stageName: "On Completion of 7th Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 8 },
    { stageName: "On Completion of 9th Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 9 },
    { stageName: "On Completion of 11th Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 10 },
    { stageName: "On Completion of 12th Floor Slab", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 11 },
    { stageName: "On Completion of Blockwork / Brickwork of 3rd Floor", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 12 },
    { stageName: "On Completion of Blockwork / Brickwork of 7th Floor", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 13 },
    { stageName: "On Completion of Blockwork / Brickwork of 11th Floor", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 14 },
    { stageName: "On Completion of Blockwork / Brickwork of 13th Floor", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 15 },
    { stageName: "On Completion of Internal Plastering of Flooring", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 16 },
    { stageName: "On Notice of Possession / Registration", stageType: "PERCENTAGE" as const, percentage: 5, sortOrder: 17 },
  ];

  const charges = [
    { name: "Clubhouse Charges", calcMode: "FIXED" as const, amount: 300000, sortOrder: 0 },
    { name: "Electricity & Water Infrastructure Charges", calcMode: "FIXED" as const, amount: 125000, sortOrder: 1 },
    { name: "STP / Partial Power Back up", calcMode: "FIXED" as const, amount: 150000, sortOrder: 2 },
    { name: "Legal Fees", calcMode: "FIXED" as const, amount: 25000, sortOrder: 3 },
    { name: "Estamping Charges", calcMode: "FIXED" as const, amount: 500, sortOrder: 4 },
    {
      name: "Maintenance Charges for 24 months",
      calcMode: "RATE_PER_AREA" as const,
      rate: 5,
      areaField: "saleable",
      months: 24,
      sortOrder: 5,
    },
    { name: "Refundable Corpus Fund", calcMode: "FIXED" as const, amount: 50000, sortOrder: 6 },
  ];

  await prisma.$transaction([
    ...schedules.map((s) => prisma.paymentScheduleTemplate.create({ data: { projectId: id, ...s } })),
    ...charges.map((c) => prisma.otherChargeTemplate.create({ data: { projectId: id, ...c } })),
  ]);

  return NextResponse.json({ seeded: true, schedules: schedules.length, charges: charges.length });
}

export async function GET_integrationSyncLogs(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const logs = await prisma.integrationSyncLog.findMany({
    where: status ? { status: status as "PENDING" | "SUCCESS" | "FAILED" } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ logs });
}

export async function POST_integrationRetry(_req: NextRequest, { params }: { params: Promise<{ logId: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { logId } = await params;
  const result = await retryIntegrationSync(logId);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function GET_bookingDigitalForm(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id },
    include: {
      digitalForm: { include: { documents: true } },
      unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const projectId = booking.unit.floor.tower.project.id;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const customerBaseUrl =
    process.env.CUSTOMER_URL?.replace(/\/+$/, "") ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3003" : undefined);
  const documents =
    booking.digitalForm?.documents.map((document) => ({
      ...document,
      fileUrl:
        document.fileUrl.startsWith("/") && customerBaseUrl
          ? `${customerBaseUrl}${document.fileUrl}`
          : document.fileUrl,
    })) ?? [];

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      projectName: booking.unit.floor.tower.project.name,
      unitNumber: booking.unit.unitNumber,
      towerName: booking.unit.floor.tower.name,
    },
    form: booking.digitalForm
      ? {
          id: booking.digitalForm.id,
          status: booking.digitalForm.status,
          page1Snapshot: booking.digitalForm.page1Snapshot,
          formData: booking.digitalForm.formData,
          submittedAt: booking.digitalForm.submittedAt,
          documents,
        }
      : null,
    formSnapshot: booking.formSnapshot,
  });
}

export async function GET_orgBookingFormTemplates(_req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const templates = await prisma.orgBookingFormTemplate.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ templates });
}

export async function POST_orgBookingFormTemplate(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = bookingFormTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (!parsed.data.name?.trim()) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }
  const emptyToNull = (v: string | null | undefined) => (v == null || v === "" ? null : v);
  const template = await prisma.orgBookingFormTemplate.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name.trim(),
      description: typeof body.description === "string" ? body.description : null,
      logoUrl: emptyToNull(parsed.data.logoUrl),
      companyName: emptyToNull(parsed.data.companyName),
      tagline: emptyToNull(parsed.data.tagline),
      formTitle: emptyToNull(parsed.data.formTitle),
      formSubtitle: emptyToNull(parsed.data.formSubtitle),
      footerText: emptyToNull(parsed.data.footerText),
      supportEmail: emptyToNull(parsed.data.supportEmail),
      primaryColor: emptyToNull(parsed.data.primaryColor),
      pdfUrl: emptyToNull(parsed.data.pdfUrl),
      fieldMapping: (parsed.data.fieldMapping ?? {}) as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ template }, { status: 201 });
}

export async function GET_orgBookingFormTemplate(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const template = await prisma.orgBookingFormTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function PUT_orgBookingFormTemplate(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.orgBookingFormTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const parsed = bookingFormTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const emptyToNull = (v: string | null | undefined) => (v == null || v === "" ? null : v);
  const template = await prisma.orgBookingFormTemplate.update({
    where: { id },
    data: {
      name: parsed.data.name?.trim() || existing.name,
      description: typeof body.description === "string" ? body.description : existing.description,
      logoUrl: emptyToNull(parsed.data.logoUrl),
      companyName: emptyToNull(parsed.data.companyName),
      tagline: emptyToNull(parsed.data.tagline),
      formTitle: emptyToNull(parsed.data.formTitle),
      formSubtitle: emptyToNull(parsed.data.formSubtitle),
      footerText: emptyToNull(parsed.data.footerText),
      supportEmail: emptyToNull(parsed.data.supportEmail),
      primaryColor: emptyToNull(parsed.data.primaryColor),
      pdfUrl: emptyToNull(parsed.data.pdfUrl),
      fieldMapping: (parsed.data.fieldMapping ?? {}) as Prisma.InputJsonValue,
    },
  });
  return NextResponse.json({ template });
}

export async function DELETE_orgBookingFormTemplate(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.orgBookingFormTemplate.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.orgBookingFormTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function POST_assignOrgTemplateToProject(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;
  const body = await req.json();
  const orgTemplateId = String(body.orgTemplateId ?? "");
  if (!orgTemplateId) {
    return NextResponse.json({ error: "orgTemplateId required" }, { status: 400 });
  }
  const orgTemplate = await prisma.orgBookingFormTemplate.findFirst({
    where: { id: orgTemplateId, organizationId: user.organizationId },
  });
  if (!orgTemplate) return NextResponse.json({ error: "Library template not found" }, { status: 404 });

  const latest = await prisma.bookingFormTemplate.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  await prisma.bookingFormTemplate.updateMany({
    where: { projectId },
    data: { isActive: false },
  });
  const template = await prisma.bookingFormTemplate.create({
    data: {
      projectId,
      name: orgTemplate.name,
      logoUrl: orgTemplate.logoUrl,
      companyName: orgTemplate.companyName,
      tagline: orgTemplate.tagline,
      formTitle: orgTemplate.formTitle,
      formSubtitle: orgTemplate.formSubtitle,
      footerText: orgTemplate.footerText,
      supportEmail: orgTemplate.supportEmail,
      primaryColor: orgTemplate.primaryColor,
      pdfUrl: orgTemplate.pdfUrl,
      fieldMapping: (orgTemplate.fieldMapping ?? {}) as Prisma.InputJsonValue,
      version: (latest?.version ?? 0) + 1,
      isActive: true,
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(orgTemplate.logoUrl ? { logoUrl: orgTemplate.logoUrl } : {}),
      ...(orgTemplate.primaryColor ? { primaryColor: orgTemplate.primaryColor } : {}),
    },
  });
  return NextResponse.json({ template }, { status: 201 });
}
