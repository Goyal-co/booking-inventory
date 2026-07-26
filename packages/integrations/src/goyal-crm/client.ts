import type {
  BookEoiLeadInput,
  CreateEoiLeadInput,
  GoyalCrmLead,
  GoyalCrmLeadListParams,
  GoyalCrmLeadListResult,
} from "./types";

export class GoyalCrmError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "GoyalCrmError";
    this.status = status;
    this.body = body;
  }
}

function baseUrl() {
  return (process.env.GOYAL_CRM_API_URL ?? "https://goyalhariyanacrm.in/api").replace(/\/$/, "");
}

function apiToken() {
  return (
    process.env.GOYAL_CRM_API_TOKEN?.trim() ||
    process.env.EOI_API_KEY?.trim() ||
    ""
  );
}

function eoiWebhookKey() {
  return process.env.EOI_API_KEY?.trim() || process.env.GOYAL_CRM_API_TOKEN?.trim() || "";
}

function messageFromBody(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.message === "string") return o.message;
  if (Array.isArray(o.message)) return o.message.map(String).join(", ");
  if (typeof o.error === "string") return o.error;
  return fallback;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

async function crmFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = apiToken();
  if (!token) {
    throw new GoyalCrmError(
      "GOYAL_CRM_API_TOKEN is not configured (Bearer token for CRM staff/API access)",
      500
    );
  }

  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new GoyalCrmError(
      messageFromBody(body, `CRM request failed (${res.status})`),
      res.status,
      body
    );
  }
  return body;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function extractLeads(payload: unknown): GoyalCrmLead[] {
  if (Array.isArray(payload)) return payload as GoyalCrmLead[];
  const obj = asRecord(payload);
  if (!obj) return [];
  for (const key of ["leads", "data", "items", "results", "rows"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as GoyalCrmLead[];
    const nested = asRecord(v);
    if (nested) {
      for (const k2 of ["leads", "data", "items", "results", "rows"]) {
        if (Array.isArray(nested[k2])) return nested[k2] as GoyalCrmLead[];
      }
    }
  }
  return [];
}

function extractTotal(payload: unknown, leadsLen: number): number | null {
  const obj = asRecord(payload);
  if (!obj) return null;
  for (const key of ["total", "totalCount", "count", "totalItems"]) {
    const n = Number(obj[key]);
    if (Number.isFinite(n)) return n;
  }
  const meta = asRecord(obj.meta) ?? asRecord(obj.pagination);
  if (meta) {
    for (const key of ["total", "totalCount", "count"]) {
      const n = Number(meta[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return leadsLen;
}

function toQuery(params: GoyalCrmLeadListParams): string {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.source) q.set("source", params.source);
  if (params.search) q.set("search", params.search);
  if (params.phone) q.set("phone", params.phone);
  if (params.fullName) q.set("fullName", params.fullName);
  if (params.projectName) q.set("projectName", params.projectName);
  if (params.assignedToId) q.set("assignedToId", params.assignedToId);
  if (params.booked != null && params.booked !== "") q.set("booked", String(params.booked));
  if (params.leadQuality) q.set("leadQuality", params.leadQuality);
  if (params.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params.dateTo) q.set("dateTo", params.dateTo);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function listGoyalLeads(
  params: GoyalCrmLeadListParams = {}
): Promise<GoyalCrmLeadListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const raw = await crmFetch(`/leads${toQuery({ ...params, page, limit })}`);
  const leads = extractLeads(raw);
  return {
    leads,
    page,
    limit,
    total: extractTotal(raw, leads.length),
    raw,
  };
}

export async function getGoyalLead(leadId: string): Promise<GoyalCrmLead> {
  const raw = await crmFetch(`/leads/${encodeURIComponent(leadId)}`);
  const obj = asRecord(raw);
  if (obj?.lead && typeof obj.lead === "object") return obj.lead as GoyalCrmLead;
  if (obj?.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as GoyalCrmLead;
  }
  return raw as GoyalCrmLead;
}

export async function createGoyalEoiLead(input: CreateEoiLeadInput): Promise<GoyalCrmLead> {
  const raw = await crmFetch("/leads/eoi", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const obj = asRecord(raw);
  if (obj?.lead && typeof obj.lead === "object") return obj.lead as GoyalCrmLead;
  if (obj?.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as GoyalCrmLead;
  }
  return raw as GoyalCrmLead;
}

/** Public website webhook — uses EOI_API_KEY (no staff JWT). */
export async function createGoyalEoiLeadViaWebhook(
  input: CreateEoiLeadInput
): Promise<unknown> {
  const key = eoiWebhookKey();
  if (!key) {
    throw new GoyalCrmError("EOI_API_KEY is not configured for webhook create", 500);
  }
  const res = await fetch(`${baseUrl()}/webhooks/eoi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-EOI-Api-Key": key,
    },
    body: JSON.stringify({ ...input, api_key: key }),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new GoyalCrmError(
      messageFromBody(body, `EOI webhook failed (${res.status})`),
      res.status,
      body
    );
  }
  return body;
}

export async function bookGoyalLead(
  leadId: string,
  input: BookEoiLeadInput
): Promise<GoyalCrmLead> {
  const raw = await crmFetch(`/leads/${encodeURIComponent(leadId)}/book`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const obj = asRecord(raw);
  if (obj?.lead && typeof obj.lead === "object") return obj.lead as GoyalCrmLead;
  if (obj?.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as GoyalCrmLead;
  }
  return raw as GoyalCrmLead;
}

export async function listMyGoyalLeads(
  params: Omit<GoyalCrmLeadListParams, "assignedToId"> = {}
): Promise<GoyalCrmLeadListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const raw = await crmFetch(`/leads/my-leads${toQuery({ ...params, page, limit })}`);
  const leads = extractLeads(raw);
  return {
    leads,
    page,
    limit,
    total: extractTotal(raw, leads.length),
    raw,
  };
}
