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
} from "lucide-react";
import { cn, MobileNavSheet, type MobileNavItem } from "@booking/ui";
import { signOut } from "next-auth/react";
import { useAdminSession } from "@/hooks/use-admin-session";

export const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/projects", label: "Projects", icon: Building2 },
  { href: "/admin/inventory", label: "Inventory", icon: Grid3X3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/bookings", label: "Bookings", icon: BookOpen },
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

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAdminSession();
  const navItems = adminNavItems.filter(
    (item) => item.href !== "/admin/audit" || isSuperAdmin
  );

  return (
    <aside className={cn("flex h-full w-60 flex-col border-r border-gray-200 bg-white", className)}>
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-lg font-bold text-brand-600">Admin Panel</h1>
        <p className="text-xs text-gray-500">Inventory Management</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
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

export function AdminMobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { isSuperAdmin } = useAdminSession();
  const navItems = adminNavItems.filter(
    (item) => item.href !== "/admin/audit" || isSuperAdmin
  );
  const items: MobileNavItem[] = navItems.map((item) => ({
    ...item,
    active:
      pathname === item.href ||
      (item.href !== "/admin" && pathname.startsWith(item.href)),
  }));

  return (
    <MobileNavSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Admin Panel"
      subtitle="Inventory Management"
      items={items}
      footer={<SignOutButton />}
    />
  );
}
