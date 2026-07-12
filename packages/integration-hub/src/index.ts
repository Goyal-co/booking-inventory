import { createHash, randomUUID } from "crypto";
import { integrationEventSchema, type IntegrationEvent } from "@goyal/ecosystem-contracts";

export type EventHandler = (event: IntegrationEvent, correlationId: string) => Promise<void>;

const handlers = new Map<string, EventHandler[]>();

export function registerEventHandler(eventType: string, handler: EventHandler) {
  const list = handlers.get(eventType) ?? [];
  list.push(handler);
  handlers.set(eventType, list);
}

export function buildIdempotencyKey(event: IntegrationEvent, version = 1) {
  return createHash("sha256")
    .update(`${event.type}:${event.entityId}:${version}`)
    .digest("hex");
}

export async function publishEvent(
  event: IntegrationEvent,
  options?: { hubUrl?: string; secret?: string }
): Promise<{ correlationId: string; idempotencyKey: string }> {
  const parsed = integrationEventSchema.parse({
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
  });
  const correlationId = randomUUID();
  const idempotencyKey = buildIdempotencyKey(parsed);

  const hubUrl = options?.hubUrl ?? process.env.INTEGRATION_HUB_URL;
  if (hubUrl) {
    const res = await fetch(`${hubUrl}/api/integration/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-integration-secret": options?.secret ?? process.env.INTEGRATION_WEBHOOK_SECRET ?? "",
        "x-idempotency-key": idempotencyKey,
        "x-correlation-id": correlationId,
      },
      body: JSON.stringify(parsed),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hub publish failed: ${res.status} ${text}`);
    }
    return { correlationId, idempotencyKey };
  }

  await processEventLocally(parsed, correlationId);
  return { correlationId, idempotencyKey };
}

export async function processEventLocally(event: IntegrationEvent, correlationId?: string) {
  const id = correlationId ?? randomUUID();
  const list = handlers.get(event.type) ?? [];
  for (const handler of list) {
    await handler(event, id);
  }
}

/** Redis Streams adapter stub for Phase D scaling */
export async function publishToEventBus(
  _stream: string,
  event: IntegrationEvent
): Promise<string> {
  if (process.env.EVENT_BUS_PROVIDER === "redis") {
    // Placeholder: wire Redis Streams when volume requires it
    console.info("[event-bus] redis publish stub", event.type);
  }
  return buildIdempotencyKey(event);
}
