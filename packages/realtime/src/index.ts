export type RealtimeEventType =
  | "unit:updated"
  | "block:created"
  | "block:released"
  | "block:expired"
  | "booking:confirmed"
  | "booking:submitted"
  | "booking:rejected"
  | "activity:new";

export interface UnitUpdatedPayload {
  unitId: string;
  status: string;
  block?: {
    id: string;
    userId: string;
    userName: string;
    expiresAt: string;
  } | null;
}

export interface ActivityPayload {
  id: string;
  message: string;
  userId?: string;
  userName?: string;
  unitId?: string;
  createdAt: string;
}

export interface RealtimeEventMap {
  "unit:updated": UnitUpdatedPayload;
  "block:created": UnitUpdatedPayload;
  "block:released": { unitId: string; blockId: string };
  "block:expired": { unitId: string; unitNumber: string };
  "booking:confirmed": UnitUpdatedPayload & { bookingId: string };
  "booking:submitted": UnitUpdatedPayload & { bookingId: string; pending: true };
  "booking:rejected": UnitUpdatedPayload & { bookingId: string };
  "activity:new": ActivityPayload;
}

export const REALTIME_EVENTS = {
  UNIT_UPDATED: "unit:updated" as const,
  BLOCK_CREATED: "block:created" as const,
  BLOCK_RELEASED: "block:released" as const,
  BLOCK_EXPIRED: "block:expired" as const,
  BOOKING_CONFIRMED: "booking:confirmed" as const,
  BOOKING_SUBMITTED: "booking:submitted" as const,
  BOOKING_REJECTED: "booking:rejected" as const,
  ACTIVITY_NEW: "activity:new" as const,
};

export function getProjectRoom(projectId: string) {
  return `project:${projectId}`;
}

export { useRealtime } from "./hooks";
