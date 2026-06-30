import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  getUnits,
  getUnitById,
  createBlock,
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
} from "@booking/database";
import { createBlockSchema, createBookingSchema, unitFiltersSchema, dashboardRangeSchema } from "@booking/validators";
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
    throw error;
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
