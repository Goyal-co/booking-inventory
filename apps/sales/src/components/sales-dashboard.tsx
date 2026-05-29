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
} from "@booking/ui";
import { TopBar } from "@/components/top-bar";
import { Toaster } from "sonner";

interface DashboardProject {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  blockDurationMs: number;
  maxBlocksPerUser: number;
  canBlock: boolean;
  blockDurationLabel: string | null;
  launchDate: string | null;
  requiresBookingApproval: boolean;
  analytics: {
    activeBlocks: number;
    bookingsToday: number;
    bookingsTotal: number;
    pendingBookings: number;
    myBookingsTotal: number;
    conversionRate: number;
  };
}

function blockRulesSummary(project: DashboardProject): string {
  if (!canBlockUnits(project.lifecycleStatus)) return "No blocking — view only";
  return `${formatBlockDuration(project.blockDurationMs)} blocks · max ${project.maxBlocksPerUser}`;
}

export function SalesDashboard() {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex h-full items-center justify-center">Loading dashboard...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <Toaster position="top-right" richColors />
      <TopBar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500">
            Overview of your assigned projects and performance
          </p>
        </div>

        {projects.length === 0 ? (
          <p className="text-gray-500">No projects assigned. Contact your admin.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <CardHeader
                  className="pb-3"
                  style={{ borderTop: `4px solid ${project.primaryColor}` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      <ProjectStatusBadge status={project.lifecycleStatus} />
                      {project.requiresBookingApproval && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          Approval required
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">{blockRulesSummary(project)}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Active Blocks</p>
                      <p className="text-xl font-bold text-gray-900">
                        {project.analytics.activeBlocks}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-xs text-blue-600">Pending Approval</p>
                      <p className="text-xl font-bold text-blue-700">
                        {project.analytics.pendingBookings}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Confirmed Today</p>
                      <p className="text-xl font-bold text-gray-900">
                        {project.analytics.bookingsToday}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Confirmed Total</p>
                      <p className="text-xl font-bold text-gray-900">
                        {project.analytics.myBookingsTotal}
                      </p>
                    </div>
                  </div>

                  {project.lifecycleStatus === "UPCOMING" ? (
                    <Button className="w-full" variant="outline" disabled title="Blocking opens on launch day">
                      View Only — Launch Pending
                    </Button>
                  ) : (
                    <Button className="w-full" asChild>
                      <Link href={`/app/live?projectId=${project.id}`}>
                        Enter Live Booking
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
