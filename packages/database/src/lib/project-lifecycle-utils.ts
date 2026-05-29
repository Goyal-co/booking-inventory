import { ProjectLifecycleStatus } from "@prisma/client";

const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

export const LIFECYCLE_DEFAULTS = {
  LAUNCH_DAY: { blockDurationMs: 15 * MS_PER_MINUTE },
  ONGOING: { blockDurationMs: 3 * MS_PER_DAY, ongoingBlockDurationDays: 3 },
} as const;

export function canBlockUnits(status: ProjectLifecycleStatus): boolean {
  return status === "LAUNCH_DAY" || status === "ONGOING";
}

export function formatBlockDuration(ms: number): string {
  if (ms >= MS_PER_DAY) {
    const days = Math.round(ms / MS_PER_DAY);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  const minutes = Math.round(ms / MS_PER_MINUTE);
  return `${minutes} min`;
}

export function getLifecycleLabel(status: ProjectLifecycleStatus): string {
  switch (status) {
    case "UPCOMING":
      return "Upcoming";
    case "LAUNCH_DAY":
      return "Launch Day";
    case "ONGOING":
      return "Ongoing";
  }
}

export const LIFECYCLE_COLORS: Record<
  ProjectLifecycleStatus,
  { bg: string; text: string; border: string }
> = {
  UPCOMING: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-300" },
  LAUNCH_DAY: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  ONGOING: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

export function getBlockRulesSummary(
  status: ProjectLifecycleStatus,
  blockDurationMs: number,
  maxBlocksPerUser: number
): string {
  if (status === "UPCOMING") return "No blocking — view only";
  return `${getLifecycleLabel(status)} · ${formatBlockDuration(blockDurationMs)} blocks · max ${maxBlocksPerUser}`;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getDefaultBlockDurationForStatus(status: ProjectLifecycleStatus): {
  blockDurationMs: number;
  ongoingBlockDurationDays?: number;
} {
  switch (status) {
    case "LAUNCH_DAY":
      return { blockDurationMs: LIFECYCLE_DEFAULTS.LAUNCH_DAY.blockDurationMs };
    case "ONGOING":
      return {
        blockDurationMs: LIFECYCLE_DEFAULTS.ONGOING.blockDurationMs,
        ongoingBlockDurationDays: LIFECYCLE_DEFAULTS.ONGOING.ongoingBlockDurationDays,
      };
    default:
      return { blockDurationMs: LIFECYCLE_DEFAULTS.LAUNCH_DAY.blockDurationMs };
  }
}
