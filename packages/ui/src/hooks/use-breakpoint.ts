"use client";

import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop" | "wide";

function getBreakpoint(width: number): Breakpoint {
  if (width >= 1280) return "wide";
  if (width >= 1024) return "desktop";
  if (width >= 640) return "tablet";
  return "mobile";
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    breakpoint,
    isMobile: breakpoint === "mobile",
    isTablet: breakpoint === "tablet",
    isDesktop: breakpoint === "desktop" || breakpoint === "wide",
    isWide: breakpoint === "wide",
    isLgUp: breakpoint === "desktop" || breakpoint === "wide",
  };
}
