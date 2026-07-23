import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  getUnits,
  getUnitById,
  createBlock,
  createBlockWithCustomer,
  attachCustomerToBlock,
  updateBlockCustomer,
  calculateCostSheet,
  getUnitPricingContext,
  releaseBlock,
  submitBooking,
  getActiveBlocksForUser,
  getBookingsForUser,
  getActivities,
  getHeatmapData,
  BlockError,
  BookingError,
  getSalesAnalyticsForProjects,
  getSalesAnalyticsCharts,
  getProjectFilters,
  canBlockUnits,
  formatBlockDuration,
  getProjectIdFromUnit,
  getBookingStats,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationStats,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  searchLeads,
  getDigitalFormByToken,
  sendBlockNotificationEmail,
  getCustomerBookingUrl,
  getCustomerDashboardUrl,
} from "@booking/database";
import { createBlockSchema, createBookingSchema, unitFiltersSchema, dashboardRangeSchema, attachCustomerToBlockSchema } from "@booking/validators";
import { emitRealtimeEvent } from "@booking/database";
import { REALTIME_EVENTS } from "@booking/realtime";

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return { ...session.user, projectIds: session.user.projectIds ?? [] };
}

export async function GET_units(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = unitFiltersSchema.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (!user.projectIds.includes(parsed.data.projectId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const units = await getUnits({ ...parsed.data, hideHold: true });
  return NextResponse.json({ units });
}

export async function GET_unit(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const unit = await getUnitById(id);
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const unitProjectId = await getProjectIdFromUnit(id);
  const hasAccess = unitProjectId ? user.projectIds.includes(unitProjectId) : false;
  if (unitProjectId && !hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json({ unit });
}

export async function POST_blocks(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createBlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const hasCustomer = Boolean(
      parsed.data.customerName && parsed.data.customerEmail && parsed.data.customerPhone
    );

    if (hasCustomer) {
      const result = await createBlockWithCustomer({
        unitId: parsed.data.unitId,
        userId: user.id,
        customerName: parsed.data.customerName!,
        customerEmail: parsed.data.customerEmail!,
        customerPhone: parsed.data.customerPhone!,
        saleablePricePerSqft: parsed.data.saleablePricePerSqft,
        leadId: parsed.data.leadId,
        organizationId: user.organizationId,
      });

      await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BLOCK_CREATED, {
        unitId: parsed.data.unitId,
        status: "BLOCKED",
      });

      return NextResponse.json({
        block: result.block,
        costSheet: result.costSheet,
        bookingToken: result.bookingToken,
        customerUrl: result.customerUrl,
        emailSent: !!result.emailResult?.success && !result.emailResult?.mocked,
        emailMocked: !!result.emailResult?.mocked,
        emailError: result.emailResult?.success
          ? undefined
          : result.emailResult?.error || "Failed to send booking email",
      });
    }

    const result = await createBlock(parsed.data.unitId, user.id);
    const unit = await getUnitById(parsed.data.unitId);

    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BLOCK_CREATED, {
      unitId: parsed.data.unitId,
      status: "BLOCKED",
      block: unit?.block,
    });
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: parsed.data.unitId,
      status: "BLOCKED",
      block: unit?.block,
    });

    return NextResponse.json({ block: result.block, unit });
  } catch (error) {
    if (error instanceof BlockError) {
      const status = error.code === "BLOCKING_DISABLED" ? 403 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error("POST /api/blocks failed", error);
    return NextResponse.json({ error: "Failed to block unit" }, { status: 500 });
  }
}

export async function DELETE_blocks(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Ownership check only — users may release blocks even after project access was revoked.
  try {
    const result = await releaseBlock(id, user.id);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BLOCK_RELEASED, {
      unitId: result.unitId,
      blockId: id,
    });
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      block: null,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof BlockError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    throw error;
  }
}

export async function POST_bookings(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await submitBooking(
      parsed.data.blockId,
      user.id,
      parsed.data.customerName,
      parsed.data.customerPhone
    );

    if (result.pending) {
      await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BOOKING_SUBMITTED, {
        unitId: result.unitId,
        status: "BLOCKED",
        bookingId: result.booking.id,
        pending: true,
      });
      await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
        unitId: result.unitId,
        status: "BLOCKED",
      });
    } else {
      await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BOOKING_CONFIRMED, {
        unitId: result.unitId,
        status: "BOOKED",
        bookingId: result.booking.id,
        block: null,
      });
    }

    return NextResponse.json({
      booking: {
        ...result.booking,
        totalPrice: result.booking.totalPrice.toString(),
        bookedAt: result.booking.bookedAt.toISOString(),
        submittedAt: result.booking.submittedAt.toISOString(),
      },
      pending: result.pending,
    });
  } catch (error) {
    if (error instanceof BookingError || error instanceof BlockError) {
      return NextResponse.json({ error: error.message, code: (error as BookingError).code }, { status: 400 });
    }
    throw error;
  }
}

export async function GET_myBlocks(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId =
    projectIdParam && projectIdParam !== "all" ? projectIdParam : undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const tower = req.nextUrl.searchParams.get("tower") ?? undefined;
  const bhk = req.nextUrl.searchParams.get("bhk") ?? undefined;
  const blocks = await getActiveBlocksForUser(user.id, projectId, search, { tower, bhk });
  return NextResponse.json({ blocks });
}

export async function GET_bookings(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId =
    projectIdParam && projectIdParam !== "all" ? projectIdParam : undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam && statusParam !== "all"
      ? (statusParam as import("@booking/database").BookingStatus)
      : undefined;
  const tower = req.nextUrl.searchParams.get("tower") ?? undefined;
  const bhk = req.nextUrl.searchParams.get("bhk") ?? undefined;
  const dateFrom = req.nextUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = req.nextUrl.searchParams.get("dateTo") ?? undefined;
  const bookings = await getBookingsForUser(user.id, projectId, search, {
    status,
    tower,
    bhk,
    dateFrom,
    dateTo,
  });
  const serialized = bookings.map((b) => ({
    id: b.id,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    totalPrice: b.totalPrice.toString(),
    bookedAt: b.bookedAt.toISOString(),
    submittedAt: b.submittedAt.toISOString(),
    status: b.status,
    adminComment: b.adminComment,
    hasForm: b.formSnapshot != null || b.digitalFormStatus === "SUBMITTED",
    digitalFormStatus: b.digitalFormStatus,
    projectId: b.unit.floor.tower.project.id,
    projectName: b.unit.floor.tower.project.name,
    unit: {
      unitNumber: b.unit.unitNumber,
      bhkType: b.unit.bhkType,
      carpetArea: b.unit.carpetArea ?? b.unit.floorPlanType?.carpetArea ?? null,
      superArea: b.unit.floorPlanType?.superArea ?? null,
      floor: { tower: { name: b.unit.floor.tower.name } },
    },
  }));
  return NextResponse.json({ bookings: serialized });
}

export async function GET_activities(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const activities = await getActivities(projectId);
  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      message: a.message,
      userName: a.user?.name,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function GET_heatmap(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const heatmap = await getHeatmapData(projectId);
  return NextResponse.json({ heatmap });
}

export async function GET_projects(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: {
      id: { in: user.projectIds },
      isPublished: true,
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      primaryColor: true,
      maxBlocksPerUser: true,
      blockDurationMs: true,
      lifecycleStatus: true,
      launchDate: true,
      requiresBookingApproval: true,
    },
    orderBy: { name: "asc" },
  });

  const enriched = projects.map((p) => ({
    ...p,
    canBlock: canBlockUnits(p.lifecycleStatus),
    blockDurationLabel: canBlockUnits(p.lifecycleStatus)
      ? formatBlockDuration(p.blockDurationMs)
      : null,
  }));

  return NextResponse.json({ projects: enriched });
}

export async function GET_dashboard(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rangeParam = req.nextUrl.searchParams.get("range") ?? "30d";
  const rangeParsed = dashboardRangeSchema.safeParse(rangeParam);
  const range = rangeParsed.success ? rangeParsed.data : "30d";

  const projects = await prisma.project.findMany({
    where: {
      id: { in: user.projectIds },
      isPublished: true,
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      primaryColor: true,
      maxBlocksPerUser: true,
      blockDurationMs: true,
      lifecycleStatus: true,
      launchDate: true,
      requiresBookingApproval: true,
    },
    orderBy: { name: "asc" },
  });

  const analyticsMap = await getSalesAnalyticsForProjects(
    user.id,
    projects.map((p) => p.id)
  );

  const chartsEntries = await Promise.all(
    projects.map(async (p) =>
      [p.id, await getSalesAnalyticsCharts(user.id, p.id, range)] as const
    )
  );
  const chartsMap = Object.fromEntries(chartsEntries);

  const enriched = projects.map((p) => ({
    ...p,
    canBlock: canBlockUnits(p.lifecycleStatus),
    blockDurationLabel: canBlockUnits(p.lifecycleStatus)
      ? formatBlockDuration(p.blockDurationMs)
      : null,
    analytics: analyticsMap[p.id] ?? {
      activeBlocks: 0,
      bookingsToday: 0,
      bookingsTotal: 0,
      pendingBookings: 0,
      myBookingsTotal: 0,
      totalBlocksEver: 0,
      conversionRate: 0,
      totalValue: 0,
    },
    charts: chartsMap[p.id],
  }));

  return NextResponse.json({ projects: enriched, range });
}

export async function GET_filters(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const filters = await getProjectFilters(projectId);

  return NextResponse.json({
    filters: filters.map((f) => ({
      dimension: f.dimension,
      label: f.label,
      options: f.options,
    })),
  });
}

export async function GET_booking_stats(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stats = await getBookingStats({
    projectIds: user.projectIds,
    userId: user.id,
  });
  return NextResponse.json({ stats });
}

export async function GET_notifications(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tab = req.nextUrl.searchParams.get("tab") ?? undefined;
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10);
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);

  const result = await getNotifications(user.id, { tab, page, limit });
  const notifStats = await getNotificationStats(user.id);
  return NextResponse.json({ ...result, stats: notifStats });
}

export async function GET_notifications_unread_count() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const count = await getUnreadNotificationCount(user.id);
  return NextResponse.json({ count });
}

export async function POST_notifications_read_all() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH_notification_read(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await markNotificationRead(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function GET_profile() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getUserProfile(user.id);
  return NextResponse.json({ profile });
}

export async function PATCH_profile(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const profile = await updateUserProfile(user.id, {
    name: body.name,
    mobile: body.mobile,
    notificationPrefs: body.notificationPrefs,
  });
  return NextResponse.json({ profile });
}

export async function POST_profile_password(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  try {
    await changeUserPassword(user.id, body.currentPassword, body.newPassword);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function GET_booking_receipt(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const booking = await prisma.booking.findFirst({
    where: { id, userId: user.id, status: "CONFIRMED" },
    include: {
      unit: {
        include: {
          floor: { include: { tower: { include: { project: true } } } },
          floorPlanType: true,
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Booking Receipt - ${booking.unit.unitNumber}</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:40px auto;padding:24px;color:#111}
h1{color:#b8860b;border-bottom:2px solid #b8860b;padding-bottom:8px}
.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
.label{color:#666}.value{font-weight:600}</style></head><body>
<h1>Goyal Hariyana Sales</h1>
<h2>Booking Receipt</h2>
<div class="row"><span class="label">Unit</span><span class="value">${booking.unit.unitNumber}</span></div>
<div class="row"><span class="label">Project</span><span class="value">${booking.unit.floor.tower.project.name}</span></div>
<div class="row"><span class="label">Tower</span><span class="value">${booking.unit.floor.tower.name}</span></div>
<div class="row"><span class="label">Customer</span><span class="value">${booking.customerName}</span></div>
<div class="row"><span class="label">Phone</span><span class="value">${booking.customerPhone}</span></div>
<div class="row"><span class="label">Amount</span><span class="value">₹${Number(booking.totalPrice).toLocaleString("en-IN")}</span></div>
<div class="row"><span class="label">Booked On</span><span class="value">${booking.bookedAt.toLocaleString()}</span></div>
<p style="margin-top:32px;font-size:12px;color:#888">This is a computer-generated receipt.</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="receipt-${booking.unit.unitNumber}.html"`,
    },
  });
}

export async function GET_block_detail(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const block = await prisma.block.findFirst({
    where: { id, userId: user.id },
    include: { digitalForm: true, customer: true, lead: true },
  });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ block });
}

export async function POST_block_customer(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const parsed = attachCustomerToBlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await attachCustomerToBlock({
      blockId: id,
      userId: user.id,
      organizationId: user.organizationId,
      ...parsed.data,
    });

    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BOOKING_SUBMITTED, {
      blockId: id,
      customerUrl: result.customerUrl,
    });

    return NextResponse.json({
      block: result.block,
      costSheet: result.costSheet,
      bookingToken: result.bookingToken,
      customerUrl: result.customerUrl,
      emailSent: !!result.emailResult?.success && !result.emailResult?.mocked,
      emailMocked: !!result.emailResult?.mocked,
      emailError:
        result.emailResult?.success && !result.emailResult?.mocked
          ? undefined
          : result.emailResult?.mocked
            ? "Email not sent — BREVO_API_KEY not loaded. Restart the sales app after saving .env.local"
            : result.emailResult?.error || "Failed to send booking email",
      ...(process.env.NODE_ENV !== "production"
        ? { devBookingUrl: result.customerUrl }
        : {}),
    });
  } catch (e) {
    if (e instanceof BlockError) return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    throw e;
  }
}

export async function PATCH_block_detail(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  try {
    const block = await updateBlockCustomer(id, user.id, body);
    return NextResponse.json({ block });
  } catch (e) {
    if (e instanceof BlockError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function POST_unit_costSheetPreview(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const unit = await getUnitById(id);
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const ctx = await getUnitPricingContext(id);
  const fromBody = body.saleablePricePerSqft;
  const price = Number(
    fromBody !== undefined && fromBody !== null && fromBody !== ""
      ? fromBody
      : ctx?.saleablePricePerSqft ?? 0
  );
  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Enter a saleable price per sq.ft to estimate", defaultSaleablePricePerSqft: ctx?.saleablePricePerSqft ?? 0 },
      { status: 400 }
    );
  }

  const costSheet = await calculateCostSheet(id, price);
  if (!costSheet) return NextResponse.json({ error: "Unable to calculate cost sheet" }, { status: 400 });
  return NextResponse.json({
    costSheet,
    defaultSaleablePricePerSqft: ctx?.saleablePricePerSqft ?? 0,
  });
}

export async function POST_block_costSheetPreview(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const block = await prisma.block.findFirst({ where: { id, userId: user.id } });
  if (!block) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const ctx = await getUnitPricingContext(block.unitId);
  const fromBody = body.saleablePricePerSqft;
  const price = Number(
    fromBody !== undefined && fromBody !== null && fromBody !== ""
      ? fromBody
      : block.saleablePricePerSqft ?? ctx?.saleablePricePerSqft ?? 0
  );
  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Enter a saleable price per sq.ft to estimate", defaultSaleablePricePerSqft: ctx?.saleablePricePerSqft ?? 0 },
      { status: 400 }
    );
  }
  const costSheet = await calculateCostSheet(block.unitId, price);
  if (!costSheet) return NextResponse.json({ error: "Unable to calculate" }, { status: 400 });
  return NextResponse.json({
    costSheet,
    defaultSaleablePricePerSqft: ctx?.saleablePricePerSqft ?? 0,
  });
}

export async function GET_block_costSheetPdf(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const block = await prisma.block.findFirst({
    where: { id, userId: user.id },
    include: { unit: { include: { floor: { include: { tower: { include: { project: true } } } } } } },
  });
  if (!block?.costSheetSnapshot) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { costSheetToHtml } = await import("@booking/pdf");
  const html = costSheetToHtml(block.costSheetSnapshot as unknown as import("@booking/pdf").CostSheetResult, {
    projectName: block.unit.floor.tower.project.name,
    unitNumber: block.unit.unitNumber,
    towerName: block.unit.floor.tower.name,
    customerName: block.customerName ?? undefined,
  });
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET_leads_search(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ leads: [] });
  const leads = await searchLeads(user.organizationId, q);
  return NextResponse.json({ leads });
}

export async function GET_booking_digitalForm(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id, userId: user.id },
    include: {
      digitalForm: { include: { documents: true } },
      unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snapshot = booking.formSnapshot as Record<string, unknown> | null;
  const form = booking.digitalForm;

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail,
      totalPrice: booking.totalPrice,
      submittedAt: booking.submittedAt,
      projectName: booking.unit.floor.tower.project.name,
      unitNumber: booking.unit.unitNumber,
      towerName: booking.unit.floor.tower.name,
    },
    form: form
      ? {
          id: form.id,
          status: form.status,
          page1Snapshot: form.page1Snapshot,
          formData: form.formData,
          submittedAt: form.submittedAt,
          documents: form.documents,
        }
      : null,
    formSnapshot: snapshot,
  });
}

export async function GET_booking_printPdf(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const booking = await prisma.booking.findFirst({
    where: { id, userId: user.id },
    include: {
      digitalForm: true,
      user: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snapshot = booking.formSnapshot as {
    page1Snapshot?: Record<string, unknown>;
    formData?: Record<string, unknown> | null;
    branding?: Record<string, unknown>;
  } | null;

  const page1Snapshot =
    snapshot?.page1Snapshot ??
    (booking.digitalForm?.page1Snapshot as Record<string, unknown> | undefined) ??
    (booking.costSheetSnapshot as Record<string, unknown>);
  const formData =
    snapshot?.formData ?? (booking.digitalForm?.formData as Record<string, unknown> | null) ?? null;

  if (!page1Snapshot) {
    return NextResponse.json({ error: "No form data available for print" }, { status: 404 });
  }

  let branding = snapshot?.branding as Record<string, unknown> | undefined;
  {
    const project = booking.unit.floor.tower.project;
    const template = await prisma.bookingFormTemplate.findFirst({
      where: { projectId: project.id, isActive: true },
      orderBy: { version: "desc" },
    });
    const { resolveFormBranding } = await import("@booking/database");
    branding = resolveFormBranding({
      projectName: project.name,
      unitNumber: booking.unit.unitNumber,
      projectLogoUrl: project.logoUrl,
      projectPrimaryColor: project.primaryColor,
      template,
      existingBranding: branding ?? null,
    }) as unknown as Record<string, unknown>;
    const { resolveBrandingLogosForDisplay } = await import("@goyal/storage");
    branding = await resolveBrandingLogosForDisplay(branding, req.nextUrl.origin);
  }

  const { digitalFormToPrintHtml } = await import("@booking/pdf");
  const html = digitalFormToPrintHtml(
    { page1Snapshot, formData },
    {
      branding: branding as import("@booking/pdf").PrintBranding,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerEmail: booking.customerEmail ?? undefined,
      salesAdvisorName: booking.user?.name ?? null,
      approvedByName: booking.reviewedBy?.name ?? null,
    }
  );
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="booking-form-${booking.unit.unitNumber}.html"`,
    },
  });
}

export async function POST_block_resendBookingEmail(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const block = await prisma.block.findFirst({
    where: { id, userId: user.id },
    include: {
      unit: { include: { floor: { include: { tower: { include: { project: true } } } } } },
      digitalForm: true,
    },
  });
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });
  if (!block.bookingToken || !block.customerEmail || !block.customerName) {
    return NextResponse.json({ error: "Customer / booking link not attached yet" }, { status: 400 });
  }

  try {
    const customerUrl = getCustomerBookingUrl(block.bookingToken);
    const dashboardUrl = getCustomerDashboardUrl(block.bookingToken);
    const project = block.unit.floor.tower.project;

    let costSheetHtml: string | undefined;
    let costSheetFileName: string | undefined;
    const snap = block.costSheetSnapshot as import("@booking/pdf").CostSheetResult | null;
    if (snap?.basicSaleValueWithGst != null) {
      const { costSheetToHtml } = await import("@booking/pdf");
      costSheetHtml = costSheetToHtml(snap, {
        projectName: project.name,
        unitNumber: block.unit.unitNumber,
        towerName: block.unit.floor.tower.name,
        customerName: block.customerName,
      });
      costSheetFileName = `Cost-Sheet-${block.unit.unitNumber}.html`;
    }

    const emailResult = await sendBlockNotificationEmail({
      blockId: block.id,
      customerEmail: block.customerEmail,
      customerName: block.customerName,
      projectName: project.name,
      unitNumber: block.unit.unitNumber,
      towerName: block.unit.floor.tower.name,
      bookingUrl: customerUrl,
      dashboardUrl,
      brochureUrl: project.brochureUrl ?? undefined,
      costSheetHtml,
      costSheetFileName,
    });

    return NextResponse.json({
      customerUrl,
      emailSent: !!emailResult.success && !emailResult.mocked,
      emailMocked: !!emailResult.mocked,
      emailError: emailResult.success
        ? undefined
        : emailResult.error || "Failed to send booking email",
      ...(process.env.NODE_ENV !== "production" ? { devBookingUrl: customerUrl } : {}),
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes("CUSTOMER_URL")) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
