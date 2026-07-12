import { NextResponse } from "next/server";
import { integrationEventSchema } from "@goyal/ecosystem-contracts";
import { processEventLocally } from "@goyal/integration-hub";
import {
  prisma,
  upsertLeadFromEoiCp,
  logIntegrationSync,
  IntegrationSystem,
  IntegrationSyncStatus,
  Prisma,
} from "@booking/database";

function verifySecret(req: Request) {
  const secret = req.headers.get("x-integration-secret");
  const expected = process.env.INTEGRATION_WEBHOOK_SECRET;
  if (process.env.NODE_ENV === "production" && secret !== expected) return false;
  return true;
}

async function handleLeadCreated(payload: Record<string, unknown>) {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error("No organization configured");

  await upsertLeadFromEoiCp({
    leadId: String(payload.leadId),
    eoiCpLeadId: String(payload.eoiCpLeadId ?? payload.entityId),
    customerName: String(payload.customerName),
    customerEmail: payload.customerEmail ? String(payload.customerEmail) : undefined,
    customerPhone: String(payload.customerPhone ?? payload.customerMobile),
    organizationId: org.id,
    projectId: payload.projectId ? String(payload.projectId) : undefined,
    titanCrmId: payload.titanCrmId ? String(payload.titanCrmId) : undefined,
    cpId: payload.cpId ? String(payload.cpId) : undefined,
    intentType: payload.intentType ? String(payload.intentType) : undefined,
  });
}

export async function POST(req: Request) {
  if (!verifySecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = integrationEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  try {
    if (parsed.data.type === "lead.created") {
      await handleLeadCreated(parsed.data.payload);
      await logIntegrationSync(
        IntegrationSystem.EOI_CP,
        "lead",
        parsed.data.entityId,
        parsed.data.payload as Prisma.InputJsonValue,
        String(parsed.data.payload.leadId ?? ""),
        IntegrationSyncStatus.SUCCESS
      );
    } else {
      await processEventLocally(parsed.data, correlationId);
    }

    return NextResponse.json({ ok: true, correlationId });
  } catch (e) {
    await logIntegrationSync(
      IntegrationSystem.EOI_CP,
      parsed.data.type,
      parsed.data.entityId,
      parsed.data.payload as Prisma.InputJsonValue,
      undefined,
      IntegrationSyncStatus.FAILED,
      e instanceof Error ? e.message : "Failed"
    );
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Processing failed" },
      { status: 500 }
    );
  }
}
