import * as React from "react";
import { Building2, ClipboardList, Users, Shield, User } from "lucide-react";
import { GhcLogo } from "../assets/ghc-logo";

const DEFAULT_LOGIN_BG = "/images/auth/customer-login-bg.png";

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
  backgroundImage = DEFAULT_LOGIN_BG,
  children,
}: {
  variant?: "admin" | "sales";
  backgroundImage?: string;
  children: React.ReactNode;
}) {
  const features = variant === "admin" ? ADMIN_FEATURES : SALES_FEATURES;
  const portalLabel = variant === "admin" ? "Admin Portal" : "Sales Portal";
  const welcomeTitle = variant === "admin" ? "Admin Portal" : "Sales Portal";

  return (
    <div
      className="relative min-h-[100dvh] bg-[#f8f6f2]"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-white/55 backdrop-blur-[0.5px]" aria-hidden="true" />

      <div className="relative flex min-h-[100dvh] flex-col lg:flex-row">
        {/* Marketing panel */}
        <aside className="hidden w-[48%] shrink-0 flex-col justify-between p-10 xl:p-12 lg:flex">
          <div>
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
            <h2 className="mt-4 text-4xl font-serif text-navy-600 xl:text-[2.75rem]">
              Welcome to <span className="text-brand-500">{welcomeTitle}</span>
            </h2>
            <p className="mt-3 max-w-md text-gray-600">
              {variant === "admin"
                ? "Manage projects, inventory, bookings, and your sales team efficiently."
                : "Access projects, inventory, bookings and stay updated on your performance."}
            </p>
            <div className="mt-6 h-0.5 w-12 rounded-full bg-brand-500" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-3 gap-6 pb-4">
            {features.map((f) => (
              <div key={f.title}>
                <f.icon className="mb-2 h-6 w-6 text-brand-500" />
                <p className="text-sm font-semibold text-navy-600">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Form panel */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="mb-6 flex w-full max-w-md items-center gap-2 lg:hidden">
            <GhcLogo size={40} />
            <div>
              <p className="font-bold text-navy-600">Goyal Hariyana Sales</p>
              <p className="text-xs text-brand-600">{portalLabel}</p>
            </div>
          </div>
          <div className="w-full max-w-md rounded-2xl border border-gray-200/60 bg-white p-6 shadow-lg sm:p-8">
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
        </main>
      </div>
    </div>
  );
}
