"use client";

import { cn, formatPrice, STATUS_COLORS, type UnitCardData } from "../lib/utils";
import { StatusBadge } from "./status-badge";
import { BlockTimer } from "./block-timer";

interface UnitCardProps {
  unit: UnitCardData;
  currentUserId?: string;
  onClick?: (unit: UnitCardData) => void;
  selected?: boolean;
  showHeatmap?: boolean;
  heatLevel?: number;
  blockingAllowed?: boolean;
  selectionMode?: "sales" | "admin";
}

export function UnitCard({
  unit,
  currentUserId,
  onClick,
  selected,
  showHeatmap,
  heatLevel = 0,
  blockingAllowed = true,
  selectionMode = "sales",
}: UnitCardProps) {
  const colors = unit.pendingApproval
    ? { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300", label: "Pending Approval" }
    : STATUS_COLORS[unit.status];
  const isBlockedByMe = unit.block?.userId === currentUserId;
  const isBlockedByOther = unit.status === "BLOCKED" && unit.block && !isBlockedByMe;
  const isDisabled =
    selectionMode === "admin"
      ? !!(unit.status === "BOOKED" || unit.status === "SOLD" || unit.pendingApproval)
      : !!(
          unit.status === "BOOKED" ||
          unit.status === "SOLD" ||
          isBlockedByOther ||
          unit.pendingApproval ||
          (unit.status === "AVAILABLE" && !blockingAllowed)
        );

  const heatOpacity = showHeatmap ? Math.min(heatLevel * 0.15, 0.6) : 0;

  return (
    <button
      type="button"
      onClick={() => !isDisabled && onClick?.(unit)}
      disabled={isDisabled}
      className={cn(
        "relative flex flex-col rounded-xl border-2 p-3 text-left shadow-sm transition-all duration-200",
        colors.bg,
        colors.border,
        !isDisabled && "hover:shadow-md cursor-pointer hover:z-10",
        isDisabled && "cursor-not-allowed opacity-80",
        selected && "ring-2 ring-blue-500 ring-offset-2",
        unit.status === "AVAILABLE" && !isDisabled && "hover:border-emerald-400"
      )}
      style={showHeatmap && heatLevel > 0 ? { boxShadow: `inset 0 0 0 9999px rgba(239,68,68,${heatOpacity})` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-gray-900">{unit.unitNumber}</p>
          <p className="text-xs text-gray-500">{unit.towerName}</p>
        </div>
        <StatusBadge
          status={unit.pendingApproval ? "BLOCKED" : unit.status}
          className={unit.pendingApproval ? "bg-blue-100 text-blue-800" : undefined}
          label={unit.pendingApproval ? "Pending Approval" : undefined}
        />
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-gray-600">
        {unit.bhkType && <p>{unit.bhkType}</p>}
        {unit.carpetArea && <p>{unit.carpetArea} sqft</p>}
        {unit.price != null && <p className="font-semibold text-gray-800">{formatPrice(unit.price)}</p>}
      </div>

      {unit.status === "BLOCKED" && unit.block && (
        <div className="mt-2 border-t border-amber-200 pt-2">
          <p className="text-xs font-medium text-amber-800">
            {unit.pendingApproval
              ? "Awaiting admin approval"
              : isBlockedByMe
                ? "Blocked by You"
                : `Blocked by ${unit.block.userName}`}
          </p>
          <BlockTimer expiresAt={unit.block.expiresAt} className="mt-1" />
        </div>
      )}

      {unit.floorPlanImageUrl && unit.status === "AVAILABLE" && (
        <div className="mt-2 hidden group-hover:block">
          <img
            src={unit.floorPlanImageUrl}
            alt="Floor plan"
            className="h-12 w-full rounded object-cover opacity-60"
          />
        </div>
      )}
    </button>
  );
}
