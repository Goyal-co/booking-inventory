import { prisma, ProjectLifecycleStatus, AuditAction } from "../index";
import { isSameCalendarDay } from "../lib/project-lifecycle-utils";

export async function applyAutoLifecycleTransitions(projectId?: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const projects = await prisma.project.findMany({
    where: {
      ...(projectId ? { id: projectId } : {}),
      statusAutoManage: true,
      statusLockedByAdmin: false,
      lifecycleStatus: ProjectLifecycleStatus.UPCOMING,
      launchDate: { not: null },
    },
  });

  const updated: string[] = [];

  for (const project of projects) {
    if (!project.launchDate) continue;

    const launchDay = new Date(project.launchDate);
    if (isSameCalendarDay(launchDay, startOfToday) || launchDay < startOfToday) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          lifecycleStatus: ProjectLifecycleStatus.LAUNCH_DAY,
          blockDurationMs: project.blockDurationMs || 900_000,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: AuditAction.PROJECT_STATUS_CHANGED,
          entityType: "Project",
          entityId: project.id,
          metadata: {
            from: "UPCOMING",
            to: "LAUNCH_DAY",
            reason: "auto_launch_date",
          },
        },
      });

      updated.push(project.id);
    }
  }

  return updated;
}

export async function ensureProjectLifecycle(projectId: string) {
  await applyAutoLifecycleTransitions(projectId);
  return prisma.project.findUnique({ where: { id: projectId } });
}

export async function ensureProjectsLifecycle(projectIds: string[]) {
  for (const id of projectIds) {
    await applyAutoLifecycleTransitions(id);
  }
}
