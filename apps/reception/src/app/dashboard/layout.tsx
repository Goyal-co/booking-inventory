import { ReceptionAppShell } from "@/components/reception-app-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <ReceptionAppShell>{children}</ReceptionAppShell>;
}
