import * as React from "react";
import { cn } from "../lib/utils";
import { Bell, CheckCircle, XCircle, Info, Megaphone } from "lucide-react";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string | null;
  metadata?: Record<string, unknown>;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  ANNOUNCEMENT: <Megaphone className="h-4 w-4" />,
  BOOKING_APPROVED: <CheckCircle className="h-4 w-4 text-emerald-600" />,
  BOOKING_REJECTED: <XCircle className="h-4 w-4 text-red-600" />,
  UNIT_RELEASED: <Info className="h-4 w-4 text-blue-600" />,
  SYSTEM: <Bell className="h-4 w-4" />,
  ADMIN_MESSAGE: <Megaphone className="h-4 w-4 text-amber-600" />,
};

export function NotificationCard({
  notification,
  onMarkRead,
  featured,
  className,
}: {
  notification: NotificationItem;
  onMarkRead?: () => void;
  featured?: boolean;
  className?: string;
}) {
  const isUnread = !notification.readAt;
  const icon = TYPE_ICONS[notification.type] ?? <Bell className="h-4 w-4" />;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-colors",
        featured
          ? "border-brand-300 bg-brand-50/50"
          : isUnread
            ? "border-brand-200 bg-brand-50/30"
            : "border-gray-200",
        className
      )}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          {featured && (
            <span className="mb-1 inline-block text-xs font-semibold uppercase tracking-wide text-brand-600">
              Announcement
            </span>
          )}
          <p className="font-medium text-gray-900">{notification.title}</p>
          <p className="mt-1 text-sm text-gray-600">{notification.message}</p>
          <p className="mt-2 text-xs text-gray-400">{notification.createdAt}</p>
        </div>
        {isUnread && onMarkRead && (
          <button
            type="button"
            onClick={onMarkRead}
            className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
          >
            Mark read
          </button>
        )}
      </div>
    </div>
  );
}
