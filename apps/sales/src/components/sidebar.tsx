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
} from "lucide-react";
import { cn, MobileNavSheet, type MobileNavItem } from "@booking/ui";
import { signOut } from "next-auth/react";

export const salesNavItems = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/live", label: "Live Booking", icon: Zap },
  { href: "/app/blocked", label: "My Blocked Units", icon: Lock },
  { href: "/app/bookings", label: "Bookings Done", icon: CheckCircle },
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

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex h-full w-60 flex-col border-r border-gray-200 bg-white", className)}>
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-lg font-bold text-brand-600">Booking Inventory</h1>
        <p className="text-xs text-gray-500">Sales Portal</p>
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
                active ? "bg-brand-50 text-brand-600" : "text-gray-600 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const items: MobileNavItem[] = salesNavItems.map((item) => ({
    ...item,
    active:
      pathname === item.href ||
      (item.href !== "/app" && pathname.startsWith(item.href)),
  }));

  return (
    <MobileNavSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Booking Inventory"
      subtitle="Sales Portal"
      items={items}
      footer={<SignOutButton />}
    />
  );
}
