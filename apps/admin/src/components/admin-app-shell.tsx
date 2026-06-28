"use client";

import { useState } from "react";
import { MobileShellHeader, AppHeader } from "@booking/ui";
import { AdminMobileNav, AdminSidebar } from "@/components/admin-sidebar";
import { AdminProjectsProvider } from "@/contexts/admin-projects-provider";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const { session } = useAdminSession();
  const unreadCount = useUnreadNotifications();

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <AdminSidebar className="hidden lg:flex" unreadCount={unreadCount} />
      <AdminMobileNav open={navOpen} onOpenChange={setNavOpen} unreadCount={unreadCount} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileShellHeader title="Admin Panel" onMenuClick={() => setNavOpen(true)} />
        <AppHeader
          userName={session?.user?.name ?? "Admin"}
          userRole={session?.user?.role}
          notificationHref="/admin/notifications"
          unreadCount={unreadCount}
          className="hidden lg:flex"
        />
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  );
}

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminProjectsProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminProjectsProvider>
  );
}
