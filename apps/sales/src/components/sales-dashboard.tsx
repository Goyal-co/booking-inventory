"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  PageHeader,
  KpiGrid,
  StatCard,
  DashboardRangeSelect,
  BookingsTrendChart,
  ChartCard,
  Badge,
  formatPrice,
} from "@booking/ui";
import { BookOpen, IndianRupee, Building2, TrendingUp } from "lucide-react";
import { Toaster } from "sonner";

export function SalesDashboard() {
  const { data: session } = useSession();
  const [range, setRange] = useState("30d");
  const [projects, setProjects] = useState<Array<{
    id: string;
    name: string;
    analytics: { myBookingsTotal: number; bookingsTotal: number };
    charts?: { bookingsTrend: Array<{ date: string; count: number; revenue: number }>; funnel: { conversionRate: number } };
  }>>([]);
  const [bookingStats, setBookingStats] = useState<{
    total: number;
    totalRevenue: number;
    thisMonth: number;
  } | null>(null);
  const [recentBookings, setRecentBookings] = useState<Array<{
    id: string;
    customerName: string;
    totalPrice: string;
    status: string;
    unit: { unitNumber: string };
  }>>([]);

  useEffect(() => {
    fetch(`/api/dashboard?range=${range}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
    fetch("/api/bookings/stats")
      .then((r) => r.json())
      .then((d) => setBookingStats(d.stats ?? null));
    fetch("/api/bookings/list")
      .then((r) => r.json())
      .then((d) => setRecentBookings((d.bookings ?? []).slice(0, 5)));
  }, [range]);

  const totalBookings = bookingStats?.total ?? projects.reduce((s, p) => s + p.analytics.myBookingsTotal, 0);
  const trendData = projects[0]?.charts?.bookingsTrend ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session?.user?.name?.split(" ")[0] ?? "there"} 👋`}
        actions={<DashboardRangeSelect value={range} onChange={setRange} />}
      />

      <KpiGrid className="mb-6">
        <StatCard label="Total Bookings" value={totalBookings} subtitle="All confirmed bookings" icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Total Sales Value" value={formatPrice(bookingStats?.totalRevenue ?? 0)} subtitle="From confirmed bookings" icon={<IndianRupee className="h-5 w-5" />} />
        <StatCard label="Active Projects" value={projects.length} subtitle="Assigned to you" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="This Month" value={bookingStats?.thisMonth ?? 0} subtitle="Bookings this month" icon={<TrendingUp className="h-5 w-5" />} />
      </KpiGrid>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Bookings Trend">
          {trendData.length > 0 ? (
            <BookingsTrendChart data={trendData} />
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">No booking data yet.</p>
          )}
        </ChartCard>

        <ChartCard title="Project Performance">
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.analytics.myBookingsTotal} bookings</p>
                </div>
                <p className="text-sm font-semibold text-brand-600">
                  {p.charts?.funnel.conversionRate ?? 0}% conversion
                </p>
              </div>
            ))}
            <Link href="/app/projects" className="text-sm font-medium text-brand-600 hover:underline">
              View all projects →
            </Link>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Recent Bookings">
        <div className="space-y-3">
          {recentBookings.map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0">
              <div>
                <p className="font-medium">{b.unit.unitNumber}</p>
                <p className="text-sm text-gray-500">{b.customerName}</p>
              </div>
              <div className="text-right">
                <Badge variant={b.status === "CONFIRMED" ? "success" : b.status === "REJECTED" ? "danger" : "warning"}>
                  {b.status}
                </Badge>
                <p className="mt-1 text-sm font-semibold text-brand-600">{formatPrice(Number(b.totalPrice))}</p>
              </div>
            </div>
          ))}
          {recentBookings.length === 0 && (
            <p className="text-sm text-gray-500">No recent bookings.</p>
          )}
          <Link href="/app/bookings" className="text-sm font-medium text-brand-600 hover:underline">
            View all bookings →
          </Link>
        </div>
      </ChartCard>
    </div>
  );
}
