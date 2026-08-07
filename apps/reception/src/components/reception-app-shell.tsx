"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import {
  ConciergeBell,
  Users,
  LogOut,
} from "lucide-react";
import {
  cn,
  GhcLogo,
  AppHeader,
  MobileShellHeader,
  MobileNavSheet,
  type MobileNavItem,
} from "@booking/ui";

export const receptionNavItems = [
  {
    href: "/dashboard",
    label: "Check-in desk",
    icon: ConciergeBell,
    match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/eoi"),
  },
  {
    href: "/dashboard/visits",
    label: "Today's visits",
    icon: Users,
    match: (p: string) => p.startsWith("/dashboard/visits"),
  },
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

function ReceptionSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex h-full w-64 flex-col border-r border-gray-200 bg-white", className)}>
      <div className="border-b border-gray-200 p-4">
        <GhcLogo size={48} src="/images/auth/new_logo.jpeg" className="max-w-full" />
        <p className="mt-2 text-xs font-medium text-brand-600">Reception Portal</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {receptionNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
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

export function ReceptionAppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { data: session } = useSession();
  const pathname = usePathname();

  const mobileItems: MobileNavItem[] = receptionNavItems.map((item) => ({
    href: item.href,
    label: item.label,
    icon: item.icon,
    active: item.match(pathname),
  }));

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <ReceptionSidebar className="hidden lg:flex" />
      <MobileNavSheet
        open={navOpen}
        onOpenChange={setNavOpen}
        title="Goyal Hariyana Sales"
        subtitle="Reception Portal"
        logoSrc="/images/auth/new_logo.jpeg"
        items={mobileItems}
        footer={<SignOutButton />}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileShellHeader title="Reception Portal" onMenuClick={() => setNavOpen(true)} />
        <AppHeader
          userName={session?.user?.name ?? "Reception"}
          userRole={session?.user?.role}
          className="hidden lg:flex"
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
