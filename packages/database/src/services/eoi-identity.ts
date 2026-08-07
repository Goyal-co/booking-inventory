/**
 * Resolve canonical lead identity + associated CPs from EOI Partner Portal.
 */

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

export type EoiIdentityPartner = {
  cpId: string;
  name: string;
  companyName: string | null;
  email: string | null;
  eoiCpLeadIds: string[];
  projects: { id: string; name: string; eoiStatus: string }[];
};

export type EoiIdentityAssociation = {
  eoiCpLeadId: string;
  publicLeadId: string;
  cpId: string;
  cpName: string | null;
  projectId: string;
  projectName: string;
  intentType: string | null;
  journeyStatus: string;
  siteVisitStatus: string | null;
  createdAt: string;
};

export type EoiIdentityPayload = {
  identityId: string;
  leadId: string;
  primaryPhone: string | null;
  primaryEmail: string | null;
  customerName: string | null;
  partners: EoiIdentityPartner[];
  associations: EoiIdentityAssociation[];
};

export async function fetchEoiLeadIdentity(query: {
  leadId?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<EoiIdentityPayload | null> {
  const base = eoiBaseUrl();
  const secret = webhookSecret();
  if (!base || !secret) return null;

  const params = new URLSearchParams();
  if (query.leadId?.trim()) params.set("leadId", query.leadId.trim());
  const phone = query.phone?.replace(/\D/g, "").slice(-10);
  if (phone) params.set("phone", phone);
  if (query.email?.trim()) params.set("email", query.email.trim());
  if (![...params.keys()].length) return null;

  try {
    const res = await fetch(`${base}/api/integration/leads/by-identity?${params}`, {
      headers: {
        "X-Integration-Secret": secret,
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as
      | { data?: EoiIdentityPayload }
      | EoiIdentityPayload
      | null;
    if (!body) return null;
    if ("data" in body && body.data) return body.data;
    if ("identityId" in body && body.identityId) return body as EoiIdentityPayload;
    return null;
  } catch (e) {
    console.error("[fetchEoiLeadIdentity] failed", e);
    return null;
  }
}
