"use client";

import { Suspense, useState } from "react";
import { MobileShellHeader } from "@booking/ui";
import { SalesMobileNav, Sidebar } from "@/components/sidebar";
import { SalesProjectsProvider } from "@/contexts/sales-projects-provider";

function SalesShellInner({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen min-h-0 overflow-hidden">
      <Sidebar className="hidden lg:flex" />
      <SalesMobileNav open={navOpen} onOpenChange={setNavOpen} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <MobileShellHeader title="Sales Portal" onMenuClick={() => setNavOpen(true)} />
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}

export function SalesAppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Loading…</div>}>
      <SalesProjectsProvider>
        <SalesShellInner>{children}</SalesShellInner>
      </SalesProjectsProvider>
    </Suspense>
  );
}
