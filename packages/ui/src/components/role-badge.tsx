import { cn } from "../lib/utils";
import { formatRole } from "../lib/format-role";

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  PROJECT_ADMIN: "bg-blue-100 text-blue-700",
  SALES_MANAGER: "bg-indigo-100 text-indigo-700",
  SALES_EXEC: "bg-sky-100 text-sky-700",
};

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        ROLE_STYLES[role] ?? "bg-gray-100 text-gray-700",
        className
      )}
    >
      {formatRole(role)}
    </span>
  );
}

const ACTION_STYLES: Record<string, string> = {
  BOOKING_APPROVED: "bg-emerald-100 text-emerald-700",
  BOOKING_SUBMITTED: "bg-emerald-100 text-emerald-700",
  BOOKING_REJECTED: "bg-red-100 text-red-700",
  BOOKING_CANCELLED: "bg-gray-100 text-gray-700",
  UNIT_BLOCKED: "bg-red-100 text-red-700",
  UNIT_UNBLOCKED: "bg-blue-100 text-blue-700",
  UNIT_BOOKED: "bg-emerald-100 text-emerald-700",
  UNIT_STATUS_CHANGED: "bg-amber-100 text-amber-700",
};

export function ActionBadge({ action, className }: { action: string; className?: string }) {
  const label = action.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        ACTION_STYLES[action] ?? "bg-gray-100 text-gray-700",
        className
      )}
    >
      {label}
    </span>
  );
}
