"use client";

import { cn } from "../lib/utils";
import type { ProjectLifecycleStatus } from "../lib/project-lifecycle";

const STATUS_CONFIG: Record<
  ProjectLifecycleStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  UPCOMING: { label: "Upcoming", bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-300" },
  LAUNCH_DAY: { label: "Launch Day", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" },
  ONGOING: { label: "Ongoing", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300" },
};

interface ProjectStatusBadgeProps {
  status: ProjectLifecycleStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
}
