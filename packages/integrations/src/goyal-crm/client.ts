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

/** Staff Bearer only — never fall back to website EOI_API_KEY. */
function staffToken() {
  return process.env.GOYAL_CRM_API_TOKEN?.trim() || "";
}

/** Website webhook key only — never fall back to staff Bearer. */
function eoiWebhookKey() {
  return process.env.EOI_API_KEY?.trim() || "";
}

export function getGoyalCrmCapabilities() {
  return {
    staffApi: Boolean(staffToken()),
    webhookCreate: Boolean(eoiWebhookKey()),
    baseUrl: baseUrl(),
  };
}

/** Drop empty optional strings so CRM validators don't see "". */
export function compactEoiPayload<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out as T;
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
  const token = staffToken();
  if (!token) {
    throw new GoyalCrmError(
      "GOYAL_CRM_API_TOKEN is not configured (staff Bearer for list/get/book)",
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

function normalizeStaffLead(raw: unknown): GoyalCrmLead {
  const obj = asRecord(raw);
  if (obj?.lead && typeof obj.lead === "object") return obj.lead as GoyalCrmLead;
  if (obj?.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as GoyalCrmLead;
  }
  return raw as GoyalCrmLead;
}

function looksLikeUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id
  );
}

/** Map website webhook response into a lead-shaped object for the UI. */
export function normalizeWebhookLead(
  body: unknown,
  input: CreateEoiLeadInput
): GoyalCrmLead {
  const obj = asRecord(body) ?? {};
  const leadCode = typeof obj.leadCode === "string" ? obj.leadCode : undefined;
  const id =
    (typeof obj.id === "string" && obj.id) ||
    leadCode ||
    `webhook-${input.phone}`;
  return {
    id,
    leadCode,
    source: "eoi",
    fullName: input.fullName,
    phone: input.phone,
    email: input.email ?? null,
    projectName: input.projectName ?? null,
    city: input.city ?? null,
    booked: false,
    duplicate: Boolean(obj.duplicate),
    message: typeof obj.message === "string" ? obj.message : undefined,
  };
}

/** When webhook only returns leadCode, resolve CRM UUID via staff list. */
export async function enrichLeadIdFromStaffList(
  lead: GoyalCrmLead,
  phone: string
): Promise<GoyalCrmLead> {
  if (lead.id && looksLikeUuid(lead.id)) return lead;
  if (!staffToken()) return lead;

  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const { leads } = await listGoyalLeads({
      phone: digits || phone,
      source: "eoi",
      limit: 10,
      page: 1,
    });
    const match =
      leads.find((l) => l.leadCode && lead.leadCode && l.leadCode === lead.leadCode) ||
      leads.find((l) => {
        const p = String(l.phone ?? "").replace(/\D/g, "");
        return digits && p.endsWith(digits);
      });
    if (match?.id) {
      return { ...lead, ...match, id: match.id };
    }
  } catch {
    /* keep webhook-shaped lead */
  }
  return lead;
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
  return normalizeStaffLead(await crmFetch(`/leads/${encodeURIComponent(leadId)}`));
}

export async function createGoyalEoiLead(input: CreateEoiLeadInput): Promise<GoyalCrmLead> {
  const payload = compactEoiPayload(input as unknown as Record<string, unknown>);
  return normalizeStaffLead(
    await crmFetch("/leads/eoi", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
}

async function postWebhook(path: string, input: CreateEoiLeadInput, key: string) {
  const payload = compactEoiPayload({
    ...(input as unknown as Record<string, unknown>),
    api_key: key,
  });
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-EOI-Api-Key": key,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new GoyalCrmError(
      messageFromBody(body, `EOI webhook failed (${res.status})`),
      res.status,
      body
    );
  }
  const obj = asRecord(body);
  if (obj && obj.success === false) {
    throw new GoyalCrmError(messageFromBody(body, "EOI webhook rejected"), 400, body);
  }
  return body;
}

/** Public website webhook — uses EOI_API_KEY only. Tries /webhooks/eoi then /eoi/create. */
export async function createGoyalEoiLeadViaWebhook(
  input: CreateEoiLeadInput
): Promise<unknown> {
  const key = eoiWebhookKey();
  if (!key) {
    throw new GoyalCrmError("EOI_API_KEY is not configured for webhook create", 500);
  }
  try {
    return await postWebhook("/webhooks/eoi", input, key);
  } catch (err) {
    if (err instanceof GoyalCrmError && err.status >= 500) {
      return await postWebhook("/eoi/create", input, key);
    }
    throw err;
  }
}

/**
 * Prefer staff POST /leads/eoi when GOYAL_CRM_API_TOKEN is set (EOI_LEADS_API).
 * Fall back to website webhook (EOI_API_KEY) when staff missing or unauthorized.
 */
export async function createEoiLeadBestEffort(
  input: CreateEoiLeadInput
): Promise<{ lead: GoyalCrmLead; via: "webhook" | "staff" }> {
  const webhookKey = eoiWebhookKey();
  const staff = staffToken();

  if (staff) {
    try {
      const lead = await createGoyalEoiLead(input);
      return { lead, via: "staff" };
    } catch (err) {
      if (!webhookKey) throw err;
      const authFail =
        err instanceof GoyalCrmError && (err.status === 401 || err.status === 403);
      if (!authFail) throw err;
      console.warn("[Goyal CRM] staff create unauthorized, trying webhook", err);
    }
  }

  if (webhookKey) {
    const body = await createGoyalEoiLeadViaWebhook(input);
    let lead = normalizeWebhookLead(body, input);
    if (staff) {
      lead = await enrichLeadIdFromStaffList(lead, input.phone);
    }
    return { lead, via: "webhook" };
  }

  throw new GoyalCrmError(
    "Configure GOYAL_CRM_API_TOKEN (staff POST /leads/eoi) and/or EOI_API_KEY (webhook)",
    500
  );
}

export async function bookGoyalLead(
  leadId: string,
  input: BookEoiLeadInput
): Promise<GoyalCrmLead> {
  const payload = compactEoiPayload(input as unknown as Record<string, unknown>);
  return normalizeStaffLead(
    await crmFetch(`/leads/${encodeURIComponent(leadId)}/book`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  );
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
