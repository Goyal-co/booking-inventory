import type {
  BookEoiLeadInput,
  CreateEoiLeadInput,
  GoyalCrmLead,
  GoyalCrmLeadListParams,
  GoyalCrmLeadListResult,
  UpdateGoyalLeadInput,
  MarkSiteVisitInput,
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

/** Staff Bearer (Supabase JWT) — list/get/book staff routes. Never reuse EOI_API_KEY here. */
function staffToken() {
  return process.env.GOYAL_CRM_API_TOKEN?.trim() || "";
}

/** Website EOI api_key — create webhook + GET /eoi/leads. */
function eoiWebhookKey() {
  return process.env.EOI_API_KEY?.trim() || "";
}

export function getGoyalCrmCapabilities() {
  const webhook = Boolean(eoiWebhookKey());
  const staff = Boolean(staffToken());
  return {
    staffApi: staff,
    webhookCreate: webhook,
    /** List/filter via GET /eoi/leads with EOI_API_KEY */
    webhookList: webhook,
    /** Create works with webhook and/or staff */
    canCreate: webhook || staff,
    /** Book still requires staff JWT */
    canBook: staff,
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
      "GOYAL_CRM_API_TOKEN is not configured (staff Bearer for staff routes / book)",
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
  for (const key of ["data", "leads", "items", "results", "rows"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as GoyalCrmLead[];
    const nested = asRecord(v);
    if (nested) {
      for (const k2 of ["data", "leads", "items", "results", "rows"]) {
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

function toQuery(params: GoyalCrmLeadListParams, extra?: Record<string, string>): string {
  const q = new URLSearchParams(extra);
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.source) q.set("source", params.source);
  if (params.search) q.set("search", params.search);
  if (params.phone) q.set("phone", params.phone);
  if (params.fullName) q.set("fullName", params.fullName);
  if (params.email) q.set("email", params.email);
  if (params.city) q.set("city", params.city);
  if (params.projectName) q.set("projectName", params.projectName);
  if (params.assignedToId) q.set("assignedToId", params.assignedToId);
  if (params.booked != null && params.booked !== "") q.set("booked", String(params.booked));
  if (params.called != null && params.called !== "") q.set("called", String(params.called));
  if (params.siteVisit != null && params.siteVisit !== "") {
    q.set("siteVisit", String(params.siteVisit));
  }
  if (params.leadQuality) q.set("leadQuality", params.leadQuality);
  if (params.dateFrom) q.set("dateFrom", params.dateFrom);
  if (params.dateTo) q.set("dateTo", params.dateTo);
  if (params.updatedFrom) q.set("updatedFrom", params.updatedFrom);
  if (params.updatedTo) q.set("updatedTo", params.updatedTo);
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

function toListResult(
  raw: unknown,
  page: number,
  limit: number
): GoyalCrmLeadListResult {
  const leads = extractLeads(raw);
  return {
    leads,
    page,
    limit,
    total: extractTotal(raw, leads.length),
    raw,
  };
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

/**
 * Public EOI list (updated API) — GET /eoi/leads with EOI_API_KEY.
 * Auth: X-EOI-Api-Key (+ api_key query for compatibility).
 */
export async function listGoyalLeadsViaEoiKey(
  params: GoyalCrmLeadListParams = {}
): Promise<GoyalCrmLeadListResult> {
  const key = eoiWebhookKey();
  if (!key) {
    throw new GoyalCrmError("EOI_API_KEY is not configured for EOI list", 500);
  }
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const qs = toQuery({ ...params, page, limit }, { api_key: key });

  const tryPaths = [`/eoi/leads${qs}`, `/webhooks/eoi/leads${qs}`];
  let lastErr: unknown;
  for (const path of tryPaths) {
    try {
      const res = await fetch(`${baseUrl()}${path}`, {
        method: "GET",
        headers: { "X-EOI-Api-Key": key },
      });
      const body = await parseJson(res);
      if (!res.ok) {
        throw new GoyalCrmError(
          messageFromBody(body, `EOI list failed (${res.status})`),
          res.status,
          body
        );
      }
      return toListResult(body, page, limit);
    } catch (err) {
      lastErr = err;
      if (err instanceof GoyalCrmError && err.status < 500) throw err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new GoyalCrmError("EOI list failed", 502, lastErr);
}

/** Resolve lead UUID after webhook create via GET /eoi/leads?phone=… */
export async function enrichLeadIdFromEoiList(
  lead: GoyalCrmLead,
  phone: string
): Promise<GoyalCrmLead> {
  if (lead.id && looksLikeUuid(lead.id)) return lead;
  if (!eoiWebhookKey()) return lead;

  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const { leads } = await listGoyalLeadsViaEoiKey({
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

/** @deprecated Prefer enrichLeadIdFromEoiList — kept for callers that still pass staff path. */
export async function enrichLeadIdFromStaffList(
  lead: GoyalCrmLead,
  phone: string
): Promise<GoyalCrmLead> {
  const viaEoi = await enrichLeadIdFromEoiList(lead, phone);
  if (viaEoi.id && looksLikeUuid(viaEoi.id)) return viaEoi;
  if (!staffToken()) return viaEoi;

  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const { leads } = await listGoyalLeadsStaff({
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
    if (match?.id) return { ...viaEoi, ...match, id: match.id };
  } catch {
    /* keep */
  }
  return viaEoi;
}

export async function listGoyalLeadsStaff(
  params: GoyalCrmLeadListParams = {}
): Promise<GoyalCrmLeadListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const raw = await crmFetch(`/leads${toQuery({ ...params, page, limit })}`);
  return toListResult(raw, page, limit);
}

/**
 * Prefer EOI api_key list (GET /eoi/leads); fall back to staff GET /leads.
 */
export async function listGoyalLeads(
  params: GoyalCrmLeadListParams = {}
): Promise<GoyalCrmLeadListResult> {
  if (eoiWebhookKey()) {
    try {
      return await listGoyalLeadsViaEoiKey(params);
    } catch (err) {
      if (!staffToken()) throw err;
      console.warn("[Goyal CRM] EOI key list failed, trying staff /leads", err);
    }
  }
  return listGoyalLeadsStaff(params);
}

export async function getGoyalLead(leadId: string): Promise<GoyalCrmLead> {
  if (staffToken()) {
    try {
      return normalizeStaffLead(await crmFetch(`/leads/${encodeURIComponent(leadId)}`));
    } catch (err) {
      if (!(err instanceof GoyalCrmError) || (err.status !== 401 && err.status !== 403 && err.status !== 404)) {
        // try EOI list resolve below for 404/auth
        if (!(err instanceof GoyalCrmError && err.status === 404) && !eoiWebhookKey()) throw err;
      }
    }
  }

  if (!eoiWebhookKey()) {
    throw new GoyalCrmError(
      "Configure EOI_API_KEY (list) or GOYAL_CRM_API_TOKEN (staff get)",
      500
    );
  }

  // No public get-by-id — resolve via list filters
  const listed = await listGoyalLeadsViaEoiKey({
    search: leadId,
    source: "eoi",
    limit: 20,
    page: 1,
  });
  const match =
    listed.leads.find((l) => l.id === leadId) ||
    listed.leads.find((l) => l.leadCode === leadId);
  if (match) return match;

  throw new GoyalCrmError(`Lead not found: ${leadId}`, 404);
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
 * Prefer staff POST /leads/eoi when GOYAL_CRM_API_TOKEN is set.
 * Fall back to website webhook (EOI_API_KEY); then enrich UUID via GET /eoi/leads.
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
    lead = await enrichLeadIdFromEoiList(lead, input.phone);
    return { lead, via: "webhook" };
  }

  throw new GoyalCrmError(
    "Configure EOI_API_KEY (webhook create/list) and/or GOYAL_CRM_API_TOKEN (staff)",
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

/** Staff PATCH /leads/:id — update siteVisit / called / KYC fields. */
export async function updateGoyalLead(
  leadId: string,
  input: UpdateGoyalLeadInput
): Promise<GoyalCrmLead> {
  const payload = compactEoiPayload(input as unknown as Record<string, unknown>);
  return normalizeStaffLead(
    await crmFetch(`/leads/${encodeURIComponent(leadId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  );
}

/** Staff POST /leads/:id/site-visit — mark site visit (done). */
export async function markGoyalSiteVisit(
  leadId: string,
  input: MarkSiteVisitInput = {}
): Promise<GoyalCrmLead> {
  const today = new Date().toISOString().slice(0, 10);
  const payload = compactEoiPayload({
    siteVisit: true,
    siteVisitDate: input.siteVisitDate ?? today,
    siteVisitDone: input.siteVisitDone ?? true,
    siteVisitDoneDate: input.siteVisitDoneDate ?? today,
    ...(input.notes ? { notes: input.notes } : {}),
  } as Record<string, unknown>);

  try {
    return normalizeStaffLead(
      await crmFetch(`/leads/${encodeURIComponent(leadId)}/site-visit`, {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
  } catch (err) {
    if (err instanceof GoyalCrmError && (err.status === 404 || err.status === 405)) {
      return updateGoyalLead(leadId, {
        siteVisit: true,
        siteVisitDate: input.siteVisitDate ?? today,
        siteVisitDone: input.siteVisitDone ?? true,
        siteVisitDoneDate: input.siteVisitDoneDate ?? today,
      });
    }
    throw err;
  }
}

export async function listMyGoyalLeads(
  params: Omit<GoyalCrmLeadListParams, "assignedToId"> = {}
): Promise<GoyalCrmLeadListResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const raw = await crmFetch(`/leads/my-leads${toQuery({ ...params, page, limit })}`);
  return toListResult(raw, page, limit);
}
