import { SalesAppShell } from "@/components/sales-app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <SalesAppShell>{children}</SalesAppShell>;
}
