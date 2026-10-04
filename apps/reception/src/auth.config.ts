import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config for middleware (no Prisma / bcrypt imports).
 * Full Credentials provider lives in auth.ts (Node runtime only).
 *
 * Important: do NOT gate routes in `authorized` — when it returns false,
 * Auth.js redirects using NEXTAUTH_URL/AUTH_URL. A shared root .env often
 * sets NEXTAUTH_URL=https://sales.goyalhariyana.com, which would bounce
 * reception.goyalhariyana.com users to the sales portal. Route protection
 * stays in middleware.ts with same-origin redirects from req.url.
 */
const cookiePrefix = "reception";

/** Prefer RECEPTION_URL so a monorepo-wide NEXTAUTH_URL=sales cannot hijack redirects. */
function receptionCanonicalUrl(): string | undefined {
  const fromReception = (process.env.RECEPTION_URL || "").trim().replace(/\/$/, "");
  if (fromReception) return fromReception;
  const fromAuth = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "").trim().replace(/\/$/, "");
  if (fromAuth && /reception/i.test(fromAuth)) return fromAuth;
  return undefined;
}

const canonical = receptionCanonicalUrl();
if (canonical) {
  process.env.AUTH_URL = canonical;
  process.env.NEXTAUTH_URL = canonical;
}

export const authConfig = {
  trustHost: true,
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Host-only cookie — never share across *.goyalhariyana.com
      },
    },
  },
  callbacks: {
    authorized() {
      // Always allow; middleware.ts enforces login / role with same-origin redirects.
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.organizationId = token.organizationId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;
