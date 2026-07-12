"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatPrice,
  ClientDateTime,
  FilterBar,
  PageHeader,
  KpiGrid,
  StatCard,
  Badge,
  Button,
  TablePagination,
  type FilterConfig,
} from "@booking/ui";
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
  unit: {
    unitNumber: string;
    bhkType: string | null;
    carpetArea: number | null;
    superArea: number | null;
    floor: { tower: { name: string } };
  };
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
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<{
    booking?: {
      customerName: string;
      customerPhone: string;
      customerEmail?: string | null;
      projectName: string;
      unitNumber: string;
      towerName: string;
      status: string;
    };
    form?: { formData?: Record<string, Record<string, unknown>> | null; status?: string } | null;
    formSnapshot?: {
      formData?: Record<string, Record<string, unknown>> | null;
    } | null;
  } | null>(null);

  useEffect(() => {
    if (!detailBookingId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/bookings/${detailBookingId}/digital-form`)
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) {
          setDetail(null);
          return;
        }
        setDetail(data);
      })
      .finally(() => setDetailLoading(false));
  }, [detailBookingId]);

  useEffect(() => {
    fetch("/api/bookings/stats").then((r) => r.json()).then((d) => setBookingStats(d.stats ?? null));
  }, []);

  const filterProjectId = scopeProjectId ?? projects[0]?.id ?? null;
  const showProjectColumn = scopeProjectId === null;

  useEffect(() => {
    if (!filterProjectId) {
      setFilters([]);
      return;
    }
    setFilterValues((prev) => (prev.status ? { status: prev.status } : ({} as Record<string, string>)));
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

  const pagedBookings = bookings.slice((page - 1) * pageSize, page * pageSize);

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
          <StatCard label="Total Bookings" value={bookingStats.total} subtitle="All confirmed bookings" icon={<BookOpen className="h-5 w-5" />} />
          <StatCard label="Total Sales Value" value={formatPrice(bookingStats.totalRevenue)} subtitle="From confirmed bookings" icon={<IndianRupee className="h-5 w-5" />} />
          <StatCard label="This Month" value={bookingStats.thisMonth} subtitle="Bookings this month" icon={<Calendar className="h-5 w-5" />} />
        </KpiGrid>
      )}

      <div className="mb-4">
        <FilterBar
          filters={filters}
          values={filterValues}
          onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search booking or unit..."
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
        <>
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white text-sm md:block">
            <table className="w-full">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Booking Details</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Booking Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedBookings.map((b) => {
                  const statusInfo = STATUS_LABELS[b.status] ?? STATUS_LABELS.CONFIRMED;
                  const specs = [
                    b.unit.floor.tower.name,
                    b.unit.bhkType,
                    b.unit.carpetArea ? `Carpet: ${b.unit.carpetArea} sqft` : null,
                    b.unit.superArea ? `SBA: ${b.unit.superArea} sqft` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{b.unit.unitNumber}</span>
                          {b.status === "CONFIRMED" && (
                            <Badge className="bg-emerald-100 text-emerald-800">Confirmed</Badge>
                          )}
                        </div>
                        {showProjectColumn && <p className="text-sm text-gray-500">{b.projectName}</p>}
                        <p className="text-xs text-gray-500">{specs}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium">{b.customerName}</p>
                        <p className="text-xs text-gray-500">{b.customerPhone}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-600">
                        <ClientDateTime value={b.status === "PENDING" ? b.submittedAt : b.bookedAt} />
                      </td>
                      <td className="px-4 py-4 font-semibold text-brand-600">
                        {formatPrice(Number(b.totalPrice))}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailBookingId(b.id)}
                          >
                            View Form Data
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <a
                              href={`/api/bookings/${b.id}/print-pdf`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download Booking Form
                            </a>
                          </Button>
                          {b.status === "CONFIRMED" && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/api/bookings/${b.id}/receipt`} target="_blank" rel="noreferrer">
                                Download Receipt
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {pagedBookings.map((b) => {
              const statusInfo = STATUS_LABELS[b.status] ?? STATUS_LABELS.CONFIRMED;
              return (
                <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-bold">{b.unit.unitNumber}</span>
                    <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                  </div>
                  <p className="text-sm text-gray-500">{b.projectName}</p>
                  <p className="text-sm">{b.customerName} · {b.customerPhone}</p>
                  <p className="mt-2 font-semibold text-brand-600">{formatPrice(Number(b.totalPrice))}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetailBookingId(b.id)}>
                      View Form Data
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/bookings/${b.id}/print-pdf`} target="_blank" rel="noreferrer">
                        Download Booking Form
                      </a>
                    </Button>
                    {b.status === "CONFIRMED" && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/api/bookings/${b.id}/receipt`} target="_blank" rel="noreferrer">
                          Download Receipt
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <TablePagination
            className="mt-6"
            page={page}
            pageSize={pageSize}
            total={bookings.length}
            onPageChange={setPage}
          />
        </>
      )}

      {detailBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-navy-600">Customer booking form data</h2>
                {detail?.booking ? (
                  <p className="text-sm text-gray-500">
                    {detail.booking.projectName} · {detail.booking.towerName} · Unit{" "}
                    {detail.booking.unitNumber}
                  </p>
                ) : null}
              </div>
              <Button variant="outline" size="sm" onClick={() => setDetailBookingId(null)}>
                Close
              </Button>
            </div>
            {detailLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : (
              <>
                <div className="mb-4 rounded-xl border bg-gray-50 p-4 text-sm">
                  <p>
                    <strong>Customer:</strong> {detail?.booking?.customerName}
                  </p>
                  <p>
                    <strong>Phone:</strong> {detail?.booking?.customerPhone}
                  </p>
                  <p>
                    <strong>Email:</strong> {detail?.booking?.customerEmail || "—"}
                  </p>
                  <p>
                    <strong>Form status:</strong> {detail?.form?.status || "Snapshot"}
                  </p>
                </div>
                <div className="mb-4">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`/api/bookings/${detailBookingId}/print-pdf`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open printable form (for physical sign)
                    </a>
                  </Button>
                </div>
                <pre className="overflow-x-auto rounded-xl border bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(
                    detail?.form?.formData ?? detail?.formSnapshot?.formData ?? {},
                    null,
                    2
                  )}
                </pre>
              </>
            )}
          </div>
        </div>
      ) : null}
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
