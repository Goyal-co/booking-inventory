export type RealtimeEventType =
  | "unit:updated"
  | "block:created"
  | "block:released"
  | "block:expired"
  | "booking:confirmed"
  | "booking:submitted"
  | "booking:rejected"
  | "activity:new";

const WS_URL = process.env.WS_EMIT_URL || "http://localhost:3002";
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET?.trim();

export async function emitRealtimeEvent(
  projectId: string,
  event: RealtimeEventType,
  payload: unknown
) {
  try {
    await fetch(`${WS_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WS_INTERNAL_SECRET ? { "x-ws-internal-secret": WS_INTERNAL_SECRET } : {}),
      },
      body: JSON.stringify({ projectId, event, payload }),
    });
  } catch (error) {
    console.error("Failed to emit realtime event:", error);
  }
}
