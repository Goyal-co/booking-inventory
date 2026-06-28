"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  SegmentedTabs,
  NotificationCard,
  Button,
  KpiGrid,
  StatCard,
  Card,
  CardContent,
  type NotificationItem,
} from "@booking/ui";
import { toast, Toaster } from "sonner";

export default function SalesNotificationsPage() {
  const [tab, setTab] = useState("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<{
    unread: number;
    announcementsThisWeek: number;
    lastAdminMessage?: { message: string; createdAt: string } | null;
  } | null>(null);

  const load = () => {
    fetch(`/api/notifications?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        setNotifications(
          (d.notifications ?? []).map((n: NotificationItem & { createdAt: string }) => ({
            ...n,
            createdAt: new Date(n.createdAt).toLocaleString(),
          }))
        );
        if (d.stats) setStats(d.stats);
      });
  };

  useEffect(() => {
    load();
  }, [tab]);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "POST" });
    toast.success("All notifications marked as read");
    load();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Notifications"
        description="Stay updated with bookings, approvals and company announcements."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
            <Link href="/app/settings">
              <Button variant="outline" size="sm">
                Notification Settings
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SegmentedTabs
            tabs={[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread", count: stats?.unread },
              { id: "announcements", label: "Announcements" },
              { id: "booking", label: "Booking Updates" },
              { id: "system", label: "System" },
            ]}
            active={tab}
            onChange={setTab}
          />

          <div className="space-y-3">
            {notifications.map((n, i) => (
              <NotificationCard
                key={n.id}
                notification={n}
                featured={n.type === "ANNOUNCEMENT" && i === 0}
                onMarkRead={async () => {
                  await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
                  load();
                }}
              />
            ))}
            {notifications.length === 0 && (
              <p className="py-8 text-center text-gray-500">No notifications.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {stats && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-sm text-gray-500">Unread</p>
                  <p className="text-3xl font-bold text-brand-600">{stats.unread}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Announcements This Week</p>
                  <p className="text-3xl font-bold text-brand-600">{stats.announcementsThisWeek}</p>
                </div>
                <Button className="w-full" onClick={markAllRead}>
                  Mark all as read
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold">Need Help?</h3>
              <p className="mt-2 text-sm text-gray-500">info.bng@goyalco.com</p>
              <p className="text-sm text-gray-500">+91 80888 66000</p>
              <p className="mt-2 text-xs text-gray-400">Mon - Sat, 10:00 AM to 7:00 PM</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
