"use client";

import { Suspense, useEffect, useState } from "react";
import { Button, formatPrice, ClientDateTime, Modal, Label, FilterBar, PageHeader, Card, CardContent } from "@booking/ui";
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
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [cancelling, setCancelling] = useState<BookingRow | null>(null);
  const [rejecting, setRejecting] = useState<BookingRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBookings = () => {
    if (loading) return;
    const params = new URLSearchParams();
    params.set("projectId", selectedProjectId ?? "all");
    if (statusTab !== "all") params.set("status", statusTab);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/bookings?${params}`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setBookings(d.bookings ?? []));
  };

  useEffect(() => {
    loadBookings();
  }, [selectedProjectId, loading, statusTab, search]);

  const handleCancel = async () => {
    if (!cancelling) return;
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
      const data = await res.json();
      toast.error(data.error ?? "Failed to cancel booking");
    }
  };

  const handleApprove = async (booking: BookingRow) => {
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
      const data = await res.json();
      toast.error(data.error ?? "Failed to approve booking");
    }
  };

  const handleReject = async () => {
    if (!rejecting || !rejectComment.trim()) return;
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
      const data = await res.json();
      toast.error(data.error ?? "Failed to reject booking");
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

      <div className="mb-4">
        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => {}}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search customer name or unit number..."
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              statusTab === tab.id
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 lg:hidden">
        {bookings.map((b) => (
          <Card key={b.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{b.unit.unitNumber}</p>
                  <p className="text-sm text-gray-500">{b.unit.floor.tower.name}</p>
                  {showProjectColumn && (
                    <p className="text-sm text-gray-500">{b.unit.floor.tower.project?.name ?? "—"}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusClass(b.status)}`}>
                  {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                </span>
              </div>
              <div>
                <p className="text-sm">{b.customerName}</p>
                <p className="text-xs text-gray-500">{b.customerPhone}</p>
                {b.status === "REJECTED" && b.adminComment && (
                  <p className="mt-1 text-xs text-red-600">{b.adminComment}</p>
                )}
              </div>
              <p className="text-sm text-gray-600">Sales: {b.user.name}</p>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-brand-600">{formatPrice(Number(b.totalPrice))}</p>
                <ClientDateTime
                  value={b.status === "PENDING" ? b.submittedAt : b.bookedAt}
                  className="text-xs text-gray-400"
                />
              </div>
              <BookingActions booking={b} />
            </CardContent>
          </Card>
        ))}
        {bookings.length === 0 && !loading && (
          <p className="text-gray-500">No bookings for this selection.</p>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white lg:block">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {showProjectColumn && (
                <th className="px-4 py-3 text-left font-semibold">Project</th>
              )}
              <th className="px-4 py-3 text-left font-semibold">Unit</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Salesperson</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Price</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t border-gray-100">
                {showProjectColumn && (
                  <td className="px-4 py-3 text-gray-600">
                    {b.unit.floor.tower.project?.name ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3 font-medium">
                  {b.unit.unitNumber}
                  <br />
                  <span className="text-xs text-gray-500">{b.unit.floor.tower.name}</span>
                </td>
                <td className="px-4 py-3">
                  {b.customerName}
                  <br />
                  <span className="text-xs text-gray-500">{b.customerPhone}</span>
                  {b.status === "REJECTED" && b.adminComment && (
                    <p className="mt-1 text-xs text-red-600">{b.adminComment}</p>
                  )}
                </td>
                <td className="px-4 py-3">{b.user.name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusClass(b.status)}`}>
                    {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-brand-600">
                  {formatPrice(Number(b.totalPrice))}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  <ClientDateTime value={b.status === "PENDING" ? b.submittedAt : b.bookedAt} />
                </td>
                <td className="px-4 py-3">
                  <BookingActions booking={b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && !loading && (
          <p className="hidden p-4 text-gray-500 lg:block">No bookings for this selection.</p>
        )}
      </div>

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
