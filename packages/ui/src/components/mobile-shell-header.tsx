"use client";

import { Menu } from "lucide-react";
import { Button } from "./button";

interface MobileShellHeaderProps {
  title: string;
  onMenuClick: () => void;
  trailing?: React.ReactNode;
}

export function MobileShellHeader({ title, onMenuClick, trailing }: MobileShellHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="h-4 w-4" />
        </Button>
        <span className="truncate text-sm font-semibold text-gray-900">{title}</span>
      </div>
      {trailing}
    </header>
  );
}
