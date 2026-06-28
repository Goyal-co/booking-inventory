"use client";

import { useEffect, useState } from "react";
import {
  PageHeader,
  SegmentedTabs,
  NotificationCard,
  Button,
  KpiGrid,
  StatCard,
  type NotificationItem,
} from "@booking/ui";
import Link from "next/link";
import { toast, Toaster } from "sonner";

export default function AdminNotificationsPage() {
  const [tab, setTab] = useState("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [stats, setStats] = useState<{ unread: number; announcementsThisWeek: number } | null>(null);

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
      });
    fetch("/api/notifications/unread-count")
      .then((r) => r.json())
      .then((d) => setStats((s) => ({ unread: d.count, announcementsThisWeek: s?.announcementsThisWeek ?? 0 })));
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
    <div className="p-4 md:p-6">
      <Toaster position="top-right" richColors />
      <PageHeader
        title="Notifications"
        description="Stay updated with system activity and announcements."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllRead}>
              Mark all as read
            </Button>
            <Link href="/admin/settings">
              <Button variant="outline" size="sm">
                Settings
              </Button>
            </Link>
          </div>
        }
      />

      {stats && (
        <KpiGrid className="mb-6 max-w-2xl">
          <StatCard label="Unread" value={stats.unread} />
          <StatCard label="Announcements This Week" value={stats.announcementsThisWeek} />
        </KpiGrid>
      )}

      <SegmentedTabs
        className="mb-4"
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
  );
}
