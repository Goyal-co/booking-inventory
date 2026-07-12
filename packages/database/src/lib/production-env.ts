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

/**
 * Public base URL for the customer booking app (no trailing slash).
 * In production, CUSTOMER_URL must be set to a non-localhost HTTPS URL
 * or booking emails will contain broken localhost links.
 */
export function getCustomerBaseUrl(): string {
  const raw =
    process.env.CUSTOMER_URL?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_URL?.trim() ||
    "";
  const fallback = "http://localhost:3003";
  const base = (raw || fallback).replace(/\/$/, "");

  if (process.env.NODE_ENV === "production" && (!raw || looksLikeLocalhost(base))) {
    throw new Error(
      "CUSTOMER_URL must be set to your deployed customer app URL (e.g. https://booking-inventory-customer.onrender.com). Localhost links cannot be emailed in production."
    );
  }

  return base;
}

export function getCustomerBookingUrl(bookingToken: string): string {
  return `${getCustomerBaseUrl()}/booking/${bookingToken}`;
}

export function getCustomerDashboardUrl(bookingToken: string): string {
  return `${getCustomerBaseUrl()}/dashboard?token=${bookingToken}`;
}
