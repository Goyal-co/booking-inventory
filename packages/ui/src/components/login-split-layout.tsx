import * as React from "react";
import { Building2, ClipboardList, Users, Shield, User } from "lucide-react";
import { cn } from "../lib/utils";
import { GhcLogo } from "../assets/ghc-logo";

const ADMIN_FEATURES = [
  { icon: Building2, title: "Project & Inventory", desc: "Manage projects, towers, units and inventory." },
  { icon: ClipboardList, title: "Bookings & Customers", desc: "Track bookings, customers and payment status." },
  { icon: Users, title: "Sales Team Management", desc: "Manage sales users, roles and performance." },
];

const SALES_FEATURES = [
  { icon: Building2, title: "Access Projects", desc: "View project details, inventory and unit availability." },
  { icon: ClipboardList, title: "Manage Bookings", desc: "Create bookings and track their real-time status." },
  { icon: Users, title: "Track Performance", desc: "Monitor your sales, bookings and achievements." },
];

export function LoginSplitLayout({
  variant = "admin",
  children,
}: {
  variant?: "admin" | "sales";
  children: React.ReactNode;
}) {
  const features = variant === "admin" ? ADMIN_FEATURES : SALES_FEATURES;
  const portalLabel = variant === "admin" ? "Admin Portal" : "Sales Portal";
  const welcomeTitle = variant === "admin" ? "Admin Portal" : "Sales Portal";

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-gray-50 to-white p-8 lg:flex lg:p-12">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="h-full w-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAyMDBMNDAwIDQwMEwwIDQwMFoiIGZpbGw9IiMwMDAiLz48L3N2Zz4=')] bg-cover bg-center" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3">
            <GhcLogo size={48} />
            <div>
              <h1 className="text-xl font-bold text-navy-600">Goyal Hariyana Sales</h1>
              <p className="text-sm font-medium text-brand-600">{portalLabel}</p>
            </div>
          </div>
          <p className="mt-8 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
            <Building2 className="h-4 w-4" />
            Building Trust. Creating Landmarks.
          </p>
          <h2 className="mt-4 text-4xl font-serif text-navy-600">
            Welcome to <span className="text-brand-500">{welcomeTitle}</span>
          </h2>
          <p className="mt-3 max-w-md text-gray-600">
            {variant === "admin"
              ? "Manage projects, inventory, bookings, and your sales team efficiently."
              : "Access projects, inventory, bookings and stay updated on your performance."}
          </p>
        </div>
        <div className="relative grid grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title}>
              <f.icon className="mb-2 h-6 w-6 text-brand-500" />
              <p className="text-sm font-semibold text-navy-600">{f.title}</p>
              <p className="mt-1 text-xs text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center bg-white p-6 lg:max-w-md lg:flex-none lg:p-12">
        <div className="mb-6 flex items-center gap-2 lg:hidden">
          <GhcLogo size={40} />
          <div>
            <p className="font-bold text-navy-600">Goyal Hariyana Sales</p>
            <p className="text-xs text-brand-600">{portalLabel}</p>
          </div>
        </div>
        <div className="w-full max-w-sm">
          <div className="mb-6 flex justify-center">
            {variant === "admin" ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                <Shield className="h-7 w-7 text-brand-600" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
                <User className="h-7 w-7 text-brand-600" />
              </div>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
