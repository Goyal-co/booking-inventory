import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config for middleware (no Prisma / bcrypt imports).
 * Full Credentials provider lives in auth.ts (Node runtime only).
 */
export const authConfig = {
  trustHost: true,
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isLoggedIn = !!auth?.user;
      const isLogin = path.startsWith("/login");
      const isDashboard = path.startsWith("/dashboard");

      if (isDashboard) return isLoggedIn;
      if (isLogin) return true;
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
