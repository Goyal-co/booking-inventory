"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Grid3X3,
  Users,
  FileText,
  BookOpen,
  LogOut,
  Settings,
  Megaphone,
  Files,
} from "lucide-react";
import { cn, MobileNavSheet, GhcLogo, type MobileNavItem } from "@booking/ui";
import { signOut } from "next-auth/react";
import { useAdminSession } from "@/hooks/use-admin-session";

export const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/projects", label: "Projects", icon: Building2 },
  { href: "/admin/templates", label: "Booking Form Template", icon: Files },
  { href: "/admin/inventory", label: "Inventory", icon: Grid3X3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
  { href: "/admin/communications", label: "Communications", icon: Megaphone },
  { href: "/admin/integration", label: "Integrations", icon: Settings },
  { href: "/admin/audit", label: "Audit Log", icon: FileText },
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

function NavLinks({
  navItems,
  pathname,
  unreadCount,
}: {
  navItems: typeof adminNavItems;
  pathname: string;
  unreadCount?: number;
}) {
  return (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
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
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function AdminSidebar({
  className,
  unreadCount,
}: {
  className?: string;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAdminSession();
  const navItems = adminNavItems.filter(
    (item) => item.href !== "/admin/audit" || isSuperAdmin
  );

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r border-gray-200 bg-white", className)}>
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <GhcLogo size={40} />
          <div>
            <h1 className="text-sm font-bold text-navy-600">Goyal Hariyana Sales</h1>
            <p className="text-xs text-brand-600">Admin Portal</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <NavLinks navItems={navItems} pathname={pathname} unreadCount={unreadCount} />
      </nav>
      <div className="space-y-1 border-t border-gray-200 p-3">
        <Link
          href="/admin/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <SignOutButton />
      </div>
    </aside>
  );
}

export function AdminMobileNav({
  open,
  onOpenChange,
  unreadCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAdminSession();
  const navItems = adminNavItems.filter(
    (item) => item.href !== "/admin/audit" || isSuperAdmin
  );

  const items: MobileNavItem[] = navItems.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active:
      pathname === item.href ||
      (item.href !== "/admin" && pathname.startsWith(item.href)),
  }));

  return (
    <MobileNavSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Goyal Hariyana Sales"
      subtitle="Admin Portal"
      items={items}
      footer={
        <div className="space-y-1">
          <Link
            href="/admin/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <SignOutButton />
        </div>
      }
    />
  );
}
