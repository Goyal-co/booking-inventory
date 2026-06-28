"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, formatPrice, ClientDateTime, FilterBar, PageHeader, KpiGrid, StatCard, Badge, Button, type FilterConfig } from "@booking/ui";
import { BookOpen, IndianRupee, Calendar } from "lucide-react";
import { SalesProjectScopeSelect } from "@/components/sales-project-scope-select";
import { useSelectedProject } from "@/hooks/use-selected-project";

type BookingStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";

interface BookingRow {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: string;
  bookedAt: string;
  submittedAt: string;
  status: BookingStatus;
  adminComment: string | null;
  projectId: string;
  projectName: string;
  unit: { unitNumber: string; floor: { tower: { name: string } } };
}

const STATUS_LABELS: Record<BookingStatus, { label: string; className: string }> = {
  PENDING: { label: "Pending", className: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-600" },
};

function BookingsDoneContent() {
  const { projects, loading } = useSelectedProject();
  const [scopeProjectId, setScopeProjectId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [bookingStats, setBookingStats] = useState<{ total: number; totalRevenue: number; thisMonth: number } | null>(null);

  useEffect(() => {
    fetch("/api/bookings/stats").then((r) => r.json()).then((d) => setBookingStats(d.stats ?? null));
  }, []);

  const filterProjectId = scopeProjectId ?? projects[0]?.id ?? null;

  const assignedProjectIds = new Set(projects.map((p) => p.id));
  const showProjectColumn = scopeProjectId === null;

  useEffect(() => {
    if (!filterProjectId) {
      setFilters([]);
      return;
    }
    setFilterValues((prev) => (prev.status ? { status: prev.status } : {} as Record<string, string>));
    fetch(`/api/filters?projectId=${filterProjectId}`)
      .then((r) => r.json())
      .then((d) => setFilters(d.filters ?? []));
  }, [filterProjectId]);

  const loadBookings = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    const params = new URLSearchParams(scopeProjectId ? { projectId: scopeProjectId } : { projectId: "all" });
    if (search.trim()) params.set("search", search.trim());
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    try {
      const res = await fetch(`/api/bookings/list?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setFetchError(d.error ?? "Failed to load bookings");
        setBookings([]);
      } else {
        setBookings(d.bookings ?? []);
      }
    } catch {
      setFetchError("Failed to load bookings");
      setBookings([]);
    } finally {
      setFetching(false);
    }
  }, [scopeProjectId, search, filterValues, dateFrom, dateTo]);

  useEffect(() => {
    if (!loading) loadBookings();
  }, [loading, loadBookings]);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterValues({});
    setDateFrom("");
    setDateTo("");
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      search.trim() !== "" ||
      Object.values(filterValues).some(Boolean) ||
      dateFrom !== "" ||
      dateTo !== "",
    [search, filterValues, dateFrom, dateTo]
  );

  if (loading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <PageHeader
        title="Bookings Done"
        description="Completed and approved bookings across all projects."
        actions={
          <SalesProjectScopeSelect
            projects={projects}
            scopeProjectId={scopeProjectId}
            onChange={setScopeProjectId}
          />
        }
      />

      {bookingStats && (
        <KpiGrid className="mb-6 max-w-3xl">
          <StatCard label="Total Bookings" value={bookingStats.total} icon={<BookOpen className="h-5 w-5" />} />
          <StatCard label="Total Sales Value" value={formatPrice(bookingStats.totalRevenue)} icon={<IndianRupee className="h-5 w-5" />} />
          <StatCard label="This Month" value={bookingStats.thisMonth} icon={<Calendar className="h-5 w-5" />} />
        </KpiGrid>
      )}

      <div className="mb-4">
          <FilterBar
            filters={filters}
            values={filterValues}
            onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search customer name or unit number..."
            extraSelects={[
              {
                key: "status",
                label: "All statuses",
                options: [
                  { value: "PENDING", label: "Pending" },
                  { value: "CONFIRMED", label: "Confirmed" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "CANCELLED", label: "Cancelled" },
                ],
              },
            ]}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClearAll={hasActiveFilters ? clearFilters : undefined}
          />
        </div>
        {projects.length === 0 ? (
          <p className="text-gray-500">No projects assigned. Contact your admin.</p>
        ) : fetchError ? (
          <p className="text-red-600">{fetchError}</p>
        ) : fetching ? (
          <p className="text-gray-500">Loading bookings...</p>
        ) : bookings.length === 0 ? (
          <p className="text-gray-500">No bookings yet.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const revoked = !assignedProjectIds.has(b.projectId);
              const statusInfo = STATUS_LABELS[b.status] ?? STATUS_LABELS.CONFIRMED;
              return (
                <Card key={b.id}>
                  <CardContent className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="font-bold text-gray-900">{b.unit.unitNumber}</p>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                        >
                          {statusInfo.label}
                        </span>
                      </div>
                      {showProjectColumn && (
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm text-gray-500">{b.projectName}</span>
                          {revoked && (
                            <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700">
                              No longer assigned
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-500">{b.unit.floor.tower.name}</p>
                      <p className="text-sm">
                        {b.customerName} · {b.customerPhone}
                      </p>
                      {b.status === "REJECTED" && b.adminComment && (
                        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                          <strong>Admin note:</strong> {b.adminComment}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-brand-600">
                        {formatPrice(Number(b.totalPrice))}
                      </p>
                      <ClientDateTime
                        value={b.status === "PENDING" ? b.submittedAt : b.bookedAt}
                        className="text-xs text-gray-400"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

export default function BookingsDonePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center">Loading...</div>}>
      <BookingsDoneContent />
    </Suspense>
  );
}
