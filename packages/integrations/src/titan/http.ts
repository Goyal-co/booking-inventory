import type { TitanCRMProvider } from "../types";
import { mockTitanCRM } from "./mock";

const TITAN_BASE = process.env.TITAN_CRM_API_URL ?? "";
const TITAN_KEY = process.env.TITAN_CRM_API_KEY ?? "";

async function titanFetch(path: string, body: Record<string, unknown>) {
  if (!TITAN_BASE || !TITAN_KEY) {
    console.warn("[Titan CRM] API URL/key not configured, falling back to mock");
    return null;
  }
  const res = await fetch(`${TITAN_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TITAN_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Titan API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<{ crmId?: string; id?: string }>;
}

export const httpTitanCRM: TitanCRMProvider = {
  async syncLead(data) {
    const result = await titanFetch("/leads", data as unknown as Record<string, unknown>);
    if (!result) return mockTitanCRM.syncLead(data);
    return { crmId: result.crmId ?? result.id ?? `TITAN-${Date.now()}` };
  },
  async syncEOI(data) {
    const result = await titanFetch("/eoi", data);
    if (!result) return mockTitanCRM.syncEOI(data);
    return { crmId: result.crmId ?? result.id ?? `TITAN-EOI-${Date.now()}` };
  },
  async syncSiteVisit(data) {
    const result = await titanFetch("/site-visits", data);
    if (!result) return mockTitanCRM.syncSiteVisit(data);
  },
  async syncBlock(data) {
    const result = await titanFetch("/blocks", data);
    if (!result) return mockTitanCRM.syncBlock(data);
    return { crmId: result.crmId ?? result.id ?? `TITAN-BLOCK-${Date.now()}` };
  },
  async syncBooking(data) {
    const result = await titanFetch("/bookings", data as unknown as Record<string, unknown>);
    if (!result) return mockTitanCRM.syncBooking(data);
    return { crmId: result.crmId ?? result.id ?? `TITAN-BOOK-${Date.now()}` };
  },
  async searchLead(query) {
    if (!TITAN_BASE || !TITAN_KEY) return mockTitanCRM.searchLead(query);
    const params = new URLSearchParams();
    if (query.leadId) params.set("leadId", query.leadId);
    if (query.phone) params.set("phone", query.phone);
    const res = await fetch(`${TITAN_BASE}/leads/search?${params}`, {
      headers: { Authorization: `Bearer ${TITAN_KEY}` },
    });
    if (!res.ok) return null;
    return res.json();
  },
};
