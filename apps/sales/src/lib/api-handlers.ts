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
  applyAutoLifecycleTransitions,
  getSalesAnalyticsForProjects,
  canBlockUnits,
  formatBlockDuration,
  getProjectIdFromUnit,
} from "@booking/database";
import { createBlockSchema, createBookingSchema, unitFiltersSchema } from "@booking/validators";
import { emitRealtimeEvent } from "@booking/database";
import { REALTIME_EVENTS } from "@booking/realtime";

async function getSessionUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const access = await prisma.userProjectAccess.findMany({
    where: { userId: session.user.id },
    select: { projectId: true },
  });
  const projectIds = access.map((a) => a.projectId);

  return { ...session.user, projectIds };
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
  const blocks = await getActiveBlocksForUser(user.id, projectId, search);
  return NextResponse.json({ blocks });
}

export async function GET_bookings(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId =
    projectIdParam && projectIdParam !== "all" ? projectIdParam : undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const bookings = await getBookingsForUser(user.id, projectId, search);
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

  await applyAutoLifecycleTransitions();

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

export async function GET_dashboard(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await applyAutoLifecycleTransitions();

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

  const analyticsMap = await getSalesAnalyticsForProjects(
    user.id,
    projects.map((p) => p.id)
  );

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
    },
  }));

  return NextResponse.json({ projects: enriched });
}

export async function GET_filters(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.projectIds.includes(projectId)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const filters = await prisma.filterConfig.findMany({
    where: { projectId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({
    filters: filters.map((f) => ({
      dimension: f.dimension,
      label: f.label,
      options: f.options as Array<{ value: string; label: string }>,
    })),
  });
}
