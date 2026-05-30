"use client";

import { Suspense, useState } from "react";
import { MobileShellHeader } from "@booking/ui";
import { AdminMobileNav, AdminSidebar } from "@/components/admin-sidebar";
import { AdminProjectsProvider } from "@/contexts/admin-projects-provider";

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <AdminSidebar className="hidden lg:flex" />
      <AdminMobileNav open={navOpen} onOpenChange={setNavOpen} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileShellHeader title="Admin Panel" onMenuClick={() => setNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-gray-50">{children}</main>
      </div>
    </div>
  );
}

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">Loading…</div>}>
      <AdminProjectsProvider>
        <AdminShellInner>{children}</AdminShellInner>
      </AdminProjectsProvider>
    </Suspense>
  );
}
