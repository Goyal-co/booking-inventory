"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ProjectStatusBadge,
  formatBlockDuration,
  canBlockUnits,
  DashboardRangeSelect,
  BookingsTrendChart,
  BhkBreakdownChart,
  PageHeader,
  KpiGrid,
  StatCard,
} from "@booking/ui";
import { Building2, BookOpen } from "lucide-react";
import { Toaster } from "sonner";

interface ProjectCharts {
  bookingsTrend: Array<{ date: string; count: number; revenue: number }>;
  byBhk: Array<{ name: string; count: number }>;
  funnel: { blocks: number; bookings: number; conversionRate: number };
}

interface DashboardProject {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  blockDurationMs: number;
  maxBlocksPerUser: number;
  requiresBookingApproval: boolean;
  analytics: {
    activeBlocks: number;
    pendingBookings: number;
    myBookingsTotal: number;
    conversionRate: number;
  };
  charts?: ProjectCharts;
}

function blockRulesSummary(project: DashboardProject): string {
  if (!canBlockUnits(project.lifecycleStatus)) return "No blocking — view only";
  return `${formatBlockDuration(project.blockDurationMs)} blocks · max ${project.maxBlocksPerUser}`;
}

export function SalesProjectsPage() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?range=${range}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, [range]);

  const totalBookings = projects.reduce((s, p) => s + p.analytics.myBookingsTotal, 0);

  if (loading) {
    return <div className="flex h-full items-center justify-center p-6 text-gray-500">Loading projects...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="My Projects"
        description="Projects assigned to you and their performance overview."
        actions={<DashboardRangeSelect value={range} onChange={setRange} />}
      />

      <KpiGrid className="mb-6 max-w-2xl">
        <StatCard label="Total Projects" value={projects.length} subtitle="Assigned to you" icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Total Bookings" value={totalBookings} trend={{ value: "25% vs last 30 days", positive: true }} icon={<BookOpen className="h-5 w-5" />} />
      </KpiGrid>

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects assigned. Contact your admin.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden">
              <CardHeader className="pb-3" style={{ borderTop: `4px solid ${project.primaryColor}` }}>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <ProjectStatusBadge status={project.lifecycleStatus} />
                </div>
                <p className="text-sm text-gray-500">{blockRulesSummary(project)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Active Blocks</p>
                    <p className="text-xl font-bold">{project.analytics.activeBlocks}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-xs text-amber-600">Pending</p>
                    <p className="text-xl font-bold">{project.analytics.pendingBookings}</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-600">Bookings</p>
                    <p className="text-xl font-bold">{project.analytics.myBookingsTotal}</p>
                  </div>
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}>
                  {expandedId === project.id ? "Hide analytics" : "View Analytics"}
                </Button>

                {expandedId === project.id && project.charts && (
                  <div className="space-y-4 border-t pt-4">
                    <BookingsTrendChart data={project.charts.bookingsTrend} />
                    <BhkBreakdownChart data={project.charts.byBhk} />
                  </div>
                )}

                <Button className="w-full" asChild disabled={project.lifecycleStatus === "UPCOMING"}>
                  <Link href={`/app/live?projectId=${project.id}`}>Enter Live Booking</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
