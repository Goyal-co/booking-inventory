"use client";

import { cn, STATUS_COLORS, type UnitStatus } from "../lib/utils";

interface StatusBadgeProps {
  status: UnitStatus;
  className?: string;
  label?: string;
}

export function StatusBadge({ status, className, label }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        colors.bg,
        colors.text,
        colors.border,
        className
      )}
    >
      {label ?? colors.label}
    </span>
  );
}
