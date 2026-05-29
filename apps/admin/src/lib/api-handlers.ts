import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  getUnits,
  getUnitById,
  createBlock,
  releaseBlock,
  getAllBookings,
  cancelBooking,
  approveBooking,
  rejectBooking,
  BookingError,
  getAuditLogs,
  getActivities,
  massBlockAction,
  bulkAssignInventory,
  generateInventory,
  createUnit,
  updateUnit,
  deleteUnit,
  getInventoryStructure,
  InventoryError,
  BlockError,
  AuditAction,
  UserRole,
  BookingStatus,
} from "@booking/database";
import {
  createProjectSchema,
  floorPlanTypeSchema,
  costSheetTemplateSchema,
  towerSchema,
  bulkFloorSchema,
  bulkAssignSchema,
  massBlockSchema,
  createUserSchema,
  updateUserSchema,
  filterConfigSchema,
  updateProjectLifecycleSchema,
  cancelBookingSchema,
  patchBookingSchema,
  createUnitSchema,
  updateUnitSchema,
  deleteUnitSchema,
  updateFloorPlanSchema,
  createAdminUserSchema,
  importUserRowSchema,
} from "@booking/validators";
import { emitRealtimeEvent } from "@booking/database";
import { REALTIME_EVENTS } from "@booking/realtime";
import bcrypt from "bcryptjs";
import {
  applyAutoLifecycleTransitions,
  getDefaultBlockDurationForStatus,
  formatBlockDuration,
  getOrganizationDashboardStats,
} from "@booking/database";
import {
  getAdminUser,
  isSuperAdmin,
  denyUnlessProjectAccess,
  denyUnlessSuperAdmin,
  denyIfProjectIdsNotAllowed,
  orgProjectsWhere,
  getProjectIdFromTower,
  denyUnlessUnitAccess,
  getBookingProjectId,
  getBlockProjectId,
} from "@/lib/project-access";

async function validateProjectIdsForOrg(projectIds: string[], organizationId: string) {
  if (projectIds.length === 0) return true;
  const count = await prisma.project.count({
    where: { id: { in: projectIds }, organizationId },
  });
  return count === projectIds.length;
}

function isAdminRole(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.PROJECT_ADMIN;
}

async function countActiveAdmins(organizationId: string, excludeUserId?: string) {
  return prisma.user.count({
    where: {
      organizationId,
      isActive: true,
      role: { in: [UserRole.SUPER_ADMIN, UserRole.PROJECT_ADMIN] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}

function formatUserResponse(
  u: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    projectAccess: Array<{ project: { id: string; name: string } }>;
  }
) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    projects: u.projectAccess.map((p) => p.project),
  };
}

export async function GET_projects() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await applyAutoLifecycleTransitions();

  const projects = await prisma.project.findMany({
    where: orgProjectsWhere(user),
    include: {
      _count: { select: { towers: true, floorPlanTypes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST_projects(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = denyUnlessSuperAdmin(user);
  if (denied) return denied;

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      launchDate: parsed.data.launchDate ? new Date(parsed.data.launchDate) : null,
      organizationId: user.organizationId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.PROJECT_CREATED,
      entityType: "Project",
      entityId: project.id,
      userId: user.id,
    },
  });

  return NextResponse.json({ project });
}

export async function GET_project(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;

  const project = await prisma.project.findFirst({
    where: { id, ...orgProjectsWhere(user) },
    include: {
      towers: { include: { floors: { include: { _count: { select: { units: true } } } } } },
      floorPlanTypes: true,
      costSheetTemplates: true,
      filterConfigs: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PATCH_project(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const denied = denyUnlessProjectAccess(user, id);
  if (denied) return denied;

  const body = await req.json();
  const parsed = updateProjectLifecycleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.project.findFirst({
    where: { id, ...orgProjectsWhere(user) },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  let statusChanged = false;

  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.isPublished !== undefined) data.isPublished = parsed.data.isPublished;

  if (parsed.data.slug !== undefined && parsed.data.slug !== existing.slug) {
    const slugTaken = await prisma.project.findFirst({
      where: {
        organizationId: user.organizationId,
        slug: parsed.data.slug,
        id: { not: id },
      },
    });
    if (slugTaken) {
      return NextResponse.json({ error: "Slug already in use" }, { status: 409 });
    }
    data.slug = parsed.data.slug;
  }

  const metadataUpdated =
    parsed.data.name !== undefined ||
    parsed.data.slug !== undefined ||
    parsed.data.description !== undefined ||
    parsed.data.isPublished !== undefined ||
    parsed.data.requiresBookingApproval !== undefined;

  if (parsed.data.maxBlocksPerUser !== undefined) data.maxBlocksPerUser = parsed.data.maxBlocksPerUser;
  if (parsed.data.statusAutoManage !== undefined) data.statusAutoManage = parsed.data.statusAutoManage;
  if (parsed.data.requiresBookingApproval !== undefined) {
    data.requiresBookingApproval = parsed.data.requiresBookingApproval;
  }
  if (parsed.data.launchDate !== undefined) {
    data.launchDate = parsed.data.launchDate ? new Date(parsed.data.launchDate) : null;
  }

  if (parsed.data.lifecycleStatus !== undefined) {
    data.lifecycleStatus = parsed.data.lifecycleStatus;
    data.statusLockedByAdmin = true;
    statusChanged = parsed.data.lifecycleStatus !== existing.lifecycleStatus;

    if (parsed.data.blockDurationMs === undefined && parsed.data.blockDurationDays === undefined) {
      const defaults = getDefaultBlockDurationForStatus(parsed.data.lifecycleStatus);
      data.blockDurationMs = defaults.blockDurationMs;
      if (defaults.ongoingBlockDurationDays !== undefined) {
        data.ongoingBlockDurationDays = defaults.ongoingBlockDurationDays;
      }
    }
  }

  if (parsed.data.blockDurationDays !== undefined) {
    data.blockDurationMs = parsed.data.blockDurationDays * 86_400_000;
    data.ongoingBlockDurationDays = parsed.data.blockDurationDays;
  } else if (parsed.data.blockDurationMs !== undefined) {
    data.blockDurationMs = parsed.data.blockDurationMs;
    if (parsed.data.blockDurationMs >= 86_400_000) {
      data.ongoingBlockDurationDays = Math.round(parsed.data.blockDurationMs / 86_400_000);
    }
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  });

  if (statusChanged) {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.PROJECT_STATUS_CHANGED,
        entityType: "Project",
        entityId: id,
        userId: user.id,
        metadata: {
          from: existing.lifecycleStatus,
          to: parsed.data.lifecycleStatus,
          blockDurationLabel: formatBlockDuration(project.blockDurationMs),
        },
      },
    });
  } else if (metadataUpdated) {
    await prisma.auditLog.create({
      data: {
        action: AuditAction.PROJECT_UPDATED,
        entityType: "Project",
        entityId: id,
        userId: user.id,
        metadata: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          isPublished: parsed.data.isPublished,
        },
      },
    });
  }

  return NextResponse.json({ project });
}

export async function DELETE_project(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const superDenied = denyUnlessSuperAdmin(user);
  if (superDenied) return superDenied;

  const { id } = await params;
  const existing = await prisma.project.findFirst({
    where: { id, organizationId: user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bookingCount = await prisma.booking.count({
    where: { unit: { floor: { tower: { projectId: id } } } },
  });

  if (bookingCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete project with existing bookings" },
      { status: 409 }
    );
  }

  await prisma.auditLog.create({
    data: {
      action: AuditAction.PROJECT_DELETED,
      entityType: "Project",
      entityId: id,
      userId: user.id,
      metadata: { name: existing.name, slug: existing.slug },
    },
  });

  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function POST_floorPlan(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const body = await req.json();
  const parsed = floorPlanTypeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const plan = await prisma.floorPlanType.create({
    data: { ...parsed.data, projectId },
  });

  return NextResponse.json({ floorPlan: plan });
}

export async function PATCH_floorPlan(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, planId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const existing = await prisma.floorPlanType.findFirst({
    where: { id: planId, projectId, project: { organizationId: user.organizationId } },
  });
  if (!existing) return NextResponse.json({ error: "Floor plan not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateFloorPlanSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const plan = await prisma.floorPlanType.update({
    where: { id: planId },
    data: parsed.data,
  });

  return NextResponse.json({ floorPlan: plan });
}

export async function POST_costSheet(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const body = await req.json();
  const parsed = costSheetTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const totalPrice = parsed.data.lineItems.reduce((sum, item) => sum + item.amount, 0);

  const costSheet = await prisma.costSheetTemplate.create({
    data: {
      name: parsed.data.name,
      lineItems: parsed.data.lineItems,
      totalPrice,
      floorPlanTypeId: parsed.data.floorPlanTypeId,
      projectId,
    },
  });

  return NextResponse.json({ costSheet });
}

export async function POST_tower(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const body = await req.json();
  const parsed = towerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tower = await prisma.tower.create({
    data: { ...parsed.data, projectId },
  });

  return NextResponse.json({ tower });
}

export async function POST_generateInventory(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bulkFloorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const towerProjectId = await getProjectIdFromTower(parsed.data.towerId);
  if (!towerProjectId) return NextResponse.json({ error: "Tower not found" }, { status: 404 });
  const denied = denyUnlessProjectAccess(user, towerProjectId);
  if (denied) return denied;

  const result = await generateInventory(parsed.data);
  return NextResponse.json(result);
}

export async function POST_bulkAssign(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bulkAssignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const denied = denyUnlessProjectAccess(user, parsed.data.projectId);
  if (denied) return denied;

  const result = await bulkAssignInventory(parsed.data.unitIds, parsed.data, user.id);
  return NextResponse.json(result);
}

export async function POST_massBlock(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = massBlockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const denied = denyUnlessProjectAccess(user, parsed.data.projectId);
  if (denied) return denied;

  const results = await massBlockAction(
    parsed.data.projectId,
    parsed.data.unitIds,
    parsed.data.action,
    user.id,
    parsed.data.durationMs
  );

  for (const r of results) {
    if ("unitId" in r) {
      await emitRealtimeEvent(parsed.data.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
        unitId: r.unitId,
        status: parsed.data.action === "hold" ? "HOLD" : "AVAILABLE",
      });
    }
  }

  return NextResponse.json({ results });
}

export async function GET_units(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const units = await getUnits({ projectId, hideHold: false, search });
  return NextResponse.json({ units });
}

export async function GET_inventoryStructure(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  try {
    const structure = await getInventoryStructure(projectId, user.organizationId);
    return NextResponse.json(structure);
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}

export async function POST_unit(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createUnitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const towerProjectId = await getProjectIdFromTower(parsed.data.towerId);
  if (!towerProjectId) return NextResponse.json({ error: "Tower not found" }, { status: 404 });
  const unitDenied = denyUnlessProjectAccess(user, towerProjectId);
  if (unitDenied) return unitDenied;

  try {
    const result = await createUnit(parsed.data, user.id, user.organizationId);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unit.id,
      status: result.unit.status,
    });
    return NextResponse.json({ unit: result.unit });
  } catch (error) {
    if (error instanceof InventoryError) {
      const status = error.code === "CONFLICT" ? 409 : 404;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}

export async function PATCH_unit(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: unitId } = await params;
  const accessDenied = await denyUnlessUnitAccess(user, unitId);
  if (accessDenied) return accessDenied;

  const body = await req.json();
  const parsed = updateUnitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await updateUnit(unitId, parsed.data, user.id, user.organizationId);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unit.id,
      status: result.unit.status,
    });
    return NextResponse.json({ unit: result.unit });
  } catch (error) {
    if (error instanceof InventoryError) {
      const status = error.code === "CONFLICT" ? 409 : 404;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}

export async function DELETE_unit(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: unitId } = await params;
  const accessDenied = await denyUnlessUnitAccess(user, unitId);
  if (accessDenied) return accessDenied;

  const body = await req.json().catch(() => ({}));
  const parsed = deleteUnitSchema.safeParse(body);

  try {
    const result = await deleteUnit(
      unitId,
      user.id,
      user.organizationId,
      parsed.success ? parsed.data.reason : undefined
    );
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      block: null,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof InventoryError) {
      const status = error.code === "IN_USE" ? 409 : 404;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}

export async function GET_users() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: isSuperAdmin(user)
      ? { organizationId: user.organizationId }
      : {
          organizationId: user.organizationId,
          role: { in: [UserRole.SALES_EXEC, UserRole.SALES_MANAGER] },
          projectAccess: { some: { projectId: { in: user.projectIds } } },
        },
    include: { projectAccess: { include: { project: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isActive: u.isActive,
      projects: u.projectAccess.map((p) => p.project),
    })),
  });
}

export async function POST_users(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const isAdminCreate =
    body.role === UserRole.SUPER_ADMIN || body.role === UserRole.PROJECT_ADMIN;
  if (isAdminCreate && !isSuperAdmin(user)) {
    return NextResponse.json({ error: "Only Super Admin can create admin accounts" }, { status: 403 });
  }

  const parsed = isAdminCreate
    ? createAdminUserSchema.safeParse(body)
    : createUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const projectDenied = denyIfProjectIdsNotAllowed(user, parsed.data.projectIds);
  if (projectDenied) return projectDenied;

  const validProjects = await validateProjectIdsForOrg(
    parsed.data.projectIds,
    user.organizationId
  );
  if (!validProjects) {
    return NextResponse.json({ error: "One or more projects are invalid" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const newUser = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role as UserRole,
      organizationId: user.organizationId,
      projectAccess: {
        create: parsed.data.projectIds.map((projectId) => ({ projectId })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      action: AuditAction.USER_CREATED,
      entityType: "User",
      entityId: newUser.id,
      userId: user.id,
      metadata: { targetRole: newUser.role },
    },
  });

  return NextResponse.json({ user: { id: newUser.id, email: newUser.email, name: newUser.name } });
}

export async function PATCH_user(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const targetUser = await prisma.user.findFirst({
    where: { id, organizationId: admin.organizationId },
  });
  if (!targetUser) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isSuperAdmin(admin)) {
    if (isAdminRole(targetUser.role)) {
      return NextResponse.json({ error: "Cannot modify admin accounts" }, { status: 403 });
    }
    const nextRole = (parsed.data.role ?? targetUser.role) as UserRole;
    if (isAdminRole(nextRole)) {
      return NextResponse.json({ error: "Cannot promote users to admin roles" }, { status: 403 });
    }
    const targetProjects = await prisma.userProjectAccess.findMany({
      where: { userId: id },
      select: { projectId: true },
    });
    const targetProjectIds = targetProjects.map((p) => p.projectId);
    const hasOverlap = targetProjectIds.some((pid) => admin.projectIds.includes(pid));
    if (!hasOverlap && targetProjectIds.length > 0) {
      return NextResponse.json({ error: "Access denied for this user" }, { status: 403 });
    }
    if (parsed.data.projectIds) {
      const projectDenied = denyIfProjectIdsNotAllowed(admin, parsed.data.projectIds);
      if (projectDenied) return projectDenied;
    }
  }

  if (admin.id === id && parsed.data.isActive === false) {
    return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
  }

  const nextRole = (parsed.data.role ?? targetUser.role) as UserRole;
  const nextActive = parsed.data.isActive ?? targetUser.isActive;
  const wasAdmin = isAdminRole(targetUser.role);
  const willBeAdmin = isAdminRole(nextRole) && nextActive;

  if (wasAdmin && !willBeAdmin) {
    const otherAdmins = await countActiveAdmins(admin.organizationId, id);
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot remove or deactivate the last active admin account" },
        { status: 400 }
      );
    }
  }

  if (parsed.data.projectIds) {
    const valid = await validateProjectIdsForOrg(parsed.data.projectIds, admin.organizationId);
    if (!valid) {
      return NextResponse.json({ error: "One or more projects are invalid" }, { status: 400 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.email) updateData.email = parsed.data.email;
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.role) updateData.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.password) updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await prisma.user.update({ where: { id }, data: updateData });

  if (parsed.data.projectIds) {
    await prisma.userProjectAccess.deleteMany({ where: { userId: id } });
    if (parsed.data.projectIds.length > 0) {
      await prisma.userProjectAccess.createMany({
        data: parsed.data.projectIds.map((projectId) => ({ userId: id, projectId })),
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: AuditAction.USER_UPDATED,
      entityType: "User",
      entityId: id,
      userId: admin.id,
      metadata: {
        previousRole: targetUser.role,
        targetRole: nextRole,
        isActive: nextActive,
      },
    },
  });

  const updated = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: { projectAccess: { include: { project: { select: { id: true, name: true } } } } },
  });

  return NextResponse.json({ user: formatUserResponse(updated) });
}

export async function GET_audit() {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = denyUnlessSuperAdmin(user);
  if (denied) return denied;

  const logs = await getAuditLogs({ limit: 100 });
  return NextResponse.json({ logs });
}

export async function GET_bookings(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId =
    projectIdParam && projectIdParam !== "all" ? projectIdParam : undefined;
  const statusParam = req.nextUrl.searchParams.get("status");
  const status =
    statusParam && statusParam !== "all"
      ? (statusParam as BookingStatus)
      : undefined;
  const search = req.nextUrl.searchParams.get("search") ?? undefined;

  if (projectId) {
    const denied = denyUnlessProjectAccess(user, projectId);
    if (denied) return denied;
  }

  const bookings = isSuperAdmin(user)
    ? await getAllBookings(
        projectId,
        projectId ? undefined : user.organizationId,
        status,
        search
      )
    : projectId
      ? await getAllBookings(projectId, undefined, status, search)
      : await getAllBookings(undefined, undefined, status, search, user.projectIds);

  return NextResponse.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      totalPrice: b.totalPrice.toString(),
      bookedAt: b.bookedAt.toISOString(),
      submittedAt: b.submittedAt.toISOString(),
      status: b.status,
      adminComment: b.adminComment,
      user: b.user,
      unit: {
        unitNumber: b.unit.unitNumber,
        floor: {
          tower: {
            name: b.unit.floor.tower.name,
            project: b.unit.floor.tower.project,
          },
        },
      },
    })),
  });
}

export async function PATCH_booking(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;
  const body = await req.json();
  const parsed = patchBookingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bookingProjectId = await getBookingProjectId(bookingId);
  if (!bookingProjectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = denyUnlessProjectAccess(user, bookingProjectId);
  if (denied) return denied;

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      unit: { floor: { tower: { project: { organizationId: user.organizationId } } } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    if (parsed.data.action === "approve") {
      const result = await approveBooking(bookingId, user.id);
      await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BOOKING_CONFIRMED, {
        unitId: result.unitId,
        status: "BOOKED",
        bookingId,
        block: null,
      });
      return NextResponse.json({ success: true, booking: result.booking });
    }

    const result = await rejectBooking(bookingId, user.id, parsed.data.comment);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.BOOKING_REJECTED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      bookingId,
      block: null,
    });
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      block: null,
    });
    return NextResponse.json({ success: true, booking: result.booking });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE_booking(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: bookingId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = cancelBookingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const bookingProjectId = await getBookingProjectId(bookingId);
  if (!bookingProjectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = denyUnlessProjectAccess(user, bookingProjectId);
  if (denied) return denied;

  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      unit: { floor: { tower: { project: { organizationId: user.organizationId } } } },
    },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await cancelBooking(bookingId, user.id, parsed.data.reason);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      block: null,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE_forceRelease(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: blockId } = await params;

  const blockProjectId = await getBlockProjectId(blockId);
  if (!blockProjectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = denyUnlessProjectAccess(user, blockProjectId);
  if (denied) return denied;

  try {
    const result = await releaseBlock(blockId, user.id, true);
    await emitRealtimeEvent(result.projectId, REALTIME_EVENTS.UNIT_UPDATED, {
      unitId: result.unitId,
      status: "AVAILABLE",
      block: null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BlockError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function POST_filterConfig(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const denied = denyUnlessProjectAccess(user, projectId);
  if (denied) return denied;

  const body = await req.json();
  const parsed = filterConfigSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const config = await prisma.filterConfig.upsert({
    where: { projectId_dimension: { projectId, dimension: parsed.data.dimension } },
    update: parsed.data,
    create: { ...parsed.data, projectId },
  });

  return NextResponse.json({ filterConfig: config });
}

export async function POST_importUsers(
  req: NextRequest,
  admin?: Awaited<ReturnType<typeof getAdminUser>>,
  body?: unknown
) {
  const user = admin ?? (await getAdminUser());
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = body ?? (await req.json());
  const rows = (payload as { users?: unknown[] }).users ?? [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No users to import" }, { status: 400 });
  }

  const created: string[] = [];
  for (const row of rows) {
    const parsed = importUserRowSchema.safeParse(row);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const valid = await validateProjectIdsForOrg(parsed.data.projectIds, user.organizationId);
    if (!valid) {
      return NextResponse.json({ error: "One or more projects are invalid" }, { status: 400 });
    }
    const projectDenied = denyIfProjectIdsNotAllowed(user, parsed.data.projectIds);
    if (projectDenied) return projectDenied;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const u = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role as UserRole,
        organizationId: user.organizationId,
        projectAccess: {
          create: parsed.data.projectIds.map((projectId) => ({ projectId })),
        },
      },
    });
    created.push(u.id);
    await prisma.auditLog.create({
      data: {
        action: AuditAction.USER_CREATED,
        entityType: "User",
        entityId: u.id,
        userId: user.id,
        metadata: { targetRole: u.role, import: true },
      },
    });
  }

  return NextResponse.json({ created: created.length });
}

export async function GET_dashboard(req: NextRequest) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectIdParam = req.nextUrl.searchParams.get("projectId");
  const projectId =
    projectIdParam && projectIdParam !== "all" ? projectIdParam : undefined;

  if (projectId) {
    const denied = denyUnlessProjectAccess(user, projectId);
    if (denied) return denied;
  }

  const stats = isSuperAdmin(user)
    ? await getOrganizationDashboardStats(user.organizationId, projectId)
    : projectId
      ? await getOrganizationDashboardStats(user.organizationId, projectId)
      : await getOrganizationDashboardStats(user.organizationId, undefined, user.projectIds);

  return NextResponse.json({ stats });
}
