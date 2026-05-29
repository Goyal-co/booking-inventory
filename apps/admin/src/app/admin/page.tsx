"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@booking/ui";
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

function AdminDashboardContent() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading } =
    useAdminProject();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (loading) return;
    const query = selectedProjectId ? `projectId=${selectedProjectId}` : "projectId=all";
    fetch(`/api/dashboard?${query}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setStats(d.stats ?? null));
  }, [selectedProjectId, loading]);

  const cards = stats
    ? [
        { label: "Total Units", value: stats.totalUnits, color: "text-gray-900" },
        { label: "Available", value: stats.available, color: "text-emerald-600" },
        { label: "Blocked", value: stats.blocked, color: "text-amber-600" },
        { label: "Booked Units", value: stats.booked, color: "text-red-600" },
        { label: "Active Blocks", value: stats.activeBlocks, color: "text-blue-600" },
        { label: "Bookings Today", value: stats.todayBookings, color: "text-brand-600" },
        { label: "Total Bookings", value: stats.totalBookings, color: "text-purple-600" },
        ...(stats.pendingBookings > 0
          ? [
              {
                label: "Pending Approval",
                value: stats.pendingBookings,
                color: "text-blue-600",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
            {selectedProject ? selectedProject.name : "All projects in your organization"}
          </p>
        </div>
        <AdminProjectSelect
          projects={projects}
          selectedProjectId={selectedProjectId}
          onChange={setSelectedProjectId}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
