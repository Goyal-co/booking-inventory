"use client";

import { cn } from "../lib/utils";
import { useCountdown } from "../hooks/use-countdown";

interface BlockTimerProps {
  expiresAt: string;
  className?: string;
  showLabel?: boolean;
}

export function BlockTimer({ expiresAt, className, showLabel = true }: BlockTimerProps) {
  const { formatted, isExpired } = useCountdown(expiresAt);

  return (
    <div
      className={cn(
        "font-mono text-sm font-bold tabular-nums transition-all duration-300",
        isExpired ? "text-gray-400" : "text-amber-700 animate-pulse",
        className
      )}
    >
      {showLabel && !isExpired && <span className="mr-1 text-xs font-normal">⏱</span>}
      {isExpired ? "Expired" : `${formatted} left`}
    </div>
  );
}
