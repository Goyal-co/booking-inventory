"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@booking/ui";
import { ArrowRight, Clock, Headphones, Shield } from "lucide-react";

const DASHBOARD_BG =
  "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(30,58,95,0.78)), radial-gradient(circle at top left, rgba(251,191,36,0.35), transparent 28%), radial-gradient(circle at bottom right, rgba(59,130,246,0.28), transparent 32%), linear-gradient(180deg, #f8f6f2 0%, #eef2f7 100%)";

function DashboardContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<{
    customer: {
      name: string;
      email: string;
      bookings: Array<{
        id: string;
        status: string;
        totalPrice: string;
        unit: { unitNumber: string; floor: { tower: { name: string; project: { name: string } } } };
        payments: Array<{ stageName: string; amountDue: string; amountPaid: string; dueDate: string | null }>;
        digitalForm: { status: string; submittedAt: string | null } | null;
      }>;
    };
    constructionReports: Array<{ title: string; fileUrl: string; publishedAt: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const parseJsonSafe = async (res: Response) => {
      const text = await res.text();
      if (!text) return {};
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return {};
      }
    };
    fetch(`/api/dashboard?token=${encodeURIComponent(token)}`)
      .then(async (r) => ({ ok: r.ok, data: await parseJsonSafe(r) }))
      .then(({ ok, data }) => {
        if (!ok || !data.customer) {
          setError(typeof data.error === "string" ? data.error : "Unable to load customer dashboard");
          return;
        }
        setError(null);
        setData(data as typeof data & {
          customer: {
            name: string;
            email: string;
            bookings: Array<{
              id: string;
              status: string;
              totalPrice: string;
              unit: { unitNumber: string; floor: { tower: { name: string; project: { name: string } } } };
              payments: Array<{ stageName: string; amountDue: string; amountPaid: string; dueDate: string | null }>;
              digitalForm: { status: string; submittedAt: string | null } | null;
            }>;
          };
          constructionReports: Array<{ title: string; fileUrl: string; publishedAt: string }>;
        });
      });
  }, [token]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-gray-500">Use the booking link from your email to access your dashboard.</p>
      </div>
    );
  }

  if (!data?.customer) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div>
          <p className="font-medium text-navy-600">{error ?? "Loading..."}</p>
          {error ? (
            <p className="mt-2 text-sm text-gray-500">Use the booking link from your email to open the right dashboard.</p>
          ) : null}
        </div>
      </div>
    );
  }

  const booking = data.customer.bookings[0];
  const firstName = data.customer.name.split(" ")[0] || data.customer.name;
  const statusSteps = [
    { title: "Booking Link Received", done: true },
    { title: "Form Saved", done: Boolean(booking?.digitalForm) },
    { title: "Booking Submitted", done: booking?.digitalForm?.status === "SUBMITTED" },
    { title: "Sales Review", done: ["PENDING", "CONFIRMED"].includes(booking?.status ?? "") },
    { title: "Booking Confirmed", done: booking?.status === "CONFIRMED" },
  ];
  const totalDue = booking?.payments.reduce((sum, p) => sum + Number(p.amountDue), 0) ?? 0;
  const totalPaid = booking?.payments.reduce((sum, p) => sum + Number(p.amountPaid), 0) ?? 0;

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundImage: DASHBOARD_BG,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="absolute inset-0 bg-white/70" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-600">Customer Portal</p>
            <h1 className="font-serif text-3xl font-semibold text-navy-600">Welcome, {firstName}</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track your booking, payments, and project updates in one place.
            </p>
          </div>
          <a href="mailto:support@goyalprojects.com">
            <Button variant="outline" size="sm">
              <Headphones className="mr-1.5 h-4 w-4" />
              Need Help?
            </Button>
          </a>
        </div>

        {booking ? (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Project</p>
                <p className="mt-2 text-lg font-semibold text-navy-600">{booking.unit.floor.tower.project.name}</p>
                <p className="text-sm text-gray-500">{booking.unit.floor.tower.name} · Unit {booking.unit.unitNumber}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Booking Status</p>
                <p className="mt-2 text-lg font-semibold text-navy-600">{booking.status}</p>
                <p className="text-sm text-gray-500">
                  Form: {booking.digitalForm?.status ?? "Not started"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white/95 p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Financial Summary</p>
                <p className="mt-2 text-lg font-semibold text-navy-600">
                  ₹{Number(booking.totalPrice).toLocaleString("en-IN")}
                </p>
                <p className="text-sm text-gray-500">Paid: ₹{totalPaid.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-navy-600">Your Booking Journey</h2>
              <div className="grid gap-3 md:grid-cols-5">
                {statusSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className={`rounded-xl border p-4 text-center ${
                      step.done ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Step {index + 1}
                    </p>
                    <p className="mt-2 text-sm font-medium text-gray-900">{step.title}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-navy-600">Payment Schedule</h3>
                    <span className="text-sm text-gray-500">Total due: ₹{totalDue.toLocaleString("en-IN")}</span>
                  </div>
                  {booking.payments.length === 0 ? (
                    <p className="text-sm text-gray-400">No payment records yet</p>
                  ) : (
                    <div className="space-y-3">
                      {booking.payments.map((p) => (
                        <div key={p.stageName} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-gray-900">{p.stageName}</p>
                              <p className="text-xs text-gray-500">
                                {p.dueDate ? `Due ${new Date(p.dueDate).toLocaleDateString()}` : "Due date to be announced"}
                              </p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="text-gray-600">Due: ₹{Number(p.amountDue).toLocaleString("en-IN")}</p>
                              <p className="font-medium text-emerald-700">Paid: ₹{Number(p.amountPaid).toLocaleString("en-IN")}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-navy-600">Construction Updates</h3>
                  {data.constructionReports.length === 0 ? (
                    <p className="text-sm text-gray-400">No reports published</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.constructionReports.map((r) => (
                        <li key={r.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <a href={r.fileUrl} className="font-medium text-brand-600 underline" target="_blank" rel="noreferrer">
                            {r.title}
                          </a>
                          <p className="mt-1 text-xs text-gray-500">
                            Published on {new Date(r.publishedAt).toLocaleDateString()}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
                  <h3 className="mb-3 text-lg font-semibold text-navy-600">Quick Actions</h3>
                  <div className="space-y-3">
                    {token && (
                      <a href={`/booking/${token}`} className="block">
                        <Button className="w-full justify-between">
                          Continue Booking Form
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    <a href="mailto:support@goyalprojects.com" className="block">
                      <Button variant="outline" className="w-full justify-between">
                        Contact Support
                        <Headphones className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
                  <h3 className="mb-3 text-lg font-semibold text-navy-600">Why this portal helps</h3>
                  <div className="space-y-4 text-sm text-gray-600">
                    <div className="flex gap-3">
                      <Shield className="mt-0.5 h-4 w-4 text-brand-600" />
                      <p>Your booking details and uploaded documents stay tied to your secure booking link.</p>
                    </div>
                    <div className="flex gap-3">
                      <Clock className="mt-0.5 h-4 w-4 text-brand-600" />
                      <p>You can save progress step-by-step and return later using the same booking link.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white/95 p-6 shadow-sm">
            <p className="text-sm text-gray-500">No confirmed bookings yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <DashboardContent />
    </Suspense>
  );
}
