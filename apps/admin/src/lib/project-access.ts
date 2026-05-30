import { NextResponse } from "next/server";
import { prisma, getProjectIdFromUnit } from "@booking/database";
import { auth } from "@/auth";

export type AdminUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  organizationId: string;
  projectIds: string[];
};

export async function getAdminUser(): Promise<AdminUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const role = session.user.role;
  if (!["SUPER_ADMIN", "PROJECT_ADMIN"].includes(role)) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    organizationId: session.user.organizationId,
    projectIds: session.user.projectIds ?? [],
  };
}

export function isSuperAdmin(user: AdminUser) {
  return user.role === "SUPER_ADMIN";
}

export function isProjectAdmin(user: AdminUser) {
  return user.role === "PROJECT_ADMIN";
}

export function hasProjectAccess(user: AdminUser, projectId: string) {
  if (isSuperAdmin(user)) return true;
  return user.projectIds.includes(projectId);
}

export function denyUnlessProjectAccess(user: AdminUser, projectId: string) {
  if (!hasProjectAccess(user, projectId)) {
    return NextResponse.json({ error: "Access denied for this project" }, { status: 403 });
  }
  return null;
}

export function denyUnlessSuperAdmin(user: AdminUser) {
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });
  }
  return null;
}

export function denyIfProjectIdsNotAllowed(user: AdminUser, projectIds: string[]) {
  if (isSuperAdmin(user) || projectIds.length === 0) return null;
  const invalid = projectIds.filter((id) => !user.projectIds.includes(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "Cannot assign projects outside your access" },
      { status: 403 }
    );
  }
  return null;
}

export function orgProjectsWhere(user: AdminUser) {
  if (isSuperAdmin(user)) {
    return { organizationId: user.organizationId };
  }
  return {
    organizationId: user.organizationId,
    id: { in: user.projectIds.length > 0 ? user.projectIds : ["__none__"] },
  };
}

export async function getProjectIdFromTower(towerId: string) {
  const tower = await prisma.tower.findUnique({
    where: { id: towerId },
    select: { projectId: true },
  });
  return tower?.projectId ?? null;
}

export async function denyUnlessUnitAccess(user: AdminUser, unitId: string) {
  const projectId = await getProjectIdFromUnit(unitId);
  if (!projectId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return denyUnlessProjectAccess(user, projectId);
}

export async function getBookingProjectId(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      unit: { select: { floor: { select: { tower: { select: { projectId: true } } } } } },
    },
  });
  return booking?.unit.floor.tower.projectId ?? null;
}

export async function getBlockProjectId(blockId: string) {
  const block = await prisma.block.findUnique({
    where: { id: blockId },
    select: {
      unit: { select: { floor: { select: { tower: { select: { projectId: true } } } } } },
    },
  });
  return block?.unit.floor.tower.projectId ?? null;
}

export { getProjectIdFromUnit };
