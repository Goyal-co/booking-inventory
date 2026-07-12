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
