"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle,
  Lock,
  BookOpen,
  Grid3X3,
  Clock,
  TrendingUp,
} from "lucide-react";
import {
  AnalyticsChartGrid,
  DashboardRangeSelect,
  PageHeader,
  KpiGrid,
  StatCard,
  StatCardSkeleton,
} from "@booking/ui";
import { AdminProjectSelect } from "@/components/admin-project-select";
import { useAdminProject } from "@/hooks/use-admin-project";

interface Stats {
  totalUnits: number;
  available: number;
  blocked: number;
  booked: number;
  activeBlocks: number;
  todayBookings: number;
  totalBookings: number;
  pendingBookings: number;
}

interface Charts {
  inventoryByStatus: Array<{ name: string; value: number; color: string }>;
  bookingsTrend: Array<{ date: string; count: number; revenue: number }>;
  byTower: Array<{ name: string; available: number; blocked: number; booked: number }>;
  byBhk: Array<{ name: string; count: number }>;
  salesLeaderboard: Array<{ name: string; blocks: number; bookings: number; conversion: number }>;
  expiringBlocks24h: number;
  avgApprovalHours: number | null;
}

export default function AdminDashboard() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading } =
    useAdminProject();
  const [stats, setStats] = useState<Stats | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [range, setRange] = useState("30d");

  useEffect(() => {
    if (loading) return;
    const query = new URLSearchParams({ range });
    if (selectedProjectId) query.set("projectId", selectedProjectId);
    else query.set("projectId", "all");
    fetch(`/api/dashboard?${query}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        setStats(d.stats ?? null);
        setCharts(d.charts ?? null);
      });
  }, [selectedProjectId, loading, range]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Dashboard"
        description={
          selectedProject ? selectedProject.name : "All projects in your organization"
        }
        actions={
          <>
            <DashboardRangeSelect value={range} onChange={setRange} />
            <AdminProjectSelect
              projects={projects}
              selectedProjectId={selectedProjectId}
              onChange={setSelectedProjectId}
            />
          </>
        }
      />

      {loading || !stats ? (
        <KpiGrid className="mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </KpiGrid>
      ) : (
        <KpiGrid className="mb-6">
          <StatCard label="Total Units" value={stats.totalUnits} icon={<Grid3X3 className="h-5 w-5" />} subtitle="Across all towers" />
          <StatCard label="Available" value={stats.available} icon={<CheckCircle className="h-5 w-5" />} subtitle="Ready to book" iconClassName="bg-emerald-50 text-emerald-600" />
          <StatCard label="Blocked" value={stats.blocked} icon={<Lock className="h-5 w-5" />} subtitle={`${stats.activeBlocks} active blocks`} iconClassName="bg-amber-50 text-amber-600" />
          <StatCard label="Booked" value={stats.booked} icon={<BookOpen className="h-5 w-5" />} subtitle={`${stats.totalBookings} total bookings`} iconClassName="bg-red-50 text-red-600" />
          <StatCard label="Bookings Today" value={stats.todayBookings} icon={<TrendingUp className="h-5 w-5" />} />
          {stats.pendingBookings > 0 && (
            <StatCard label="Pending Approval" value={stats.pendingBookings} icon={<Clock className="h-5 w-5" />} subtitle="Awaiting review" />
          )}
          <StatCard label="Projects" value={projects.length} icon={<Building2 className="h-5 w-5" />} subtitle="In your scope" />
        </KpiGrid>
      )}

      {charts && <AnalyticsChartGrid {...charts} />}
    </div>
  );
}
