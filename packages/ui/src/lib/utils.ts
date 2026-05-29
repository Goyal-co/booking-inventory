import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Maps FilterDimension enum values to unit API query param keys */
export function filterDimensionToQueryKey(dimension: string): string {
  const map: Record<string, string> = {
    TOWER: "tower",
    BHK: "bhk",
    STATUS: "status",
    FLOOR: "floor",
    FACING: "facing",
  };
  return map[dimension] ?? dimension.toLowerCase();
}

export function formatPrice(amount: number | string) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(num)) return "₹0";
  // Deterministic formatting — avoids SSR/client Intl mismatches
  const rounded = Math.round(num).toString();
  const grouped = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `₹${grouped}`;
}

export function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export type UnitStatus = "AVAILABLE" | "BLOCKED" | "BOOKED" | "SOLD" | "HOLD";

export const STATUS_COLORS: Record<UnitStatus, { bg: string; text: string; border: string; label: string }> = {
  AVAILABLE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", label: "Available" },
  BLOCKED: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", label: "Blocked" },
  BOOKED: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300", label: "Booked" },
  SOLD: { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-300", label: "Sold" },
  HOLD: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-300", label: "Hold" },
};

export interface UnitCardData {
  id: string;
  unitNumber: string;
  towerName: string;
  towerCode: string;
  floorNumber: number;
  carpetArea: number | null;
  bhkType: string | null;
  price: number | null;
  status: UnitStatus;
  facing?: string | null;
  pendingApproval?: boolean;
  block?: {
    id: string;
    userId: string;
    userName: string;
    expiresAt: string;
  } | null;
  floorPlanImageUrl?: string | null;
  floorPlan?: {
    id: string;
    name: string;
    imageUrl: string | null;
    pdfUrl: string | null;
    amenities: string[];
    bhkType?: string | null;
    carpetArea?: number | null;
  } | null;
}

export interface CostSheetLineItem {
  label: string;
  amount: number;
}

export interface CostSheetData {
  name: string;
  lineItems: CostSheetLineItem[];
  totalPrice: number;
}

export interface ActivityItem {
  id: string;
  message: string;
  userName?: string;
  createdAt: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  dimension: string;
  label: string;
  options: FilterOption[];
}
