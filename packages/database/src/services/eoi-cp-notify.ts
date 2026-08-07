/**
 * Notify EOI Partner Portal when Reception / Booking Inventory completes
 * a site visit or confirms a booking.
 *
 * Env (required on Reception + Sales deploy):
 *   EOI_CP_URL — live Partner Portal origin (e.g. https://eoi-web-phi.vercel.app)
 *   INTEGRATION_WEBHOOK_SECRET — must match EOI_CP
 */

export type EoiPortalEvent = "site_visit.completed" | "booking.confirmed";

function eoiBaseUrl() {
  return (
    process.env.EOI_CP_URL ||
    process.env.PARTNER_PORTAL_URL ||
    process.env.NEXT_PUBLIC_EOI_CP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
}

function webhookSecret() {
  return process.env.INTEGRATION_WEBHOOK_SECRET?.trim() || "";
}

function normalizePhone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return digits || undefined;
}

export async function notifyEoiPartnerPortal(input: {
  event: EoiPortalEvent;
  /** Public EOI lead id (EOI-… / LEAD-…) — preferred */
  leadId?: string | null;
  /** EOI Partner Portal Lead.id (cuid) — association for this CP */
  eoiCpLeadId?: string | null;
  /** Channel partner id — scopes update/notify to that CP only */
  cpId?: string | null;
  cpName?: string | null;
  /** Goyal / Titan CRM lead id */
  crmLeadId?: string | null;
  phone?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  salespersonId?: string | null;
  salespersonName?: string | null;
  completedAt?: string | Date | null;
}): Promise<{ ok: boolean; skipped?: boolean; status?: number; body?: unknown }> {
  const base = eoiBaseUrl();
  const secret = webhookSecret();
  if (!base || !secret) {
    console.warn("[EOI_CP notify] skipped — set EOI_CP_URL and INTEGRATION_WEBHOOK_SECRET");
    return { ok: false, skipped: true };
  }

  const leadId = input.leadId?.trim() || undefined;
  const eoiCpLeadId = input.eoiCpLeadId?.trim() || undefined;
  const crmLeadId = input.crmLeadId?.trim() || undefined;
  const phone = normalizePhone(input.phone);
  if (!leadId && !eoiCpLeadId && !crmLeadId && !phone) {
    console.warn("[EOI_CP notify] skipped — need leadId, eoiCpLeadId, crmLeadId, or phone");
    return { ok: false, skipped: true };
  }

  const completedAt =
    input.completedAt instanceof Date
      ? input.completedAt.toISOString()
      : input.completedAt?.trim() || new Date().toISOString();

  try {
    const res = await fetch(`${base}/api/webhooks/reception`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Integration-Secret": secret,
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        event: input.event,
        type: input.event,
        leadId,
        publicLeadId: leadId,
        eoiCpLeadId,
        internalLeadId: eoiCpLeadId,
        cpId: input.cpId?.trim() || undefined,
        cpName: input.cpName?.trim() || undefined,
        crmLeadId,
        titanCrmId: crmLeadId,
        phone,
        mobile: phone,
        customerMobile: phone,
        projectId: input.projectId?.trim() || undefined,
        projectName: input.projectName?.trim() || undefined,
        salespersonId: input.salespersonId?.trim() || undefined,
        salespersonName: input.salespersonName?.trim() || undefined,
        salesperson: input.salespersonName?.trim() || input.salespersonId?.trim() || undefined,
        completedAt,
        occurredAt: completedAt,
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[EOI_CP notify] failed", res.status, body);
      return { ok: false, status: res.status, body };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    console.error("[EOI_CP notify] error", e);
    return { ok: false };
  }
}
