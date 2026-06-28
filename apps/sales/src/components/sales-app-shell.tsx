"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { MobileShellHeader, AppHeader } from "@booking/ui";
import { SalesMobileNav, Sidebar } from "@/components/sidebar";
import { SalesProjectsProvider } from "@/contexts/sales-projects-provider";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

function SalesShellInner({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { data: session } = useSession();
  const unreadCount = useUnreadNotifications();

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <Sidebar className="hidden lg:flex" unreadCount={unreadCount} />
      <SalesMobileNav open={navOpen} onOpenChange={setNavOpen} unreadCount={unreadCount} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileShellHeader title="Sales Portal" onMenuClick={() => setNavOpen(true)} />
        <AppHeader
          userName={session?.user?.name ?? "User"}
          userRole={session?.user?.role}
          notificationHref="/app/notifications"
          unreadCount={unreadCount}
          className="hidden lg:flex"
        />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

export function SalesAppShell({ children }: { children: React.ReactNode }) {
  return (
    <SalesProjectsProvider>
      <SalesShellInner>{children}</SalesShellInner>
    </SalesProjectsProvider>
  );
}
