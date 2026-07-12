"use client";

import { Suspense, useEffect, useState } from "react";
import { BookOpen, Clock, CheckCircle, IndianRupee } from "lucide-react";
import { Button, formatPrice, ClientDateTime, Modal, Label, FilterBar, PageHeader, Card, CardContent, KpiGrid, StatCard, BookingCard, SegmentedTabs, TablePagination } from "@booking/ui";
import { toast, Toaster } from "sonner";
import { AdminProjectSelect } from "@/components/admin-project-select";
import { useAdminProject } from "@/hooks/use-admin-project";

type BookingStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED";
type StatusTab = "PENDING" | "CONFIRMED" | "REJECTED" | "all";

interface BookingRow {
  id: string;
  customerName: string;
  customerPhone: string;
  totalPrice: string;
  bookedAt: string;
  submittedAt: string;
  status: BookingStatus;
  adminComment: string | null;
  hasForm?: boolean;
  user: { name: string };
  unit: {
    unitNumber: string;
    floor: { tower: { name: string; project?: { name: string } } };
  };
}

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "PENDING", label: "Pending" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "REJECTED", label: "Rejected" },
  { id: "all", label: "All" },
];

function AdminBookingsContent() {
  const { projects, selectedProjectId, selectedProject, setSelectedProjectId, loading } =
    useAdminProject();
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterConfigs, setFilterConfigs] = useState<Array<{ dimension: string; label: string; options: Array<{ value: string; label: string }> }>>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [bookingStats, setBookingStats] = useState<{
    total: number;
    pending: number;
    confirmed: number;
    totalRevenue: number;
    rejected?: number;
  } | null>(null);
  const [cancelling, setCancelling] = useState<BookingRow | null>(null);
  const [rejecting, setRejecting] = useState<BookingRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const parseJsonSafe = async (res: Response) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const getErrorMessage = (data: Record<string, unknown>, fallback: string) =>
    typeof data.error === "string" ? data.error : fallback;

  const loadBookings = () => {
    if (loading) return;
    const params = new URLSearchParams();
    params.set("projectId", selectedProjectId ?? "all");
    if (statusTab !== "all") params.set("status", statusTab);
    if (search.trim()) params.set("search", search.trim());
    if (filterValues.tower) params.set("tower", filterValues.tower);
    if (filterValues.bhk) params.set("bhk", filterValues.bhk);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(page));
    params.set("limit", "12");
    fetch(`/api/bookings?${params}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        setBookings(d.bookings ?? []);
        setTotal(d.total ?? 0);
      });
  };

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams();
    params.set("projectId", selectedProjectId ?? "all");
    fetch(`/api/bookings/stats?${params}`)
      .then((r) => r.json())
      .then((d) => setBookingStats(d.stats ?? null));
  }, [selectedProjectId, loading]);

  useEffect(() => {
    if (selectedProjectId) {
      fetch(`/api/filters?projectId=${selectedProjectId}`)
        .then((r) => r.json())
        .then((d) => setFilterConfigs(d.filters ?? []));
    } else {
      setFilterConfigs([]);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadBookings();
  }, [selectedProjectId, loading, statusTab, search, filterValues, dateFrom, dateTo, page]);

  const handleCancel = async () => {
    if (!cancelling || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${cancelling.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: cancelReason || undefined }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booking cancelled");
      setCancelling(null);
      setCancelReason("");
      loadBookings();
    } else {
      const data = await parseJsonSafe(res);
      toast.error(getErrorMessage(data, "Failed to cancel booking"));
    }
  };

  const handleApprove = async (booking: BookingRow) => {
    if (submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booking approved");
      loadBookings();
    } else {
      const data = await parseJsonSafe(res);
      toast.error(getErrorMessage(data, "Failed to approve booking"));
    }
  };

  const handleReject = async () => {
    if (!rejecting || !rejectComment.trim() || submitting) return;
    setSubmitting(true);
    const res = await fetch(`/api/bookings/${rejecting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", comment: rejectComment.trim() }),
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Booking rejected");
      setRejecting(null);
      setRejectComment("");
      loadBookings();
    } else {
      const data = await parseJsonSafe(res);
      toast.error(getErrorMessage(data, "Failed to reject booking"));
    }
  };

  const showProjectColumn = !selectedProjectId;

  const statusClass = (status: BookingStatus) =>
    status === "PENDING"
      ? "bg-blue-100 text-blue-800"
      : status === "CONFIRMED"
        ? "bg-emerald-100 text-emerald-800"
        : status === "REJECTED"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-600";

  const BookingActions = ({ booking }: { booking: BookingRow }) => (
    <div className="flex flex-wrap gap-2">
      {booking.hasForm && (
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/bookings/${booking.id}/print-pdf`} target="_blank" rel="noreferrer">
            Download Booking Form
          </a>
        </Button>
      )}
      {booking.status === "PENDING" && (
        <>
          <Button size="sm" disabled={submitting} onClick={() => handleApprove(booking)}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600"
            disabled={submitting}
            onClick={() => {
              setRejecting(booking);
              setRejectComment("");
            }}
          >
            Reject
          </Button>
        </>
      )}
      {booking.status === "CONFIRMED" && (
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          onClick={() => {
            setCancelling(booking);
            setCancelReason("");
          }}
        >
          Cancel
        </Button>
      )}
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Bookings Monitor"
        description={`${selectedProject ? selectedProject.name : "All projects"} · ${bookings.length} booking${bookings.length !== 1 ? "s" : ""}`}
        actions={
          <AdminProjectSelect
            projects={projects}
            selectedProjectId={selectedProjectId}
            onChange={setSelectedProjectId}
          />
        }
      />

      {bookingStats && (
        <KpiGrid className="mb-6">
          <StatCard label="Total Bookings" value={bookingStats.total} subtitle="All-time bookings" icon={<BookOpen className="h-5 w-5" />} />
          <StatCard label="Pending" value={bookingStats.pending} subtitle="Awaiting confirmation" icon={<Clock className="h-5 w-5" />} iconClassName="bg-amber-50 text-amber-600" />
          <StatCard label="Confirmed" value={bookingStats.confirmed} subtitle="Confirmed bookings" icon={<CheckCircle className="h-5 w-5" />} iconClassName="bg-emerald-50 text-emerald-600" />
          <StatCard label="Total Revenue" value={formatPrice(bookingStats.totalRevenue)} subtitle="From confirmed bookings" icon={<IndianRupee className="h-5 w-5" />} />
        </KpiGrid>
      )}

      <div className="mb-4">
        <FilterBar
          filters={filterConfigs as import("@booking/ui").FilterConfig[]}
          values={filterValues}
          onChange={(key, value) => setFilterValues((prev) => ({ ...prev, [key]: value }))}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search customer name or unit number..."
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearAll={() => {
            setSearch("");
            setFilterValues({});
            setDateFrom("");
            setDateTo("");
          }}
        />
      </div>

      <SegmentedTabs
        className="mb-4"
        tabs={STATUS_TABS.map((t) => ({
          id: t.id,
          label: t.label,
          count: t.id === "all" ? bookingStats?.total : t.id === "PENDING" ? bookingStats?.pending : t.id === "CONFIRMED" ? bookingStats?.confirmed : bookingStats?.rejected,
        }))}
        active={statusTab}
        onChange={(id) => {
          setStatusTab(id as StatusTab);
          setPage(1);
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {bookings.map((b) => (
          <div key={b.id} className="space-y-2">
            <BookingCard
              booking={{
                id: b.id,
                unitNumber: b.unit.unitNumber,
                towerName: b.unit.floor.tower.name,
                customerName: b.customerName,
                customerPhone: b.customerPhone,
                totalPrice: b.totalPrice,
                status: b.status,
                bookedAt: b.status === "PENDING" ? b.submittedAt : b.bookedAt,
                salesPerson: b.user.name,
              }}
            />
            <BookingActions booking={b} />
          </div>
        ))}
      </div>

      {bookings.length === 0 && !loading && (
        <p className="py-8 text-center text-gray-500">No bookings for this selection.</p>
      )}

      <TablePagination
        className="mt-6"
        page={page}
        pageSize={12}
        total={total}
        onPageChange={setPage}
      />

      <Modal
        open={!!cancelling}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
        title="Cancel Booking"
      >
        {cancelling && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              This will release <strong>{cancelling.unit.unitNumber}</strong> back to Available.
              Customer: <strong>{cancelling.customerName}</strong>.
            </p>
            <div>
              <Label>Reason (optional)</Label>
              <textarea
                className="mt-1 w-full rounded-lg border p-2 text-sm"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Customer requested cancellation..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelling(null)}>
                Keep Booking
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
                onClick={handleCancel}
              >
                {submitting ? "Cancelling..." : "Cancel Booking"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null);
        }}
        title="Reject Booking"
      >
        {rejecting && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reject booking for <strong>{rejecting.unit.unitNumber}</strong>. The sales agent will
              see your comment.
            </p>
            <div>
              <Label>Comment (required)</Label>
              <textarea
                className="mt-1 w-full rounded-lg border p-2 text-sm"
                rows={3}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Reason for rejection..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting || !rejectComment.trim()}
                onClick={handleReject}
              >
                {submitting ? "Rejecting..." : "Reject Booking"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading bookings...</div>}>
      <AdminBookingsContent />
    </Suspense>
  );
}
