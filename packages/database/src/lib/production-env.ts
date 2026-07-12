export const WEAK_SECRETS = new Set([
  "change-me-in-production",
  "change-me-in-production-min-32-chars",
  "change-me-ws-internal-secret-min-32-chars",
  "secret",
  "password",
  "password123",
]);

export function assertNextAuthSecret() {
  if (process.env.NODE_ENV !== "production") return;
  // next build imports auth modules while collecting page data; secret is enforced at runtime
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32 || WEAK_SECRETS.has(secret)) {
    throw new Error(
      "NEXTAUTH_SECRET must be a random string of at least 32 characters in production."
    );
  }
}

function looksLikeLocalhost(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/** Strip whitespace and accidental wrapping quotes from Render/dashboard env values. */
function readEnvUrl(...keys: string[]): string {
  for (const key of keys) {
    const raw = process.env[key];
    if (raw == null) continue;
    let v = raw.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1).trim();
    }
    if (v) return v.replace(/\/$/, "");
  }
  return "";
}

/**
 * Public base URL for the customer booking app (no trailing slash).
 * Must be set on the **sales** Render service (emails are sent from sales).
 */
export function getCustomerBaseUrl(): string {
  const base = readEnvUrl("CUSTOMER_URL", "NEXT_PUBLIC_CUSTOMER_URL");
  const fallback = "http://localhost:3003";

  if (process.env.NODE_ENV === "production" && (!base || looksLikeLocalhost(base))) {
    const seen = base
      ? `got "${base}"`
      : "CUSTOMER_URL is empty/missing on this service";
    throw new Error(
      `CUSTOMER_URL must be set on the sales service to your deployed customer app URL (e.g. https://booking-inventory-customer.onrender.com). ${seen}. After saving in Render → Environment, click Manual Deploy (or Restart) on sales.`
    );
  }

  return base || fallback;
}

export function getCustomerUrlStatus() {
  const base = readEnvUrl("CUSTOMER_URL", "NEXT_PUBLIC_CUSTOMER_URL");
  let host: string | null = null;
  if (base) {
    try {
      host = new URL(base).host;
    } catch {
      host = null;
    }
  }
  return {
    configured: Boolean(base) && !looksLikeLocalhost(base),
    host,
    isLocalhost: !base || looksLikeLocalhost(base),
  };
}

export function getCustomerBookingUrl(bookingToken: string): string {
  return `${getCustomerBaseUrl()}/booking/${bookingToken}`;
}

export function getCustomerDashboardUrl(bookingToken: string): string {
  return `${getCustomerBaseUrl()}/dashboard?token=${bookingToken}`;
}
