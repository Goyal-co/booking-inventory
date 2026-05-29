"use client";

import { useSession } from "next-auth/react";
import { Badge, formatRole } from "@booking/ui";

interface TopBarProps {
  activeBlocks?: number;
  maxBlocks?: number;
  children?: React.ReactNode;
}

export function TopBar({ activeBlocks = 0, children }: TopBarProps) {
  const { data: session } = useSession();

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          {children}
        </div>
        <div className="flex items-center justify-between gap-3 lg:justify-end">
          {activeBlocks > 0 && (
            <Badge variant="warning" className="px-3 py-1 text-xs sm:text-sm">
              {activeBlocks} active block{activeBlocks !== 1 ? "s" : ""}
            </Badge>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
              {session?.user?.name?.charAt(0) ?? "U"}
            </div>
            <div className="hidden text-sm sm:block">
              <p className="font-medium text-gray-900">{session?.user?.name}</p>
              <p className="text-xs text-gray-500">{formatRole(session?.user?.role)}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
