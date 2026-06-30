"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  ProjectStatusBadge,
  formatBlockDuration,
  canBlockUnits,
  DashboardRangeSelect,
  BookingsTrendChart,
  BhkBreakdownChart,
  PageHeader,
  KpiGrid,
  StatCard,
  formatPrice,
  TablePagination,
} from "@booking/ui";
import { Building2, BookOpen, BarChart3, Zap } from "lucide-react";
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
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
  lifecycleStatus: "UPCOMING" | "LAUNCH_DAY" | "ONGOING";
  blockDurationMs: number;
  maxBlocksPerUser: number;
  requiresBookingApproval: boolean;
  launchDate: string | null;
  analytics: {
    activeBlocks: number;
    pendingBookings: number;
    myBookingsTotal: number;
    conversionRate: number;
    totalValue: number;
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?range=${range}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .finally(() => setLoading(false));
  }, [range]);

  const totalBookings = projects.reduce((s, p) => s + p.analytics.myBookingsTotal, 0);
  const filtered = projects.filter(
    (p) => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

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
        <StatCard label="Total Bookings" value={totalBookings} subtitle="Confirmed bookings" icon={<BookOpen className="h-5 w-5" />} />
      </KpiGrid>

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects assigned. Contact your admin.</p>
      ) : (
        <>
          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {projects.map((project) => (
              <Card key={project.id} className="overflow-hidden">
                <div className="relative h-36 bg-gradient-to-br from-gray-100 to-gray-200">
                  {project.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Building2 className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute right-3 top-3">
                    <ProjectStatusBadge status={project.lifecycleStatus} />
                  </div>
                </div>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-500">{project.description}</p>
                    )}
                    {project.requiresBookingApproval && (
                      <span className="mt-1 inline-block rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        Approval required
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-gray-50 p-2">
                      <p className="text-xs text-gray-500">Active Blocks</p>
                      <p className="text-lg font-bold">{project.analytics.activeBlocks}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-2">
                      <p className="text-xs text-amber-600">Pending</p>
                      <p className="text-lg font-bold">{project.analytics.pendingBookings}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-2">
                      <p className="text-xs text-emerald-600">Bookings</p>
                      <p className="text-lg font-bold">{project.analytics.myBookingsTotal}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                      <p className="text-xs text-emerald-600">Total Value</p>
                      <p className="font-bold text-emerald-700">{formatPrice(project.analytics.totalValue)}</p>
                    </div>
                    <div className="rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                      <p className="text-xs text-purple-600">Conversion</p>
                      <p className="font-bold text-purple-700">{project.analytics.conversionRate}%</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setExpandedId(expandedId === project.id ? null : project.id)}
                    >
                      <BarChart3 className="mr-1.5 h-4 w-4" />
                      {expandedId === project.id ? "Hide Analytics" : "View Analytics"}
                    </Button>
                    <Button className="flex-1" size="sm" asChild disabled={project.lifecycleStatus === "UPCOMING"}>
                      <Link href={`/app/live?projectId=${project.id}`}>
                        <Zap className="mr-1.5 h-4 w-4" />
                        Enter Live Booking
                      </Link>
                    </Button>
                  </div>

                  {expandedId === project.id && project.charts && (
                    <div className="space-y-4 border-t pt-4">
                      <BookingsTrendChart data={project.charts.bookingsTrend} />
                      <BhkBreakdownChart data={project.charts.byBhk} />
                    </div>
                  )}

                  <p className="text-xs text-gray-400">{blockRulesSummary(project)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-gray-900">Projects Summary</h3>
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search project..."
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Active Blocks</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Bookings</th>
                    <th className="px-4 py-3">Total Value</th>
                    <th className="px-4 py-3">Conversion</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">{p.analytics.activeBlocks}</td>
                      <td className="px-4 py-3">{p.analytics.pendingBookings}</td>
                      <td className="px-4 py-3">{p.analytics.myBookingsTotal}</td>
                      <td className="px-4 py-3 font-medium text-emerald-600">{formatPrice(p.analytics.totalValue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-brand-500"
                              style={{ width: `${Math.min(100, p.analytics.conversionRate)}%` }}
                            />
                          </div>
                          <span>{p.analytics.conversionRate}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/app/live?projectId=${p.id}`}>View Details</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              className="border-t border-gray-100 px-4"
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
