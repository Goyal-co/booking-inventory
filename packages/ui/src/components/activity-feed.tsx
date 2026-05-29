"use client";

import type { ActivityItem } from "../lib/utils";
import { cn } from "../lib/utils";

interface ActivityFeedProps {
  activities: ActivityItem[];
  className?: string;
  maxItems?: number;
}

export function ActivityFeed({ activities, className, maxItems = 20 }: ActivityFeedProps) {
  const items = activities.slice(0, maxItems);

  return (
    <div className={cn("space-y-1", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Live Activity
      </h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">No recent activity</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((activity) => (
            <li
              key={activity.id}
              className="flex items-start gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs animate-in fade-in slide-in-from-top-1"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <div>
                <p className="text-gray-700">{activity.message}</p>
                <p className="text-gray-400">
                  {new Date(activity.createdAt).toLocaleTimeString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatusLegend() {
  const items = [
    { color: "bg-emerald-400", label: "Available" },
    { color: "bg-amber-400", label: "Blocked" },
    { color: "bg-red-400", label: "Booked" },
    { color: "bg-purple-400", label: "Hold (Admin)" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2">
      <span className="text-xs font-semibold text-gray-500">Legend:</span>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-full", item.color)} />
          <span className="text-xs text-gray-600">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
