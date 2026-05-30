"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  AnalyticsChartGrid,
  DashboardRangeSelect,
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

function AdminDashboardContent() {
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

  const cards = stats
    ? [
        { label: "Total Units", value: stats.totalUnits, color: "text-gray-900" },
        { label: "Available", value: stats.available, color: "text-emerald-600" },
        { label: "Blocked", value: stats.blocked, color: "text-amber-600" },
        { label: "Booked", value: stats.booked, color: "text-red-600" },
        { label: "Active Blocks", value: stats.activeBlocks, color: "text-blue-600" },
        { label: "Bookings Today", value: stats.todayBookings, color: "text-brand-600" },
        { label: "Total Bookings", value: stats.totalBookings, color: "text-purple-600" },
        ...(stats.pendingBookings > 0
          ? [{ label: "Pending Approval", value: stats.pendingBookings, color: "text-blue-600" }]
          : []),
      ]
    : [];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {selectedProject ? selectedProject.name : "All projects in your organization"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardRangeSelect value={range} onChange={setRange} />
          <AdminProjectSelect
            projects={projects}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {charts && <AnalyticsChartGrid {...charts} />}
      {!stats && !loading && <p className="mt-4 text-gray-500">No data available.</p>}
      {loading && <p className="mt-4 text-gray-500">Loading stats...</p>}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="p-6">Loading dashboard...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
