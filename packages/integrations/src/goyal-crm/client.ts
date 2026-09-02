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

/** Supabase staff JWT (three dot-separated parts). Partner access keys are hex, not JWTs. */
function isLikelyJwt(token: string) {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/** Normalize env values that may include a leading "Bearer " prefix. */
function stripBearerPrefix(raw: string): string {
  const t = raw.trim().replace(/^["']|["']$/g, "");
  return t.replace(/^Bearer\s+/i, "").trim();
}

function firstEnvToken(...keys: string[]): string {
  for (const key of keys) {
    const raw = process.env[key];
    if (!raw?.trim()) continue;
    const token = stripBearerPrefix(raw);
    if (token) return token;
  }
  return "";
}

/**
 * Partner / EOI portal access token (never expires).
 * Same value for GET + POST. Code always sends Authorization: Bearer <token>
 * plus X-EOI-Api-Key and access_key — put ONLY the raw token in env (or "Bearer <token>").
 *
 * Env (first match wins):
 *   EOI_API_KEY | GOYAL_CRM_BEARER_TOKEN | BEARER_AUTHORIZATION | AUTHORIZATION
 *   or GOYAL_CRM_API_TOKEN when it is the hex partner key (not a JWT)
 */
function partnerAccessToken() {
  const fromPartnerKeys = firstEnvToken(
    "EOI_API_KEY",
    "GOYAL_CRM_BEARER_TOKEN",
    "BEARER_AUTHORIZATION",
    "AUTHORIZATION",
  );
  if (fromPartnerKeys) return fromPartnerKeys;

  const fromGoyal = firstEnvToken("GOYAL_CRM_API_TOKEN");
  if (fromGoyal && !isLikelyJwt(fromGoyal)) return fromGoyal;
  return "";
}

/**
 * Staff Supabase JWT for POST /leads/:id/book and /site-visit only.
 * Partner access_key cannot call those routes (CRM returns role=api_token → 403).
 */
function staffToken() {
  const t = firstEnvToken("GOYAL_CRM_API_TOKEN");
  if (!t || !isLikelyJwt(t)) return "";
  return t;
}

export function getGoyalCrmCapabilities() {
  const partner = Boolean(partnerAccessToken());
  const staff = Boolean(staffToken());
  return {
    staffApi: staff,
    webhookCreate: partner,
    webhookList: partner,
    canCreate: partner || staff,
    /** Book / site-visit work with BEARER_AUTHORIZATION (permanent Partner token) or staff JWT */
    canBook: partner || staff,
    canListAllCrm: partner,
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

/** Auth headers for Partner/EOI portal token (Bearer + X-EOI-Api-Key). */
function partnerAuthHeaders(key: string, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("X-EOI-Api-Key")) headers.set("X-EOI-Api-Key", key);
  return headers;
}

async function partnerFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const key = partnerAccessToken();
  if (!key) {
    throw new GoyalCrmError(
      "EOI_API_KEY is not configured (Partner/EOI access token for list + create)",
      500
    );
  }
  const headers = partnerAuthHeaders(key, init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const method = (init.method || "GET").toUpperCase();
  // Bound hung CRM GETs; mutations keep caller-provided signal or default longer.
  const signal =
    init.signal
    ?? (method === "GET"
      ? AbortSignal.timeout(Number(process.env.GOYAL_CRM_GET_TIMEOUT_MS || 3_000))
      : AbortSignal.timeout(Number(process.env.GOYAL_CRM_MUTATION_TIMEOUT_MS || 15_000)));
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, signal });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new GoyalCrmError(
      messageFromBody(body, `Partner CRM request failed (${res.status})`),
      res.status,
      body
    );
  }
  return body;
}

async function staffFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = staffToken();
  if (!token) {
    throw new GoyalCrmError(
      "GOYAL_CRM_API_TOKEN is not configured (staff Supabase JWT required for book / site-visit)",
      500
    );
  }
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const method = (init.method || "GET").toUpperCase();
  const signal =
    init.signal
    ?? (method === "GET"
      ? AbortSignal.timeout(Number(process.env.GOYAL_CRM_GET_TIMEOUT_MS || 3_000))
      : AbortSignal.timeout(Number(process.env.GOYAL_CRM_MUTATION_TIMEOUT_MS || 15_000)));
  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, signal });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new GoyalCrmError(
      messageFromBody(body, `CRM staff request failed (${res.status})`),
      res.status,
      body
    );
  }
  return body;
}

/** Staff JWT when set; otherwise permanent Partner token (BEARER_AUTHORIZATION). */
async function crmMutationFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  if (staffToken()) {
    try {
      return await staffFetch(path, init);
    } catch (err) {
      if (!partnerAccessToken()) throw err;
      console.warn("[Goyal CRM] staff mutation failed, trying Partner token", err);
    }
  }
  return partnerFetch(path, init);
}

/** @deprecated use staffFetch — kept name for older call sites via crmFetch alias below */
async function crmFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  return crmMutationFetch(path, init);
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
  if (params.all) q.set("all", "true");
  // Partner punches use source "partner_leads". Filtering source=eoi returns HTTP 400.
  if (params.source && params.source !== "eoi" && params.source !== "all") {
    q.set("source", params.source);
  }
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

/**
 * Resolve a CRM lead UUID from id / leadCode / phone so site-visit & book
 * staff routes receive a real UUID (webhook create often returns only leadCode).
 */
export async function resolveGoyalLeadId(params: {
  idOrCode?: string | null;
  phone?: string | null;
}): Promise<string | null> {
  const idOrCode = params.idOrCode?.trim() || "";
  if (idOrCode && looksLikeUuid(idOrCode)) return idOrCode;

  const phoneDigits = (params.phone || "").replace(/\D/g, "").slice(-10);
  try {
    if (idOrCode) {
      const byCode = await listGoyalLeads({ search: idOrCode, limit: 10, page: 1 });
      const match =
        byCode.leads.find((l) => l.leadCode === idOrCode) ||
        byCode.leads.find((l) => l.id === idOrCode);
      if (match?.id && looksLikeUuid(match.id)) return match.id;
    }
    if (phoneDigits) {
      const byPhone = await listGoyalLeads({ phone: phoneDigits, limit: 10, page: 1 });
      const match = byPhone.leads.find((l) => {
        const p = String(l.phone ?? "").replace(/\D/g, "");
        return p.endsWith(phoneDigits);
      });
      if (match?.id && looksLikeUuid(match.id)) return match.id;
    }
  } catch (err) {
    console.warn("[Goyal CRM] resolveGoyalLeadId failed", err);
  }
  return idOrCode && looksLikeUuid(idOrCode) ? idOrCode : null;
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
    source: "partner_leads",
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
 * Partner portal list — GET /eoi/leads (paginated) or /eoi/all-leads.
 * Auth: access_key query + Bearer + X-EOI-Api-Key (CRM accepts any one).
 */
export async function listGoyalLeadsViaEoiKey(
  params: GoyalCrmLeadListParams = {},
  opts?: { signal?: AbortSignal; fast?: boolean }
): Promise<GoyalCrmLeadListResult> {
  const key = partnerAccessToken();
  if (!key) {
    throw new GoyalCrmError("EOI_API_KEY is not configured for Partner/EOI list", 500);
  }
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const wantAll = Boolean(params.all);
  const qs = toQuery(
    { ...params, page, limit, all: wantAll || undefined },
    { access_key: key, api_key: key }
  );

  // Reception search needs one fast path — fallbacks are for offline tooling only.
  const tryPaths = opts?.fast
    ? [`/eoi/leads${qs}`]
    : wantAll
      ? [`/eoi/all-leads${qs}`, `/webhooks/eoi/all-leads${qs}`, `/eoi/leads${qs}`, `/webhooks/eoi/leads${qs}`]
      : [`/eoi/leads${qs}`, `/webhooks/eoi/leads${qs}`];

  let lastErr: unknown;
  for (const path of tryPaths) {
    try {
      const body = await partnerFetch(path, { method: "GET", signal: opts?.signal });
      return toListResult(body, page, wantAll ? extractLeads(body).length || limit : limit);
    } catch (err) {
      lastErr = err;
      if (err instanceof GoyalCrmError && err.status < 500 && err.status !== 404) throw err;
      if (err instanceof Error && err.name === "TimeoutError") throw err;
      if (err instanceof Error && err.name === "AbortError") throw err;
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
  if (!partnerAccessToken()) return lead;

  try {
    const digits = phone.replace(/\D/g, "").slice(-10);
    const { leads } = await listGoyalLeadsViaEoiKey({
      phone: digits || phone,
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

/** @deprecated Prefer enrichLeadIdFromEoiList */
export async function enrichLeadIdFromStaffList(
  lead: GoyalCrmLead,
  phone: string
): Promise<GoyalCrmLead> {
  return enrichLeadIdFromEoiList(lead, phone);
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
 * Prefer Partner/EOI token list (GET /eoi/leads — all CRM sources).
 * Optional staff JWT fallback if partner key missing.
 */
export async function listGoyalLeads(
  params: GoyalCrmLeadListParams = {},
  opts?: { signal?: AbortSignal; fast?: boolean }
): Promise<GoyalCrmLeadListResult> {
  if (partnerAccessToken()) {
    try {
      return await listGoyalLeadsViaEoiKey(params, opts);
    } catch (err) {
      if (!staffToken() || opts?.fast) throw err;
      console.warn("[Goyal CRM] partner /eoi/leads failed, trying staff /leads", err);
    }
  }
  if (staffToken()) {
    return listGoyalLeadsStaff(params);
  }
  throw new GoyalCrmError(
    "Configure EOI_API_KEY (Partner access token for GET /eoi/leads). Optional GOYAL_CRM_API_TOKEN (staff JWT) for book/site-visit.",
    500
  );
}

export async function getGoyalLead(leadId: string): Promise<GoyalCrmLead> {
  if (staffToken()) {
    try {
      return normalizeStaffLead(await crmFetch(`/leads/${encodeURIComponent(leadId)}`));
    } catch (err) {
      if (!(err instanceof GoyalCrmError) || (err.status !== 401 && err.status !== 403 && err.status !== 404)) {
        if (!(err instanceof GoyalCrmError && err.status === 404) && !partnerAccessToken()) throw err;
      }
    }
  }

  if (!partnerAccessToken()) {
    throw new GoyalCrmError(
      "Configure EOI_API_KEY (list) or GOYAL_CRM_API_TOKEN (staff get)",
      500
    );
  }

  const listed = await listGoyalLeadsViaEoiKey({
    search: leadId,
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
    access_key: key,
    api_key: key,
  });
  const body = await partnerFetch(path, {
    method: "POST",
    headers: partnerAuthHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const obj = asRecord(body);
  if (obj && obj.success === false) {
    throw new GoyalCrmError(messageFromBody(body, "EOI webhook rejected"), 400, body);
  }
  return body;
}

/** Partner webhook create — EOI_API_KEY. Tries /webhooks/eoi then /eoi/create. */
export async function createGoyalEoiLeadViaWebhook(
  input: CreateEoiLeadInput
): Promise<unknown> {
  const key = partnerAccessToken();
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
 * Prefer Partner webhook (EOI_API_KEY). Staff POST /leads/eoi only if JWT is configured.
 */
export async function createEoiLeadBestEffort(
  input: CreateEoiLeadInput
): Promise<{ lead: GoyalCrmLead; via: "webhook" | "staff" }> {
  const partner = partnerAccessToken();
  const staff = staffToken();

  if (partner) {
    try {
      const body = await createGoyalEoiLeadViaWebhook(input);
      let lead = normalizeWebhookLead(body, input);
      lead = await enrichLeadIdFromEoiList(lead, input.phone);
      return { lead, via: "webhook" };
    } catch (err) {
      if (!staff) throw err;
      console.warn("[Goyal CRM] webhook create failed, trying staff", err);
    }
  }

  if (staff) {
    const lead = await createGoyalEoiLead(input);
    return { lead, via: "staff" };
  }

  throw new GoyalCrmError(
    "Configure EOI_API_KEY (Partner access token for create/list)",
    500
  );
}

export async function bookGoyalLead(
  leadId: string,
  input: BookEoiLeadInput
): Promise<GoyalCrmLead> {
  if (!partnerAccessToken() && !staffToken()) {
    throw new GoyalCrmError(
      "Configure BEARER_AUTHORIZATION or GOYAL_CRM_API_TOKEN for CRM book",
      500
    );
  }
  const resolved =
    (await resolveGoyalLeadId({ idOrCode: leadId })) || leadId;
  const payload = compactEoiPayload(input as unknown as Record<string, unknown>);
  return normalizeStaffLead(
    await crmMutationFetch(`/leads/${encodeURIComponent(resolved)}/book`, {
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
  if (!partnerAccessToken() && !staffToken()) {
    throw new GoyalCrmError(
      "Configure BEARER_AUTHORIZATION or GOYAL_CRM_API_TOKEN for CRM update",
      500
    );
  }
  const resolved =
    (await resolveGoyalLeadId({ idOrCode: leadId })) || leadId;
  const payload = compactEoiPayload(input as unknown as Record<string, unknown>);
  return normalizeStaffLead(
    await crmMutationFetch(`/leads/${encodeURIComponent(resolved)}`, {
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
  if (!partnerAccessToken() && !staffToken()) {
    throw new GoyalCrmError(
      "Configure BEARER_AUTHORIZATION or GOYAL_CRM_API_TOKEN for CRM site-visit",
      500
    );
  }
  const resolved =
    (await resolveGoyalLeadId({
      idOrCode: leadId,
      phone: undefined,
    })) || leadId;

  const today = new Date().toISOString().slice(0, 10);
  const visitNoteParts = [
    input.notes,
    input.visitingCpName || input.visitingCpId
      ? `Visiting CP: ${input.visitingCpName || input.visitingCpId}${
          input.visitingCpId && input.visitingCpName ? ` (${input.visitingCpId})` : ""
        }`
      : null,
    input.salespersonName ? `Sales: ${input.salespersonName}` : null,
    `Site visit at ${new Date().toISOString()}`,
  ].filter(Boolean);
  const notes = visitNoteParts.join(" — ") || undefined;

  const siteVisitPayload = compactEoiPayload({
    siteVisit: true,
    siteVisitDate: input.siteVisitDate ?? today,
    siteVisitDone: input.siteVisitDone ?? true,
    siteVisitDoneDate: input.siteVisitDoneDate ?? today,
  } as Record<string, unknown>);

  try {
    const lead = normalizeStaffLead(
      await crmMutationFetch(`/leads/${encodeURIComponent(resolved)}/site-visit`, {
        method: "POST",
        body: JSON.stringify(siteVisitPayload),
      })
    );
    if (notes) {
      try {
        return await updateGoyalLead(resolved, { notes } as UpdateGoyalLeadInput);
      } catch {
        return lead;
      }
    }
    return lead;
  } catch (err) {
    if (err instanceof GoyalCrmError && (err.status === 404 || err.status === 405)) {
      return updateGoyalLead(resolved, {
        siteVisit: true,
        siteVisitDate: input.siteVisitDate ?? today,
        siteVisitDone: input.siteVisitDone ?? true,
        siteVisitDoneDate: input.siteVisitDoneDate ?? today,
        ...(notes ? { notes } : {}),
      } as UpdateGoyalLeadInput);
    }
    throw err;
  }
}

export async function listMyGoyalLeads(
  params: Omit<GoyalCrmLeadListParams, "assignedToId"> = {}
): Promise<GoyalCrmLeadListResult> {
  if (!staffToken()) {
    throw new GoyalCrmError(
      "My leads requires GOYAL_CRM_API_TOKEN (staff JWT). Use the main list with EOI_API_KEY for all CRM leads.",
      403
    );
  }
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const raw = await crmFetch(`/leads/my-leads${toQuery({ ...params, page, limit })}`);
  return toListResult(raw, page, limit);
}
