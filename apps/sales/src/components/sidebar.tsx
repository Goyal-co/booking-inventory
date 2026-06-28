"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Lock,
  CheckCircle,
  Settings,
  LogOut,
  FolderKanban,
  Bell,
} from "lucide-react";
import { cn, MobileNavSheet, GhcLogo, type MobileNavItem } from "@booking/ui";
import { signOut } from "next-auth/react";

export const salesNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/live", label: "Live Booking", icon: Zap },
  { href: "/app/blocked", label: "My Blocked Units", icon: Lock },
  { href: "/app/bookings", label: "Bookings Done", icon: CheckCircle },
  { href: "/app/projects", label: "My Projects", icon: FolderKanban },
  { href: "/app/notifications", label: "Notifications", icon: Bell, badge: true },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50",
        className
      )}
    >
      <LogOut className="h-4 w-4" />
      Sign Out
    </button>
  );
}

export function Sidebar({
  className,
  unreadCount = 0,
}: {
  className?: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r border-gray-200 bg-white", className)}>
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <GhcLogo size={40} />
          <div>
            <h1 className="text-sm font-bold text-navy-600">Goyal Hariyana Sales</h1>
            <p className="text-xs text-brand-600">Sales Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {salesNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-l-4 border-brand-500 bg-brand-50 pl-2 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && unreadCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-3">
        <SignOutButton />
      </div>
    </aside>
  );
}

export function SalesMobileNav({
  open,
  onOpenChange,
  unreadCount = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  const items: MobileNavItem[] = salesNavItems.map((item) => ({
    href: item.href,
    label: item.badge && unreadCount > 0 ? `${item.label} (${unreadCount})` : item.label,
    icon: item.icon,
    active:
      pathname === item.href ||
      (item.href !== "/app" && pathname.startsWith(item.href)),
  }));

  return (
    <MobileNavSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Goyal Hariyana Sales"
      subtitle="Sales Portal"
      items={items}
      footer={<SignOutButton />}
    />
  );
}
