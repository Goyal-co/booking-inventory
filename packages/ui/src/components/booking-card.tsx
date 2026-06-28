import * as React from "react";
import { cn, formatPrice } from "../lib/utils";
import { Badge } from "./input";
import { Button } from "./button";
import { MoreVertical } from "lucide-react";

export interface BookingCardData {
  id: string;
  unitNumber: string;
  towerName: string;
  customerName: string;
  customerPhone: string;
  bhkType?: string | null;
  carpetArea?: number | null;
  superArea?: number | null;
  floor?: number | null;
  totalPrice: string | number;
  status: string;
  bookedAt: string;
  salesPerson?: string;
}

export function BookingCard({
  booking,
  onViewDetails,
  className,
}: {
  booking: BookingCardData;
  onViewDetails?: () => void;
  className?: string;
}) {
  const specs = [
    booking.bhkType,
    booking.carpetArea ? `Carpet: ${booking.carpetArea} sqft` : null,
    booking.superArea ? `SBA: ${booking.superArea} sqft` : null,
    booking.floor != null ? `Floor ${booking.floor}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{booking.unitNumber}</p>
          <p className="text-sm text-gray-500">{booking.towerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={booking.status === "CONFIRMED" ? "success" : booking.status === "REJECTED" ? "danger" : booking.status === "PENDING" ? "warning" : "muted"}>
            {booking.status}
          </Badge>
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-3">
        <p className="font-medium text-gray-900">{booking.customerName}</p>
        <p className="text-sm text-gray-500">{booking.customerPhone}</p>
      </div>
      {specs && (
        <div className="mt-2 flex flex-wrap gap-1">
          {specs.split(" · ").map((tag) => (
            <span key={tag} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-lg font-bold text-brand-600">
            {formatPrice(Number(booking.totalPrice))}
          </p>
          {booking.salesPerson && (
            <p className="text-xs text-gray-500">
              {booking.salesPerson} · Booked on: {booking.bookedAt}
            </p>
          )}
        </div>
        {onViewDetails && (
          <Button size="sm" variant="outline" onClick={onViewDetails}>
            View Details
          </Button>
        )}
      </div>
    </div>
  );
}
