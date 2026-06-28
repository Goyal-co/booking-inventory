"use client";

import * as React from "react";
import { Bell, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Avatar } from "./avatar";
import { formatRole } from "../lib/format-role";

export function AppHeader({
  userName,
  userRole,
  notificationHref,
  unreadCount = 0,
  className,
}: {
  userName: string;
  userRole?: string;
  notificationHref?: string;
  unreadCount?: number;
  className?: string;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-end gap-3 border-b border-gray-200 bg-white px-4 md:px-6",
        className
      )}
    >
      {notificationHref && (
        <a
          href={notificationHref}
          className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </a>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
        >
          <Avatar name={userName} size="sm" />
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            {userRole && (
              <p className="text-xs text-gray-500">{formatRole(userRole)}</p>
            )}
          </div>
          <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <p className="border-b border-gray-100 px-3 py-2 text-xs text-gray-500">{userName}</p>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
