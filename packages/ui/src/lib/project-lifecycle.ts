export type ProjectLifecycleStatus = "UPCOMING" | "LAUNCH_DAY" | "ONGOING";

export function formatBlockDuration(ms: number): string {
  const MS_PER_DAY = 86_400_000;
  const MS_PER_MINUTE = 60_000;
  if (ms >= MS_PER_DAY) {
    const days = Math.round(ms / MS_PER_DAY);
    return `${days} day${days !== 1 ? "s" : ""}`;
  }
  const minutes = Math.round(ms / MS_PER_MINUTE);
  return `${minutes} min`;
}

export function canBlockUnits(status: ProjectLifecycleStatus): boolean {
  return status === "LAUNCH_DAY" || status === "ONGOING";
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
