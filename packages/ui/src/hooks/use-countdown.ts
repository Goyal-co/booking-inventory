"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "../lib/utils";

export function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, diff));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return {
    remaining,
    formatted: formatCountdown(remaining),
    isExpired: remaining <= 0,
  };
}
